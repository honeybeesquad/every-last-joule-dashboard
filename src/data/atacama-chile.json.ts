import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { fetchText } from "../lib/fetch.js";
import { hourlyAverage } from "../lib/csv.js";
import { latestCompleteUtcDayProfileGW, peakGW, timeOfDayAverageGW, totalTWh30d } from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";

const PAGE_URLS = [
  "https://www.coordinador.cl/operacion/documentos/reducciones-de-generacion-renovable/reducciones-erv-2026/",
  "https://www.coordinador.cl/operacion/documentos/reducciones-de-generacion-renovable/reducciones-erv-2025/",
];
const DAILY_SUMMARY_LOOKBACK_DAYS = 45;
const DAILY_SUMMARY_TARGET_DAYS = 30;
const DAILY_SUMMARY_FETCH_BATCH_SIZE = 6;
const DAILY_SUMMARY_TIMEOUT_MS = 12000;
const MONTH_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'");
}

function excelSerialToDate(serial: number): Date {
  return new Date(Date.UTC(1899, 11, 30) + serial * 24 * 3600 * 1000);
}

function chileUtcOffsetHours(month: number): number {
  // Chile generally observes UTC-3 in summer and UTC-4 in winter. Monthly
  // reduction files are coarse enough that this heuristic is sufficient.
  return month >= 5 && month <= 8 ? 4 : 3;
}

function parseCenNumber(value: string): number {
  const clean = value.trim().replace(/\s+/g, "");
  if (clean.includes(",") && clean.includes(".")) {
    return Number(clean.lastIndexOf(",") > clean.lastIndexOf(".")
      ? clean.replace(/\./g, "").replace(",", ".")
      : clean.replace(/,/g, ""));
  }
  return Number(clean.replace(",", "."));
}

async function fetchBytes(url: string, init: RequestInit = {}, timeoutMs = DAILY_SUMMARY_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function unzipText(zipBytes: Uint8Array, member: string): string {
  const dir = mkdtempSync(join(tmpdir(), "chile-xlsx-"));
  const zipPath = join(dir, "source.xlsx");
  try {
    writeFileSync(zipPath, zipBytes);
    return execFileSync("unzip", ["-p", zipPath, member], { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function parseSharedStrings(xml: string): string[] {
  return Array.from(xml.matchAll(/<si>([\s\S]*?)<\/si>/g)).map((match) =>
    Array.from(match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g))
      .map((part) => decodeXml(part[1]))
      .join(""),
  );
}

function columnIndex(ref: string): number {
  const letters = ref.match(/[A-Z]+/)?.[0] ?? "";
  let out = 0;
  for (const letter of letters) out = out * 26 + letter.charCodeAt(0) - 64;
  return out - 1;
}

function parseWorksheet(xml: string, sharedStrings: string[]): Map<number, Map<number, string>> {
  const rows = new Map<number, Map<number, string>>();
  for (const match of xml.matchAll(/<c\s+([^>]*?[^/])>([\s\S]*?)<\/c>/g)) {
    const attrs = match[1];
    const ref = attrs.match(/r="([A-Z]+\d+)"/)?.[1];
    if (!ref) continue;
    const row = Number(ref.match(/\d+/)?.[0]);
    const col = columnIndex(ref);
    const type = attrs.match(/t="([^"]+)"/)?.[1];
    let value = match[2].match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
    if (type === "s") value = sharedStrings[Number(value)] ?? value;
    if (!rows.has(row)) rows.set(row, new Map());
    rows.get(row)?.set(col, value);
  }
  return rows;
}

function findSolarSheetPath(workbookXml: string, relsXml: string): string {
  const sheet = workbookXml.match(/<sheet[^>]*name="Resumen-DiarioHorario-Solar"[^>]*r:id="([^"]+)"/);
  if (!sheet) throw new Error("Chile workbook missing Resumen-DiarioHorario-Solar sheet");
  const rel = new RegExp(`<Relationship[^>]*Id="${sheet[1]}"[^>]*Target="([^"]+)"`).exec(relsXml);
  if (!rel) throw new Error("Chile workbook missing solar sheet relationship");
  return `xl/${rel[1].replace(/^\//, "")}`;
}

export function parseCoordinadorSolarXlsx(zipBytes: Uint8Array): CurtailmentPoint[] {
  const workbookXml = unzipText(zipBytes, "xl/workbook.xml");
  const relsXml = unzipText(zipBytes, "xl/_rels/workbook.xml.rels");
  const sharedStrings = parseSharedStrings(unzipText(zipBytes, "xl/sharedStrings.xml"));
  const sheetXml = unzipText(zipBytes, findSolarSheetPath(workbookXml, relsXml));
  const rows = parseWorksheet(sheetXml, sharedStrings);

  const totals = new Map<string, number>();
  let currentDate: Date | null = null;

  for (const rowNumber of Array.from(rows.keys()).sort((a, b) => a - b)) {
    const row = rows.get(rowNumber);
    if (!row) continue;

    for (const value of row.values()) {
      const serial = Number(value);
      if (Number.isFinite(serial) && serial > 45_000 && serial < 50_000) {
        currentDate = excelSerialToDate(serial);
        break;
      }
    }

    const plant = row.get(1) ?? "";
    if (!currentDate || !plant.startsWith("PFV-")) continue;
    const month = currentDate.getUTCMonth() + 1;
    const utcOffset = chileUtcOffsetHours(month);
    for (let col = 4; col <= 27; col++) {
      const mwh = Number(row.get(col) ?? 0);
      if (!Number.isFinite(mwh) || mwh <= 0) continue;
      const localHour = col - 4;
      const utcTimestamp = new Date(Date.UTC(
        currentDate.getUTCFullYear(),
        currentDate.getUTCMonth(),
        currentDate.getUTCDate(),
        localHour + utcOffset,
      )).toISOString();
      totals.set(utcTimestamp, (totals.get(utcTimestamp) ?? 0) + mwh);
    }
  }

  return Array.from(totals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw }));
}

function latestXlsxUrl(html: string, baseUrl: string): string | null {
  const urls = Array.from(html.matchAll(/href="([^"]+\.xlsx)"/gi))
    .map((match) => new URL(decodeXml(match[1]), baseUrl).toString())
    .filter((url) => /Reducciones-de-Energia-Eolica-Solar/i.test(url));
  return urls[0] ?? null;
}

async function fetchLatestWorkbook(): Promise<{ url: string; bytes: Uint8Array }> {
  const now = new Date();
  const candidates: string[] = [];
  for (let age = 1; age <= 14; age++) {
    const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - age, 1));
    for (const publishLag of [1, 2, 0]) {
      const published = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + publishLag, 1));
      const dir = `${published.getUTCFullYear()}/${String(published.getUTCMonth() + 1).padStart(2, "0")}`;
      const year2 = String(month.getUTCFullYear()).slice(-2);
      const name = MONTH_ES[month.getUTCMonth()];
      candidates.push(
        `https://www.coordinador.cl/wp-content/uploads/${dir}/Reducciones-de-Energia-Eolica-Solar-Hidro-en-el-SEN_${name}-${year2}-PE-PFV_Publicar.xlsx`,
        `https://www.coordinador.cl/wp-content/uploads/${dir}/Reducciones-de-Energia-Eolica-Solar-e-Hidro-en-el-SEN_${name}-${year2}-PE-PFV_Publicar.xlsx`,
        `https://www.coordinador.cl/wp-content/uploads/${dir}/Reducciones-de-Energia-Eolica-Solar-Hidro-en-el-SEN_${name}-${month.getUTCFullYear()}.xlsx`,
        `https://www.coordinador.cl/wp-content/uploads/${dir}/Reducciones-de-Energia-Eolica-Solar-e-Hidro-en-el-SEN_${name}-${month.getUTCFullYear()}.xlsx`,
      );
    }
  }

  for (const url of candidates) {
    const res = await fetchBytes(url, { headers: { "user-agent": "Mozilla/5.0" } });
    if (!res.ok) continue;
    return { url, bytes: new Uint8Array(await res.arrayBuffer()) };
  }

  for (const pageUrl of PAGE_URLS) {
    const html = await fetchText(pageUrl, { timeoutMs: 45000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
    const url = latestXlsxUrl(html, pageUrl);
    if (!url) continue;
    const res = await fetchBytes(url, { headers: { "user-agent": "Mozilla/5.0", referer: pageUrl } });
    if (!res.ok) throw new Error(`Chile XLSX HTTP ${res.status} for ${url}`);
    return { url, bytes: new Uint8Array(await res.arrayBuffer()) };
  }
  throw new Error("Chile reduction pages exposed no XLSX download URL");
}

function pdfToText(pdfBytes: Uint8Array): string {
  const dir = mkdtempSync(join(tmpdir(), "chile-pdf-"));
  const pdfPath = join(dir, "source.pdf");
  try {
    writeFileSync(pdfPath, pdfBytes);
    return execFileSync("pdftotext", ["-layout", pdfPath, "-"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function assertPdfToTextAvailable(): void {
  try {
    execFileSync("pdftotext", ["-v"], { stdio: "ignore" });
  } catch {
    throw new Error("pdftotext is not available for Chile daily PDF extraction");
  }
}

export interface DailySolarReductionSummary {
  date: string;
  solarReductionMwh: number;
  url: string;
}

export function parseDailySolarReductionText(text: string, date: string, url = ""): DailySolarReductionSummary {
  const section = /Reducci[oó]n Energ[ií]a[\s\S]*?(?:Generaci[oó]n Real y Programada|Generaci[oó]n por Fuente Total)/i.exec(text)?.[0] ?? text;
  const row = /^.*\bSolar\s+([\d.,]+)\s+([\d.,]+)\s+[-\d.,]+\s*%\s+([\d.,]+)\s+[\d.,]+\s*%/im.exec(section);
  if (!row) throw new Error(`Chile daily summary ${date} missing solar reduction row`);

  const solarReductionMwh = parseCenNumber(row[3]);
  if (!Number.isFinite(solarReductionMwh) || solarReductionMwh < 0) {
    throw new Error(`Chile daily summary ${date} contained invalid solar reduction ${row[3]}`);
  }

  return { date, solarReductionMwh, url };
}

function dailySummaryUrls(date: Date): string[] {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return [
    `https://www.coordinador.cl/wp-content/uploads/${year}/${month}/Resumen-Ejecutivo-de-Operacion-${day}-${month}-${year}-V1.pdf`,
    `https://www.coordinador.cl/wp-content/uploads/${year}/${month}/Resumen-Ejecutivo-de-Operacion-${day}-${month}-${year}-V1-1.pdf`,
  ];
}

async function fetchDailySummary(date: Date): Promise<DailySolarReductionSummary | null> {
  const dateKey = date.toISOString().slice(0, 10);
  for (const url of dailySummaryUrls(date)) {
    const res = await fetchBytes(url, { headers: { "user-agent": "Mozilla/5.0" } });
    if (res.status === 404) continue;
    if (!res.ok) throw new Error(`Chile daily summary HTTP ${res.status} for ${url}`);
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("pdf")) continue;
    return parseDailySolarReductionText(pdfToText(new Uint8Array(await res.arrayBuffer())), dateKey, url);
  }
  return null;
}

async function fetchRecentDailySummaries(now = new Date()): Promise<DailySolarReductionSummary[]> {
  assertPdfToTextAvailable();
  const summaries: DailySolarReductionSummary[] = [];
  for (
    let startAge = 1;
    startAge <= DAILY_SUMMARY_LOOKBACK_DAYS && summaries.length < DAILY_SUMMARY_TARGET_DAYS;
    startAge += DAILY_SUMMARY_FETCH_BATCH_SIZE
  ) {
    const dates = Array.from({ length: DAILY_SUMMARY_FETCH_BATCH_SIZE }, (_, i) =>
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - startAge - i)),
    ).filter((date) => {
      const age = Math.round((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - date.getTime()) / 86_400_000);
      return age <= DAILY_SUMMARY_LOOKBACK_DAYS;
    });
    const batch = await Promise.all(dates.map((date) => fetchDailySummary(date).catch(() => null)));
    summaries.push(...batch.filter((summary): summary is DailySolarReductionSummary => summary !== null));
  }
  summaries.sort((a, b) => a.date.localeCompare(b.date));
  const latest = summaries.slice(-DAILY_SUMMARY_TARGET_DAYS);
  if (latest.length < 7) {
    throw new Error(`Chile daily summaries yielded only ${latest.length} parseable days`);
  }
  return latest;
}

function hourlyShapeFractions(points: CurtailmentPoint[]): number[] {
  const sums = new Array(24).fill(0);
  for (const point of points) {
    const hour = new Date(point.utcTimestamp).getUTCHours();
    sums[hour] += Math.max(0, point.mw);
  }
  const total = sums.reduce((sum, value) => sum + value, 0);
  if (total <= 0) throw new Error("Chile monthly XLSX contained no positive solar reduction shape");
  return sums.map((value) => value / total);
}

export function dailySummariesToHourlyPoints(
  summaries: DailySolarReductionSummary[],
  monthlyShapePoints: CurtailmentPoint[],
): CurtailmentPoint[] {
  const fractions = hourlyShapeFractions(monthlyShapePoints);
  return summaries.flatMap((summary) => {
    const [year, month, day] = summary.date.split("-").map(Number);
    return fractions.map((fraction, hour) => ({
      utcTimestamp: new Date(Date.UTC(year, month - 1, day, hour)).toISOString(),
      mw: summary.solarReductionMwh * fraction,
    }));
  });
}

function buildRegionData(points: CurtailmentPoint[], sourceNote: string): RegionData {
  return {
    regionId: "atacama",
    profile: timeOfDayAverageGW(points),
    latestProfile: latestCompleteUtcDayProfileGW(points),
    totalTWh: totalTWh30d(points),
    peakGW: peakGW(points),
    lastUpdated: points.at(-1)?.utcTimestamp ?? new Date().toISOString(),
    sourceNote,
  };
}

async function fetchMonthlyRegion(): Promise<{ data: RegionData; points: CurtailmentPoint[]; url: string }> {
  const { url, bytes } = await fetchLatestWorkbook();
  const points = hourlyAverage(parseCoordinadorSolarXlsx(bytes));
  if (points.length === 0) throw new Error("Chile XLSX contained no parseable solar reduction points");
  return {
    data: buildRegionData(points, `Coordinador Chile direct monthly XLSX solar reductions from ${url}`),
    points,
    url,
  };
}

const run = async (): Promise<RegionData> => {
  const monthly = await fetchMonthlyRegion();
  try {
    const summaries = await fetchRecentDailySummaries();
    const points = dailySummariesToHourlyPoints(summaries, monthly.points);
    return buildRegionData(
      points,
      `Coordinador Chile daily Resumen Ejecutivo solar reductions (${summaries.length} daily PDFs through ${summaries.at(-1)?.date}) apportioned with measured monthly XLSX hourly shape from ${monthly.url}; latest daily PDF ${summaries.at(-1)?.url}`,
    );
  } catch (err) {
    console.warn(`atacama-chile daily summary fetch failed, using monthly XLSX: ${(err as Error).message}`);
    return monthly.data;
  }
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<RegionData>("atacama-chile", run, {
    tagLive: (result) => ({ ...result, sourceStatus: "live" as const }),
    tagCached: (cached) => ({ ...cached, sourceStatus: "cached" as const }),
  })
    .then((data) => {
      process.stdout.write(JSON.stringify(data));
    })
    .catch((err) => {
      console.error("atacama-chile loader failed", err);
      process.exit(1);
    });
}
