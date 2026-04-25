import { pathToFileURL } from "node:url";
import { parseDelimitedRows } from "../lib/csv.js";
import { fetchText } from "../lib/fetch.js";
import { latestCompleteUtcDayProfileGW, peakGW, timeOfDayAverageGW, totalTWh30d } from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";

const BASE_URL = "https://www.emi.ea.govt.nz/Wholesale/Datasets/Generation/Generation_MD";
const CURTAILMENT_RATE = 0.013;
const FUEL_CODES = new Set(["Wind", "Solar", "Geo", "WIND", "SOLAR", "GEO"]);

function nzTradingPeriodUtc(tradingDate: string, tp: number): string | null {
  const match = tradingDate.match(/^(\d{4})-(\d{2})-(\d{2})$/) ?? tradingDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const y = match[1].length === 4 ? Number(match[1]) : Number(match[3]);
  const m = match[1].length === 4 ? Number(match[2]) : Number(match[2]);
  const d = match[1].length === 4 ? Number(match[3]) : Number(match[1]);
  const minutes = (tp - 1) * 30;
  return new Date(Date.UTC(y, m - 1, d, 0, minutes - 12 * 60, 0)).toISOString();
}

export interface NzParsed {
  points: CurtailmentPoint[];
  /** Per-fuel aggregated curtailment MW over the 30-day window. */
  windMwTotal: number;
  solarMwTotal: number;
  geoMwTotal: number;
}

function normaliseFuel(code: string | undefined): "wind" | "solar" | "geo" | null {
  if (!code) return null;
  const c = code.toLowerCase();
  if (c.startsWith("wind")) return "wind";
  if (c.startsWith("solar")) return "solar";
  if (c.startsWith("geo")) return "geo";
  return null;
}

export function parseEmiGenerationCsv(csv: string): NzParsed {
  const rows = parseDelimitedRows(csv, ",");
  // Accumulate halfhour-level, keyed by (timestamp, fuel).
  const halfHours = new Map<string, { mw: number; fuel: "wind" | "solar" | "geo" }>();
  for (const row of rows) {
    if (!FUEL_CODES.has(row.Fuel_Code)) continue;
    const fuel = normaliseFuel(row.Fuel_Code);
    if (!fuel) continue;
    const tradingDate = row.Trading_Date;
    for (let tp = 1; tp <= 50; tp++) {
      const kwh = Number(row[`TP${tp}`] || 0);
      if (!Number.isFinite(kwh) || kwh <= 0) continue;
      const utcTimestamp = nzTradingPeriodUtc(tradingDate, tp);
      if (!utcTimestamp) continue;
      const key = `${utcTimestamp}|${fuel}`;
      const existing = halfHours.get(key);
      halfHours.set(key, { mw: (existing?.mw ?? 0) + kwh, fuel });
    }
  }

  const hours = new Map<string, number>();
  let windMwTotal = 0;
  let solarMwTotal = 0;
  let geoMwTotal = 0;
  for (const [key, entry] of halfHours) {
    const [ts] = key.split("|");
    const d = new Date(ts);
    d.setUTCMinutes(0, 0, 0);
    const hour = d.toISOString();
    const curtailMw = (entry.mw / 1000) * CURTAILMENT_RATE;
    hours.set(hour, (hours.get(hour) ?? 0) + curtailMw);
    if (entry.fuel === "wind") windMwTotal += curtailMw;
    else if (entry.fuel === "solar") solarMwTotal += curtailMw;
    else if (entry.fuel === "geo") geoMwTotal += curtailMw;
  }
  const points = Array.from(hours.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw }));
  return { points, windMwTotal, solarMwTotal, geoMwTotal };
}

export function buildNewZealandData(parsed: NzParsed): RegionData {
  const { points, windMwTotal, solarMwTotal, geoMwTotal } = parsed;
  // Geothermal counts as a 24/7-firm renewable for this dashboard;
  // fold geo into the hydro bucket since both are flat base-load renewables.
  const hydroBucketMw = geoMwTotal; // NZ EMI doesn't cover hydro spill separately
  const denom = windMwTotal + solarMwTotal + hydroBucketMw;
  const fuelShare = denom > 0
    ? {
        wind: windMwTotal / denom,
        solar: solarMwTotal / denom,
        hydro: hydroBucketMw / denom,
      }
    : undefined;
  return {
    regionId: "new-zealand",
    profile: timeOfDayAverageGW(points),
    latestProfile: latestCompleteUtcDayProfileGW(points),
    totalTWh: totalTWh30d(points),
    peakGW: peakGW(points),
    lastUpdated: points.at(-1)?.utcTimestamp ?? new Date().toISOString(),
    lastSuccessAt: points.at(-1)?.utcTimestamp ?? new Date().toISOString(),
    sourceNote: fuelShare
      ? `NZ EMI Generation_MD wind+solar+geothermal × 1.3% curtailment proxy (observed 30d split: wind ${(fuelShare.wind * 100).toFixed(0)}% / solar ${(fuelShare.solar * 100).toFixed(0)}% / geothermal-as-hydro ${(fuelShare.hydro * 100).toFixed(0)}%)`
      : "NZ EMI Generation_MD wind+solar+geothermal CSV × 1.3% calibrated curtailment proxy",
    ...(fuelShare ? { fuelShare } : {}),
  };
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

const run = async (): Promise<RegionData> => {
  const now = new Date();
  const months = [new Date(now), new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))];
  const allPoints: CurtailmentPoint[] = [];
  let windMwTotal = 0;
  let solarMwTotal = 0;
  let geoMwTotal = 0;
  for (const date of months) {
    const key = monthKey(date);
    try {
      const parsed = parseEmiGenerationCsv(await fetchText(`${BASE_URL}/${key}_Generation_MD.csv`, { timeoutMs: 60000, retries: 1 }));
      allPoints.push(...parsed.points);
      windMwTotal += parsed.windMwTotal;
      solarMwTotal += parsed.solarMwTotal;
      geoMwTotal += parsed.geoMwTotal;
    } catch (err) {
      console.warn(`nz emi month skipped ${key}: ${(err as Error).message}`);
    }
  }
  if (!allPoints.length) throw new Error("NZ EMI returned no usable Generation_MD rows");
  return buildNewZealandData({ points: allPoints, windMwTotal, solarMwTotal, geoMwTotal });
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  withFallback<RegionData>("new-zealand", run, {
    regionTier: "live" as const,
    tagLive: (r) => ({ ...r, sourceStatus: "live" }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" }),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("new-zealand loader failed", err);
      process.exit(1);
    });
}
