import { pathToFileURL } from "node:url";
import { fetchHttp1Bytes } from "../lib/fetch.js";
import { latestCompleteUtcDayProfileGW, peakGW, timeOfDayAverageGW, totalTWh30d } from "../lib/profile.js";
import { buildTypicalSolarRegion } from "../lib/typical-profiles.js";
import { withFallback } from "../lib/resilient.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";

/**
 * Japan — Okinawa Electric Power (沖縄電力) area supply/demand CSV → live curtailment.
 *
 * Endpoint:
 *   https://www.okiden.co.jp/business-support/service/supply-and-demand/csv/
 *     eria_jukyu_YYYYMM_10.csv
 *
 * Published monthly (one file per calendar month). Encoding: Shift-JIS.
 * Interval: 30 minutes. Units: MW (values are MW directly, no scaling needed).
 *
 * CSV structure (Shift-JIS decoded, 22 columns):
 *   Row 0: comment/unit row (may vary)
 *   Row 1: DATE,TIME,エリア需要,原子力,火力(LNG),火力(石炭),火力(石油),
 *           火力(その他),火力出力制御量,水力,地熱,バイオマス,バイオマス出力制御量,
 *           太陽光発電実績,太陽光出力制御量,風力発電実績,風力出力制御量,
 *           揚水,蓄電池,連系線,その他,合計
 *   Row 2+: data rows
 *
 * Relevant column indices (0-based after DATE=0, TIME=1):
 *   13 → 太陽光発電実績    (solar generation MW)   — diagnostic
 *   14 → 太陽光出力制御量  (solar curtailment MW)  — direct value, no scaling
 *   15 → 風力発電実績      (wind generation MW)    — diagnostic
 *   16 → 風力出力制御量    (wind curtailment MW)   — direct value, no scaling
 *
 * Both curtailment columns are summed to form total curtailment MW per 30-min slot.
 *
 * Fetch strategy: try current month's CSV, then previous month as fallback.
 * Falls back to buildTypicalSolarRegion if both fetches fail.
 *
 * Solar peak UTC: 03:00 (noon JST = 03:00 UTC for lon ~127.7°E, Naha)
 */
const REGION_ID = "japan-okinawa";
const BASE_URL =
  "https://www.okiden.co.jp/business-support/service/supply-and-demand/csv";
/** 30-minute interval expressed as a fraction of an hour, for totalTWh30d */
const INTERVAL_HOURS = 0.5;
/** Japan Standard Time offset from UTC, hours */
const JST_OFFSET_HOURS = 9;

export interface OkinawaParsed {
  points: CurtailmentPoint[];
  /** Total solar curtailment MW across all 30-min samples — diagnostic. */
  solarCurtMwSum: number;
  /** Total wind curtailment MW across all 30-min samples — diagnostic. */
  windCurtMwSum: number;
  /** Number of 30-min samples parsed. */
  sampleCount: number;
}

/**
 * Parse a Shift-JIS-decoded Okinawa Electric monthly CSV string.
 * Locates the header row (contains エリア需要 or 太陽光発電実績), reads column
 * indices for 太陽光出力制御量 and 風力出力制御量 by header name, then accumulates
 * curtailment MW for each 30-min interval.
 */
export function parseOkinawaCsv(decoded: string): OkinawaParsed {
  const lines = decoded.split(/\r?\n/);

  // Find the header row to locate the curtailment columns by name.
  let headerIdx = -1;
  let solarCurtCol = -1;
  let windCurtCol = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith("DATE,TIME")) continue;
    // Confirm this is the 22-column data header by checking for a known column.
    if (!line.includes("エリア需要") && !line.includes("太陽光発電実績")) continue;
    headerIdx = i;
    const headers = line.split(",");
    for (let c = 0; c < headers.length; c++) {
      const h = headers[c].trim();
      if (h === "太陽光出力制御量") solarCurtCol = c;
      if (h === "風力出力制御量") windCurtCol = c;
    }
    break;
  }

  if (headerIdx < 0 || solarCurtCol < 0) {
    return { points: [], solarCurtMwSum: 0, windCurtMwSum: 0, sampleCount: 0 };
  }

  const points: CurtailmentPoint[] = [];
  let solarCurtMwSum = 0;
  let windCurtMwSum = 0;
  let sampleCount = 0;

  const minCols = windCurtCol >= 0
    ? Math.max(solarCurtCol, windCurtCol) + 1
    : solarCurtCol + 1;

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.startsWith("2")) break; // blank or non-data row ends section
    const cells = line.split(",");
    if (cells.length < minCols) continue;

    const dateRaw = cells[0]?.trim();
    const timeRaw = cells[1]?.trim();
    if (!dateRaw || !timeRaw) continue;

    const utcTimestamp = jstDateTimeToIsoUtc(dateRaw, timeRaw);
    if (!utcTimestamp) continue;

    const solarMw = Math.max(0, Number(cells[solarCurtCol]?.trim() ?? "0") || 0);
    const windMw = windCurtCol >= 0
      ? Math.max(0, Number(cells[windCurtCol]?.trim() ?? "0") || 0)
      : 0;
    const totalMw = solarMw + windMw;

    solarCurtMwSum += solarMw;
    windCurtMwSum += windMw;
    sampleCount += 1;

    points.push({
      utcTimestamp,
      mw: totalMw,
      intervalHours: INTERVAL_HOURS,
    });
  }

  return { points, solarCurtMwSum, windCurtMwSum, sampleCount };
}

/**
 * Convert Okinawa CSV's `YYYY/M/D` + `H:MM` (JST) to an ISO-8601 UTC string.
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

/**
 * Build an Okinawa RegionData payload from the parsed pointset.
 * Extracted for fixture-test reuse.
 */
export function buildOkinawaRegionData(points: CurtailmentPoint[], nowIso: string): RegionData {
  const lastTs = points.at(-1)?.utcTimestamp ?? nowIso;
  return {
    regionId: REGION_ID,
    profile: timeOfDayAverageGW(points),
    latestProfile: latestCompleteUtcDayProfileGW(points),
    totalTWh: totalTWh30d(points),
    peakGW: peakGW(points),
    lastUpdated: lastTs,
    lastSuccessAt: lastTs,
    sourceNote:
      "Okinawa Electric area supply/demand CSV (eria_jukyu_YYYYMM_10.csv) — " +
      "direct 太陽光出力制御量+風力出力制御量 columns (MW, 30-min intervals). " +
      "Source restructured 2026-05; values are actual curtailment, not rate-derived.",
  };
}

/** Format a Date as YYYYMM for the monthly CSV filename. */
function formatYyyyMm(d: Date): string {
  return [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, "0"),
  ].join("");
}

/**
 * Fetch a single month's Okinawa CSV as bytes, decode as Shift-JIS, parse out
 * the curtailment columns. Throws on network error or HTTP non-200.
 */
async function fetchOkinawaMonth(yyyymm: string, timeoutMs = 30000): Promise<OkinawaParsed> {
  const url = `${BASE_URL}/eria_jukyu_${yyyymm}_10.csv`;
  const buf = await fetchHttp1Bytes(url, timeoutMs);
  const decoded = new TextDecoder("shift-jis").decode(buf);
  return parseOkinawaCsv(decoded);
}

const run = async (): Promise<RegionData> => {
  const now = new Date();

  // Try the current month's CSV, then the previous month as fallback.
  const monthsToTry: string[] = [formatYyyyMm(now)];
  const prevMonth = new Date(now.getTime());
  prevMonth.setUTCDate(1); // move to first of this month
  prevMonth.setUTCMonth(prevMonth.getUTCMonth() - 1); // step back one month
  monthsToTry.push(formatYyyyMm(prevMonth));

  for (const yyyymm of monthsToTry) {
    try {
      const parsed = await fetchOkinawaMonth(yyyymm);
      if (parsed.points.length > 0) {
        parsed.points.sort((a, b) => a.utcTimestamp.localeCompare(b.utcTimestamp));
        return buildOkinawaRegionData(parsed.points, now.toISOString());
      }
      console.warn(`okinawa ${yyyymm}: fetched ok but no usable rows — trying next month`);
    } catch (err) {
      console.warn(`okinawa ${yyyymm} fetch failed: ${(err as Error).message} — trying next month`);
    }
  }

  // Fallback: typical solar shape anchored to OCCTO FY2024 estimate.
  // Solar peak UTC 03:00 (noon JST). Annual TWh ~0.04.
  return buildTypicalSolarRegion(
    REGION_ID,
    3, // peakHourUtc
    0.04,
    "Okinawa Electric Power (沖縄電力) — monthly CSV not accessible; typical solar shape × OCCTO FY2024 Okinawa anchor ~0.04 TWh/yr",
    "2024",
  );
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<RegionData>(REGION_ID, run, {
    regionTier: "live" as const,
    tagLive: (r) => ({ ...r, sourceStatus: "live" as const }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" as const }),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("japan-okinawa loader failed", err);
      process.exit(1);
    });
}
