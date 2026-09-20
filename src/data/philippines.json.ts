/**
 * Philippines — IEMOP WESM RTD SCHED_MW (dispatched generation).
 *
 * Public ZIP cadence (no auth):
 *   https://www.iemop.ph/wp-content/uploads/downloads/data/RTD/RTD_YYYYMMDDHH00.zip
 *
 * RTD carries SCHED_MW only. There is no available-capacity column, so
 * curtailment cannot be measured from this feed. Waste is unpublished.
 * Ember/IRENA 2% invented rates are not IEMOP collection — they are dropped.
 *
 * Fuel split: RESOURCE_NAME contains SOL (solar) or WIND (wind); RESOURCE_TYPE G.
 * Battery suffixes (_BAT) are skipped. Not T1a.
 */

import { pathToFileURL } from "url";
import { mapWithConcurrency } from "../lib/concurrency.js";
import { fetchBytes } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";
import { unzipFirstText } from "../lib/unzip.js";
import { unpublishedGenerationRegion } from "../lib/waste-status.js";

const SOLAR_REGION_ID = "philippines-solar";
const WIND_REGION_ID = "philippines-wind";
const RTD_BASE = "https://www.iemop.ph/wp-content/uploads/downloads/data/RTD";
const PH_OFFSET_HOURS = 8;
const DAYS = 2;
const NOTE =
  "IEMOP WESM RTD SCHED_MW (public ZIP). Generation is dispatched MW by SOL/WIND resource name. " +
  "No available-capacity column — waste unpublished. Missing ≠ zero. Not T1a.";

export function parseIemopLocalTimestamp(raw: string): string | null {
  const m = raw
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let hour = Number(m[4]);
  const ampm = m[7].toUpperCase();
  if (ampm === "PM" && hour !== 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;
  const utc = Date.UTC(
    Number(m[3]),
    Number(m[1]) - 1,
    Number(m[2]),
    hour - PH_OFFSET_HOURS,
    Number(m[5]),
    Number(m[6]),
  );
  if (!Number.isFinite(utc)) return null;
  return new Date(utc).toISOString();
}

export function iemopFuel(resourceName: string): "solar" | "wind" | null {
  const u = resourceName.toUpperCase();
  if (u.includes("_BAT") || u.endsWith("BAT")) return null;
  if (u.includes("WIND")) return "wind";
  if (u.includes("SOL")) return "solar";
  return null;
}

function headerIndex(header: string[], name: string): number {
  return header.findIndex((h) => h.trim().toUpperCase() === name);
}

/**
 * Parse one RTD CSV into solar/wind MW points. Duplicate timestamps (many
 * plants) are summed. intervalHours is the median step, default 5 minutes.
 */
export function parseIemopRtdCsv(csv: string): { solar: CurtailmentPoint[]; wind: CurtailmentPoint[] } {
  const lines = csv.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length < 2) throw new Error("IEMOP RTD CSV is empty");
  const header = lines[0].split(",");
  const timeIdx = headerIndex(header, "TIME_INTERVAL");
  const nameIdx = headerIndex(header, "RESOURCE_NAME");
  const typeIdx = headerIndex(header, "RESOURCE_TYPE");
  const mwIdx = headerIndex(header, "SCHED_MW");
  if (timeIdx < 0 || nameIdx < 0 || typeIdx < 0 || mwIdx < 0) {
    throw new Error(`IEMOP RTD header missing TIME_INTERVAL/RESOURCE_NAME/RESOURCE_TYPE/SCHED_MW: ${lines[0]}`);
  }

  const solar = new Map<string, number>();
  const wind = new Map<string, number>();
  const stamps: number[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(",");
    if (cols.length <= Math.max(timeIdx, nameIdx, typeIdx, mwIdx)) continue;
    if (cols[typeIdx].trim() !== "G") continue;
    const fuel = iemopFuel(cols[nameIdx]);
    if (!fuel) continue;
    const iso = parseIemopLocalTimestamp(cols[timeIdx]);
    if (!iso) continue;
    const mw = Number(cols[mwIdx]);
    if (!Number.isFinite(mw) || mw < 0) continue;
    const bucket = fuel === "solar" ? solar : wind;
    bucket.set(iso, (bucket.get(iso) ?? 0) + mw);
    stamps.push(Date.parse(iso));
  }

  stamps.sort((a, b) => a - b);
  let intervalHours = 5 / 60;
  if (stamps.length >= 2) {
    const deltas: number[] = [];
    for (let i = 1; i < stamps.length; i++) {
      const dt = (stamps[i] - stamps[i - 1]) / 3_600_000;
      if (dt > 0 && dt <= 1) deltas.push(dt);
    }
    deltas.sort((a, b) => a - b);
    if (deltas.length > 0) intervalHours = deltas[Math.floor(deltas.length / 2)];
  }

  const toPoints = (map: Map<string, number>): CurtailmentPoint[] =>
    Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw, intervalHours }));

  const solarPts = toPoints(solar);
  const windPts = toPoints(wind);
  if (solarPts.length === 0 && windPts.length === 0) {
    throw new Error("IEMOP RTD CSV has no SOL/WIND generator SCHED_MW rows");
  }
  return { solar: solarPts, wind: windPts };
}

function mergePoints(parts: CurtailmentPoint[][]): CurtailmentPoint[] {
  const map = new Map<string, CurtailmentPoint>();
  for (const pts of parts) {
    for (const p of pts) {
      const prev = map.get(p.utcTimestamp);
      map.set(p.utcTimestamp, {
        utcTimestamp: p.utcTimestamp,
        mw: (prev?.mw ?? 0) + p.mw,
        intervalHours: p.intervalHours ?? prev?.intervalHours,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.utcTimestamp.localeCompare(b.utcTimestamp));
}

export function buildPhilippinesFromRtdCsvs(csvs: string[]): Record<string, RegionData> {
  const parsed = [];
  for (const csv of csvs) {
    try {
      parsed.push(parseIemopRtdCsv(csv));
    } catch {
      // skip a truncated hour
    }
  }
  const solar = mergePoints(parsed.map((p) => p.solar));
  const wind = mergePoints(parsed.map((p) => p.wind));
  if (solar.length < 12 || wind.length < 12) {
    throw new Error(`IEMOP RTD missing solar or wind series (solar ${solar.length}, wind ${wind.length})`);
  }
  return {
    [SOLAR_REGION_ID]: unpublishedGenerationRegion(
      SOLAR_REGION_ID,
      "solar",
      solar,
      `${NOTE} — solar resources (SOL in RESOURCE_NAME).`,
      { minPoints: 12 },
    ),
    [WIND_REGION_ID]: unpublishedGenerationRegion(
      WIND_REGION_ID,
      "wind",
      wind,
      `${NOTE} — wind resources (WIND in RESOURCE_NAME).`,
      { minPoints: 12 },
    ),
  };
}

export function buildPhilippinesFromRtdCsv(csv: string): Record<string, RegionData> {
  return buildPhilippinesFromRtdCsvs([csv]);
}

function phYmd(now: Date, daysBack: number): string {
  const ph = new Date(now.getTime() + PH_OFFSET_HOURS * 3_600_000);
  const d = new Date(Date.UTC(ph.getUTCFullYear(), ph.getUTCMonth(), ph.getUTCDate() - daysBack));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function rtdStamps(now = new Date()): string[] {
  const stamps: string[] = [];
  for (let back = 1; back <= DAYS; back++) {
    const ymd = phYmd(now, back);
    for (let hour = 0; hour < 24; hour++) {
      stamps.push(`${ymd}${String(hour).padStart(2, "0")}00`);
    }
  }
  return stamps;
}

async function fetchOneZip(stamp: string): Promise<string | null> {
  const url = `${RTD_BASE}/RTD_${stamp}.zip`;
  try {
    const bytes = await fetchBytes(url, {
      timeoutMs: 8000,
      retries: 0,
      headers: { "user-agent": "Mozilla/5.0", accept: "application/zip,*/*" },
    });
    return unzipFirstText(bytes);
  } catch {
    return null;
  }
}

async function run(): Promise<Record<string, RegionData>> {
  const csvs = await mapWithConcurrency(rtdStamps(), 6, fetchOneZip);
  const present = csvs.filter((c): c is string => c != null);
  if (present.length < 12) {
    throw new Error(`IEMOP RTD: only ${present.length} hourly ZIPs fetched, need at least 12`);
  }
  return buildPhilippinesFromRtdCsvs(present);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback<Record<string, RegionData>>("philippines", () => run(), {
    regionTier: "estimated" as const,
    tagLive: (r) => r,
    tagCached: (c) => c as Record<string, RegionData>,
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("philippines loader failed", err);
      process.exit(1);
    });
}

export const buildPhilippinesData = () => {
  throw new Error("buildPhilippinesData is live-only; tests must call buildPhilippinesFromRtdCsv");
};
