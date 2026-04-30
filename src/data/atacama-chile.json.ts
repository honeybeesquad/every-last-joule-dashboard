import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  fetchBytes,
  fetchLatestWorkbook,
  parseCenNumber,
  parseCoordinadorSolarXlsx,
} from "./chile-cen-reductions.js";
import { hourlyAverage } from "../lib/csv.js";
import { latestCompleteUtcDayProfileGW, peakGW, timeOfDayAverageGW, totalTWh30d } from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";

const DAILY_SUMMARY_LOOKBACK_DAYS = 45;
const DAILY_SUMMARY_TARGET_DAYS = 30;
const DAILY_SUMMARY_FETCH_BATCH_SIZE = 6;

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
    lastSuccessAt: points.at(-1)?.utcTimestamp ?? new Date().toISOString(),
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
    regionTier: "live" as const,
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
