import { pathToFileURL } from "node:url";
import { fetchHttp1Bytes } from "../lib/fetch.js";
import { latestCompleteUtcDayProfileGW, peakGW, timeOfDayAverageGW, totalTWh30d } from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";

/**
 * Japan — Tohoku Electric area supply/demand CSV → live per-fuel curtailment.
 *
 * Endpoint:
 *   https://setsuden.nw.tohoku-epco.co.jp/common/demand/realtime_jukyu/
 *     realtime_jukyu_YYYYMMDD_02.csv
 *
 * Published daily (current day + prior days). Encoding: Shift-JIS.
 * Interval: 30 minutes. Units: MW (header says 単位[MW平均]).
 *
 * CSV structure (Shift-JIS decoded):
 *   Row 0: 単位[MW平均],,供給力  (comment)
 *   Row 1: DATE,TIME,エリア需要,原子力,火力(LNG),火力(石炭),火力(石油),
 *           火力(その他),火力出力制御量,水力,地熱,バイオマス,バイオマス出力制御量,
 *           太陽光発電実績,太陽光出力制御量,風力発電実績,風力出力制御量,
 *           揚水,蓄電池,連系線,その他,合計
 *   Row 2+: data rows
 *
 * Per-fuel split (2026-06-17): 30-day measurement found wind curtailment
 * material at ~12.3% of total (13.5 GWh/30d). Emits two RegionData:
 *   japan-tohoku-solar — 太陽光出力制御量 column only
 *   japan-tohoku-wind  — 風力出力制御量 column only
 *
 * Fetch strategy: HTTP/1.1-forced HTTPS (same WAF bypass as Kyushu loader) via
 * fetchHttp1Bytes from src/lib/fetch.ts. Loop: daily back 30 days.
 */
const BASE_URL =
  "https://setsuden.nw.tohoku-epco.co.jp/common/demand/realtime_jukyu";
/** 30-minute interval expressed as a fraction of an hour, for totalTWh30d */
const INTERVAL_HOURS = 0.5;
/** Japan Standard Time offset from UTC, hours */
const JST_OFFSET_HOURS = 9;

/** A per-30-min sample preserving solar and wind MW separately. */
interface TohokuPoint extends CurtailmentPoint {
  solarMw: number;
  windMw: number;
}

export interface TohokuParsed {
  points: TohokuPoint[];
  /** Total solar curtailment MW across all 30-min samples — diagnostic. */
  solarCurtMwSum: number;
  /** Total wind curtailment MW across all 30-min samples — diagnostic. */
  windCurtMwSum: number;
  /** Number of 30-min samples parsed. */
  sampleCount: number;
}

/**
 * Parse a Shift-JIS-decoded Tohoku Electric daily CSV string.
 * Locates the header row (starts with "DATE,TIME"), reads column indices for
 * 太陽光出力制御量 and 風力出力制御量 by header position, then accumulates
 * per-fuel curtailment MW for each 30-min interval.
 */
export function parseTohokuCsv(decoded: string): TohokuParsed {
  const lines = decoded.split(/\r?\n/);

  // Find the header row to locate the curtailment columns by name.
  let headerIdx = -1;
  let solarCurtCol = -1;
  let windCurtCol = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith("DATE,TIME")) continue;
    headerIdx = i;
    const headers = line.split(",");
    for (let c = 0; c < headers.length; c++) {
      const h = headers[c].trim();
      if (h === "太陽光出力制御量") solarCurtCol = c;
      if (h === "風力出力制御量") windCurtCol = c;
    }
    break;
  }

  if (headerIdx < 0 || solarCurtCol < 0 || windCurtCol < 0) {
    return { points: [], solarCurtMwSum: 0, windCurtMwSum: 0, sampleCount: 0 };
  }

  const points: TohokuPoint[] = [];
  let solarCurtMwSum = 0;
  let windCurtMwSum = 0;
  let sampleCount = 0;

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.startsWith("2")) break; // blank line or non-data ends section
    const cells = line.split(",");
    if (cells.length < Math.max(solarCurtCol, windCurtCol) + 1) continue;

    const dateRaw = cells[0]?.trim();
    const timeRaw = cells[1]?.trim();
    if (!dateRaw || !timeRaw) continue;

    const utcTimestamp = jstDateTimeToIsoUtc(dateRaw, timeRaw);
    if (!utcTimestamp) continue;

    const solarMw = Math.max(0, Number(cells[solarCurtCol]?.trim() ?? "0") || 0);
    const windMw = Math.max(0, Number(cells[windCurtCol]?.trim() ?? "0") || 0);
    const totalMw = solarMw + windMw;

    solarCurtMwSum += solarMw;
    windCurtMwSum += windMw;
    sampleCount += 1;

    points.push({
      utcTimestamp,
      mw: totalMw,
      intervalHours: INTERVAL_HOURS,
      solarMw,
      windMw,
    });
  }

  return { points, solarCurtMwSum, windCurtMwSum, sampleCount };
}

/**
 * Convert Tohoku CSV's `YYYY/M/D` + `H:MM` (JST) to an ISO-8601 UTC string.
 * Returns undefined if the input does not parse cleanly.
 */
function jstDateTimeToIsoUtc(dateRaw: string, timeRaw: string): string | undefined {
  const dateMatch = dateRaw.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  const timeMatch = timeRaw.match(/^(\d{1,2}):(\d{2})$/);
  if (!dateMatch || !timeMatch) return undefined;
  const [, yyyy, mm, dd] = dateMatch;
  const [, hh, mn] = timeMatch;
  const utcMs = Date.UTC(
    Number(yyyy),
    Number(mm) - 1,
    Number(dd),
    Number(hh) - JST_OFFSET_HOURS,
    Number(mn),
    0,
    0,
  );
  if (!Number.isFinite(utcMs)) return undefined;
  return new Date(utcMs).toISOString();
}

function formatYyyymmdd(d: Date): string {
  return [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, "0"),
    String(d.getUTCDate()).padStart(2, "0"),
  ].join("");
}

/**
 * Fetch a single day's Tohoku CSV as bytes, decode as Shift-JIS, parse out
 * the curtailment columns. Network errors propagate to the caller (logged and
 * skipped). Uses HTTP/1.1-forced TLS connection to bypass WAF fingerprinting.
 */
async function fetchTohokuDay(
  yyyymmdd: string,
  timeoutMs = 30000,
  retries = 2,
  backoffMs = 750,
): Promise<TohokuParsed> {
  const url = `${BASE_URL}/realtime_jukyu_${yyyymmdd}_02.csv`;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const buf = await fetchHttp1Bytes(url, timeoutMs);
      const decoded = new TextDecoder("shift-jis").decode(buf);
      return parseTohokuCsv(decoded);
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, backoffMs * (attempt + 1)));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/**
 * Fetch and aggregate Tohoku Electric supply/demand CSVs for the last 30 days,
 * then build two RegionData (solar + wind) from the per-fuel point split.
 */
const run = async (): Promise<Record<string, RegionData>> => {
  const now = new Date();
  const days: string[] = [];
  for (let daysAgo = 0; daysAgo < 30; daysAgo++) {
    const d = new Date(now.getTime() - daysAgo * 24 * 3600 * 1000);
    days.push(formatYyyymmdd(d));
  }

  const parsedDays: TohokuParsed[] = [];
  for (const yyyymmdd of days) {
    try {
      parsedDays.push(await fetchTohokuDay(yyyymmdd));
    } catch (err) {
      console.warn(`tohoku fetch skipped ${yyyymmdd}: ${(err as Error).message}`);
      parsedDays.push({ points: [], solarCurtMwSum: 0, windCurtMwSum: 0, sampleCount: 0 });
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  const allPoints = parsedDays.flatMap((p) => p.points);
  if (allPoints.length === 0) {
    throw new Error("Tohoku Electric returned no usable curtailment rows for the trailing 30 days");
  }
  allPoints.sort((a, b) => a.utcTimestamp.localeCompare(b.utcTimestamp));

  const lastTs = allPoints.at(-1)?.utcTimestamp ?? now.toISOString();

  // Build per-fuel point arrays for separate RegionData
  const solarPoints: CurtailmentPoint[] = allPoints.map((p) => ({
    utcTimestamp: p.utcTimestamp,
    mw: p.solarMw,
    intervalHours: p.intervalHours,
  }));
  const windPoints: CurtailmentPoint[] = allPoints.map((p) => ({
    utcTimestamp: p.utcTimestamp,
    mw: p.windMw,
    intervalHours: p.intervalHours,
  }));

  const SOLAR_SOURCE_NOTE =
    "Tohoku Electric area supply/demand CSV (realtime_jukyu_YYYYMMDD_02.csv) — " +
    "太陽光出力制御量 column (MW, 30-min, Shift-JIS). Solar share of measured curtailment.";
  const WIND_SOURCE_NOTE =
    "Tohoku Electric area supply/demand CSV (realtime_jukyu_YYYYMMDD_02.csv) — " +
    "風力出力制御量 column (MW, 30-min, Shift-JIS). Wind share of measured curtailment (~12.3% of total, 13.5 GWh/30d).";

  const solar: RegionData = {
    regionId: "japan-tohoku-solar",
    profile: timeOfDayAverageGW(solarPoints),
    latestProfile: latestCompleteUtcDayProfileGW(solarPoints),
    totalTWh: totalTWh30d(solarPoints),
    peakGW: peakGW(solarPoints),
    lastUpdated: lastTs,
    lastSuccessAt: lastTs,
    sourceNote: SOLAR_SOURCE_NOTE,
    fuelShare: { solar: 1 },
  };

  const wind: RegionData = {
    regionId: "japan-tohoku-wind",
    profile: timeOfDayAverageGW(windPoints),
    latestProfile: latestCompleteUtcDayProfileGW(windPoints),
    totalTWh: totalTWh30d(windPoints),
    peakGW: peakGW(windPoints),
    lastUpdated: lastTs,
    lastSuccessAt: lastTs,
    sourceNote: WIND_SOURCE_NOTE,
    fuelShare: { wind: 1 },
  };

  return { "japan-tohoku-solar": solar, "japan-tohoku-wind": wind };
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<Record<string, RegionData>>("japan-tohoku", run, {
    regionTier: "live" as const,
    tagLive: (r) => {
      const tagged: Record<string, RegionData> = {};
      for (const [k, v] of Object.entries(r)) tagged[k] = { ...v, sourceStatus: "live" as const };
      return tagged;
    },
    tagCached: (c) => {
      const tagged: Record<string, RegionData> = {};
      for (const [k, v] of Object.entries(c as Record<string, RegionData>)) tagged[k] = { ...v, sourceStatus: "cached" as const };
      return tagged;
    },
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("japan-tohoku loader failed", err);
      process.exit(1);
    });
}
