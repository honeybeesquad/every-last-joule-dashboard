import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fetchText } from "../lib/fetch.js";
import type { CurtailmentPoint } from "../lib/types.js";

const PAGE_URLS = [
  "https://www.coordinador.cl/operacion/documentos/reducciones-de-generacion-renovable/reducciones-erv-2026/",
  "https://www.coordinador.cl/operacion/documentos/reducciones-de-generacion-renovable/reducciones-erv-2025/",
];

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

function normaliseSheetName(value: string): string {
  return decodeXml(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function excelSerialToDate(serial: number): Date {
  return new Date(Date.UTC(1899, 11, 30) + serial * 24 * 3600 * 1000);
}

function chileUtcOffsetHours(month: number): number {
  // Chile generally observes UTC-3 in summer and UTC-4 in winter. Monthly
  // reduction files are coarse enough that this heuristic is sufficient.
  return month >= 5 && month <= 8 ? 4 : 3;
}

export function parseCenNumber(value: string): number {
  const clean = value.trim().replace(/\s+/g, "");
  if (clean.includes(",") && clean.includes(".")) {
    return Number(clean.lastIndexOf(",") > clean.lastIndexOf(".")
      ? clean.replace(/\./g, "").replace(",", ".")
      : clean.replace(/,/g, ""));
  }
  return Number(clean.replace(",", "."));
}

export async function fetchBytes(url: string, init: RequestInit = {}, timeoutMs = 12000): Promise<Response> {
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

function findSheetPath(workbookXml: string, relsXml: string, sheetName: string): string {
  const target = normaliseSheetName(sheetName);
  for (const sheet of workbookXml.matchAll(/<sheet\b[^>]*>/g)) {
    const tag = sheet[0];
    const name = tag.match(/name="([^"]+)"/)?.[1];
    const id = tag.match(/r:id="([^"]+)"/)?.[1];
    if (!name || !id || normaliseSheetName(name) !== target) continue;
    const rel = new RegExp(`<Relationship[^>]*Id="${id}"[^>]*Target="([^"]+)"`).exec(relsXml);
    if (!rel) throw new Error(`Chile workbook missing relationship for ${sheetName}`);
    return `xl/${rel[1].replace(/^\//, "")}`;
  }
  throw new Error(`Chile workbook missing ${sheetName} sheet`);
}

function parseCoordinadorReductionXlsx(
  zipBytes: Uint8Array,
  sheetName: string,
  plantPrefix: string,
): CurtailmentPoint[] {
  const workbookXml = unzipText(zipBytes, "xl/workbook.xml");
  const relsXml = unzipText(zipBytes, "xl/_rels/workbook.xml.rels");
  const sharedStrings = parseSharedStrings(unzipText(zipBytes, "xl/sharedStrings.xml"));
  const sheetXml = unzipText(zipBytes, findSheetPath(workbookXml, relsXml, sheetName));
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
    if (!currentDate || !plant.startsWith(plantPrefix)) continue;
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

export function parseCoordinadorSolarXlsx(zipBytes: Uint8Array): CurtailmentPoint[] {
  return parseCoordinadorReductionXlsx(zipBytes, "Resumen-DiarioHorario-Solar", "PFV-");
}

export function parseCoordinadorWindXlsx(zipBytes: Uint8Array): CurtailmentPoint[] {
  return parseCoordinadorReductionXlsx(zipBytes, "Resumen-DiarioHorario-Eolico", "PE-");
}

function latestXlsxUrl(html: string, baseUrl: string): string | null {
  const urls = Array.from(html.matchAll(/href="([^"]+\.xlsx)"/gi))
    .map((match) => new URL(decodeXml(match[1]), baseUrl).toString())
    .filter((url) => /Reducciones-de-Energia-Eolica-Solar/i.test(url));
  return urls[0] ?? null;
}

let latestWorkbookPromise: Promise<{ url: string; bytes: Uint8Array }> | null = null;

async function fetchLatestWorkbookUncached(): Promise<{ url: string; bytes: Uint8Array }> {
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

export async function fetchLatestWorkbook(): Promise<{ url: string; bytes: Uint8Array }> {
  latestWorkbookPromise ??= fetchLatestWorkbookUncached();
  return latestWorkbookPromise;
}
