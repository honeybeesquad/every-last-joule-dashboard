import { pathToFileURL } from "node:url";
import { fetchHttp1Bytes } from "../lib/fetch.js";
import { latestCompleteUtcDayProfileGW, peakGW, timeOfDayAverageGW, totalTWh30d } from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";

/**
 * Japan — Hokuriku Electric Power (北陸電力送配電) area-demand CSV → live curtailment proxy.
 *
 * Endpoint: https://www.rikuden.co.jp/nw/denki-yoho/csv/juyo_05_YYYYMMDD.csv
 *
 * CSV structure: Shift-JIS encoding, multi-section layout. The 5-minute-interval
 * solar section has a 4-column header:
 *   DATE,TIME,当日実績（５分間隔値）(万kW),太陽光発電実績（５分間隔値）(万kW)
 * (note: full-width parentheses used in Hokuriku's header, unlike Kyushu's half-width)
 *
 * Encoding: Shift-JIS
 * Units: 万kW (× 10 = MW)
 * Interval: 5 minutes
 *
 * Calibration: RATE = 0.01. OCCTO FY2024 Hokuriku area curtailment ≈ 0.02 TWh/yr
 * against ~2 TWh/yr solar generation (~1%). Reference: OCCTO 再生可能エネルギーの
 * 出力制御の見通しに関するレポート (FY2024 edition, verified 2026-05-02).
 *
 * Fetch strategy: HTTP/1.1-forced HTTPS via fetchHttp1Bytes.
 * Loop: daily back 30 days.
 */
const REGION_ID = "japan-hokuriku";
const RATE = 0.01;
const BASE_URL = "https://www.rikuden.co.jp/nw/denki-yoho/csv";
/** 万kW → MW */
const TENK_KW_TO_MW = 10;
/** Japan Standard Time offset from UTC, hours */
const JST_OFFSET_HOURS = 9;
/** 5-minute interval expressed as a fraction of an hour */
const INTERVAL_HOURS = 5 / 60;

export interface HokurikuParsed {
  points: CurtailmentPoint[];
  solarMwSum: number;
  sampleCount: number;
}

/**
 * Parse a Shift-JIS-decoded Hokuriku Electric daily CSV string.
 * Locates the 5-min solar section by the 4-column DATE,TIME header signature.
 * Header uses full-width parentheses: 当日実績（５分間隔値）(万kW)
 */
export function parseHokurikuCsv(decoded: string): HokurikuParsed {
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

export function buildHokurikuRegionData(points: CurtailmentPoint[], nowIso: string): RegionData {
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
      "Hokuriku Electric juyo CSV (5-min solar 万kW) × 1% calibrated curtailment (OCCTO FY2024 Hokuriku anchor: ~0.02 TWh/yr)",
  };
}

async function fetchHokurikuDay(
  yyyymmdd: string,
  timeoutMs = 30000,
  retries = 2,
  backoffMs = 750,
): Promise<HokurikuParsed> {
  const url = `${BASE_URL}/juyo_05_${yyyymmdd}.csv`;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const buf = await fetchHttp1Bytes(url, timeoutMs);
      const decoded = new TextDecoder("shift-jis").decode(buf);
      return parseHokurikuCsv(decoded);
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, backoffMs * (attempt + 1)));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

function formatYyyymmdd(d: Date): string {
  return [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, "0"),
    String(d.getUTCDate()).padStart(2, "0"),
  ].join("");
}

const run = async (): Promise<RegionData> => {
  const now = new Date();
  const days: string[] = [];
  for (let daysAgo = 0; daysAgo < 30; daysAgo++) {
    const d = new Date(now.getTime() - daysAgo * 24 * 3600 * 1000);
    days.push(formatYyyymmdd(d));
  }

  const parsedDays: HokurikuParsed[] = [];
  for (const yyyymmdd of days) {
    try {
      parsedDays.push(await fetchHokurikuDay(yyyymmdd));
    } catch (err) {
      console.warn(`hokuriku fetch skipped ${yyyymmdd}: ${(err as Error).message}`);
      parsedDays.push({ points: [], solarMwSum: 0, sampleCount: 0 });
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  const allPoints = parsedDays.flatMap((p) => p.points);
  if (allPoints.length === 0) {
    throw new Error("Hokuriku Electric returned no usable solar generation rows for the trailing 30 days");
  }
  allPoints.sort((a, b) => a.utcTimestamp.localeCompare(b.utcTimestamp));

  return buildHokurikuRegionData(allPoints, now.toISOString());
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
      console.error("japan-hokuriku loader failed", err);
      process.exit(1);
    });
}
