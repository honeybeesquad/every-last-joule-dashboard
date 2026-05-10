import { pathToFileURL } from "node:url";
import { fetchHttp1Bytes } from "../lib/fetch.js";
import { latestCompleteUtcDayProfileGW, peakGW, timeOfDayAverageGW, totalTWh30d } from "../lib/profile.js";
import { buildTypicalSolarRegion } from "../lib/typical-profiles.js";
import { withFallback } from "../lib/resilient.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";

/**
 * Japan — Hokkaido Electric Power (北海道電力) area-demand CSV → curtailment proxy.
 *
 * Endpoint investigation 2026-05-10:
 *   - juyo_01_YYYYMMDD.csv: live (HTTP 200, confirmed 2026-05-10).
 *   - HOWEVER: the 4-column 5-min section header is:
 *       DATE,TIME,電力需要(5分間隔値)(MW),再生可能エネルギー出力(5分間隔値)(MW)
 *     Column[3] is 再生可能エネルギー出力 (all-renewables output) in MW — NOT
 *     太陽光発電実績 (solar-only) in 万kW as the loader assumed.
 *   - The TENK_KW_TO_MW × 10 multiplier therefore over-counts by 10×, and the
 *     value conflates wind + solar + other renewables.
 *   - No solar-specific 5-min CSV found on denkiyoho.hepco.co.jp.
 *     Historical ZIP archives at area_jukyu_download.html may contain solar columns
 *     but are quarterly ZIPs and not suitable for daily live fetch.
 *
 * Status: T1 BLOCKED — solar column absent from live CSV, wrong units. Downgraded
 * to tier "estimated". Loader emits typical-shape from buildTypicalSolarRegion.
 * The fetchHokkaidoDay / parseHokkaidoCsv / buildHokkaidoRegionData helpers are
 * retained pending a future fix if a solar-specific endpoint is found.
 *
 * Calibration: OCCTO FY2024 Hokkaido area curtailment ≈ 0.10 TWh/yr.
 * Solar peak UTC: 03:00 (noon JST = 03:00 UTC for lon ~141.4°E)
 */
const REGION_ID = "japan-hokkaido";
const RATE = 0.05;
const BASE_URL = "https://denkiyoho.hepco.co.jp/area/data";
/** 万kW → MW */
const TENK_KW_TO_MW = 10;
/** Japan Standard Time offset from UTC, hours */
const JST_OFFSET_HOURS = 9;
/** 5-minute interval expressed as a fraction of an hour */
const INTERVAL_HOURS = 5 / 60;

export interface HokkaidoParsed {
  points: CurtailmentPoint[];
  solarMwSum: number;
  sampleCount: number;
}

/**
 * Parse a Shift-JIS-decoded Hokkaido Electric daily CSV string.
 * Locates the 5-min solar section by the 4-column DATE,TIME header signature.
 */
export function parseHokkaidoCsv(decoded: string): HokkaidoParsed {
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

export function buildHokkaidoRegionData(points: CurtailmentPoint[], nowIso: string): RegionData {
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
      "Hokkaido Electric juyo CSV (5-min solar 万kW) × 5% calibrated curtailment (OCCTO FY2024 Hokkaido anchor: ~0.10 TWh/yr)",
  };
}

async function fetchHokkaidoDay(
  yyyymmdd: string,
  timeoutMs = 30000,
  retries = 2,
  backoffMs = 750,
): Promise<HokkaidoParsed> {
  const url = `${BASE_URL}/juyo_01_${yyyymmdd}.csv`;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const buf = await fetchHttp1Bytes(url, timeoutMs);
      const decoded = new TextDecoder("shift-jis").decode(buf);
      return parseHokkaidoCsv(decoded);
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

  const parsedDays: HokkaidoParsed[] = [];
  for (const yyyymmdd of days) {
    try {
      parsedDays.push(await fetchHokkaidoDay(yyyymmdd));
    } catch (err) {
      console.warn(`hokkaido fetch skipped ${yyyymmdd}: ${(err as Error).message}`);
      parsedDays.push({ points: [], solarMwSum: 0, sampleCount: 0 });
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  const allPoints = parsedDays.flatMap((p) => p.points);
  if (allPoints.length === 0) {
    // juyo_01 CSV col[3] is all-renewables MW, not solar 万kW — no usable solar data.
    // Fall through to typical-shape below.
    console.warn("hokkaido: no usable solar rows from juyo_01 CSV — using typical-shape fallback");
    return buildTypicalSolarRegion(
      REGION_ID,
      3, // peakHourUtc (noon JST = 03:00 UTC)
      0.10,
      "Hokkaido Electric Power (北海道電力) — juyo_01 CSV col[3] is 再生可能エネルギー出力 (all-renewables MW), not solar 万kW; no solar-specific endpoint found (2026-05-10). Typical solar shape × OCCTO FY2024 Hokkaido anchor ~0.10 TWh/yr.",
      "2024",
    );
  }
  allPoints.sort((a, b) => a.utcTimestamp.localeCompare(b.utcTimestamp));

  return buildHokkaidoRegionData(allPoints, now.toISOString());
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
      console.error("japan-hokkaido loader failed", err);
      process.exit(1);
    });
}
