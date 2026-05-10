import { pathToFileURL } from "node:url";
import { fetchHttp1Bytes } from "../lib/fetch.js";
import { latestCompleteUtcDayProfileGW, peakGW, timeOfDayAverageGW, totalTWh30d } from "../lib/profile.js";
import { buildTypicalSolarRegion } from "../lib/typical-profiles.js";
import { withFallback } from "../lib/resilient.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";

/**
 * Japan — TEPCO Power Grid (東京電力パワーグリッド) area-demand CSV → curtailment proxy.
 *
 * Endpoint investigation 2026-05-10:
 *   - juyo-d-j.csv: HTTP 404 (filename changed).
 *   - juyo-d1-j.csv: live (HTTP 200) but demand/forecast only — no 太陽光 solar column.
 *   - Solar data IS available in monthly eria_jukyu_YYYYMM_03.csv (30-min, columns
 *     太陽光発電実績 + 太陽光出力制御量 in MW). URL:
 *     https://www.tepco.co.jp/forecast/html/images/eria_jukyu_YYYYMM_03.csv
 *   - The monthly CSV is a viable replacement source but requires a new URL scheme
 *     (YYYYMM-keyed, not YYYYMMDD) and a different parser (30-min intervals, MW units,
 *     multi-column generation mix). That rewrite is deferred.
 *
 * Status: T1 BLOCKED pending loader migration to monthly area CSV. Downgraded to
 * tier "estimated". Loader emits typical-shape from buildTypicalSolarRegion.
 *
 * Future: Migrate to eria_jukyu_YYYYMM_03.csv, parse 太陽光発電実績 column (MW, 30-min),
 * and use 太陽光出力制御量 directly rather than the RATE proxy approach.
 * The parseTepcoCsv / buildTepcoRegionData helpers are retained for future use.
 *
 * Calibration: OCCTO FY2024 TEPCO area curtailment ≈ 0.05 TWh/yr.
 * Solar peak UTC: 03:00 (noon JST = 03:00 UTC for lon ~139.7°E)
 */
const REGION_ID = "japan-tepco";
const RATE = 0.01;
const LIVE_URL = "https://www.tepco.co.jp/forecast/html/images/juyo-d-j.csv";
/** 万kW → MW */
const TENK_KW_TO_MW = 10;
/** Japan Standard Time offset from UTC, hours */
const JST_OFFSET_HOURS = 9;
/** 5-minute interval expressed as a fraction of an hour */
const INTERVAL_HOURS = 5 / 60;

export interface TepcoParsed {
  points: CurtailmentPoint[];
  solarMwSum: number;
  sampleCount: number;
}

/**
 * Parse a Shift-JIS-decoded TEPCO daily CSV string.
 * Locates the 5-min solar section by the 4-column DATE,TIME header signature.
 * Used for testing/future activation when the live endpoint becomes accessible.
 */
export function parseTepcoCsv(decoded: string): TepcoParsed {
  const lines = decoded.split(/\r?\n/);

  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith("DATE,TIME")) continue;
    const cells = line.split(",");
    if (cells.length === 4) {
      startIdx = i + 1;
      break;
    }
  }
  if (startIdx < 0) {
    return { points: [], solarMwSum: 0, sampleCount: 0 };
  }

  const points: CurtailmentPoint[] = [];
  let solarMwSum = 0;
  let sampleCount = 0;

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    if (!line) break;
    const cells = line.split(",");
    if (cells.length < 4) break;

    const dateRaw = cells[0]?.trim();
    const timeRaw = cells[1]?.trim();
    const solarTenkKwRaw = cells[3]?.trim();
    if (!dateRaw || !timeRaw || solarTenkKwRaw === undefined || solarTenkKwRaw === "") continue;

    const utcTimestamp = jstDateTimeToIsoUtc(dateRaw, timeRaw);
    if (!utcTimestamp) continue;

    const solarTenkKw = Number(solarTenkKwRaw);
    if (!Number.isFinite(solarTenkKw)) continue;
    const solarMw = Math.max(0, solarTenkKw) * TENK_KW_TO_MW;
    solarMwSum += solarMw;
    sampleCount += 1;

    points.push({
      utcTimestamp,
      mw: solarMw * RATE,
      intervalHours: INTERVAL_HOURS,
    });
  }

  return { points, solarMwSum, sampleCount };
}

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

export function buildTepcoRegionData(points: CurtailmentPoint[], nowIso: string): RegionData {
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
      "TEPCO Power Grid juyo CSV (5-min solar 万kW) × 1% calibrated curtailment (OCCTO FY2024 TEPCO anchor: ~0.05 TWh/yr)",
  };
}

const run = async (): Promise<RegionData> => {
  const now = new Date();

  // Try live fetch; fall back to typical-shape if WAF blocks or no data.
  try {
    const buf = await fetchHttp1Bytes(LIVE_URL, 30000);
    const decoded = new TextDecoder("shift-jis").decode(buf);
    const parsed = parseTepcoCsv(decoded);
    if (parsed.points.length > 0) {
      parsed.points.sort((a, b) => a.utcTimestamp.localeCompare(b.utcTimestamp));
      return buildTepcoRegionData(parsed.points, now.toISOString());
    }
  } catch (err) {
    console.warn(`tepco live fetch failed: ${(err as Error).message} — using typical-shape fallback`);
  }

  // Fallback: typical solar shape anchored to OCCTO FY2024 estimate.
  // Solar peak UTC 03:00 (noon JST). Annual TWh ~0.05.
  return buildTypicalSolarRegion(
    REGION_ID,
    3, // peakHourUtc
    0.05,
    "TEPCO Power Grid (東京電力パワーグリッド) — live CSV blocked by WAF; typical solar shape × OCCTO FY2024 TEPCO anchor ~0.05 TWh/yr",
    "2024",
  );
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<RegionData>(REGION_ID, run, {
    regionTier: "estimated" as const,
    tagLive: (r) => ({ ...r, sourceStatus: "live" as const }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" as const }),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("japan-tepco loader failed", err);
      process.exit(1);
    });
}
