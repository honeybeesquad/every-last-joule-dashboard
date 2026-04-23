import { pathToFileURL } from "node:url";
import { parseDelimitedRows } from "../lib/csv.js";
import { fetchText } from "../lib/fetch.js";
import { peakGW, timeOfDayAverageGW, totalTWh30d } from "../lib/profile.js";
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

export function parseEmiGenerationCsv(csv: string): CurtailmentPoint[] {
  const rows = parseDelimitedRows(csv, ",");
  const halfHours = new Map<string, number>();
  for (const row of rows) {
    if (!FUEL_CODES.has(row.Fuel_Code)) continue;
    const tradingDate = row.Trading_Date;
    for (let tp = 1; tp <= 50; tp++) {
      const kwh = Number(row[`TP${tp}`] || 0);
      if (!Number.isFinite(kwh) || kwh <= 0) continue;
      const utcTimestamp = nzTradingPeriodUtc(tradingDate, tp);
      if (!utcTimestamp) continue;
      halfHours.set(utcTimestamp, (halfHours.get(utcTimestamp) ?? 0) + kwh);
    }
  }

  const hours = new Map<string, number>();
  for (const [ts, kwh] of halfHours) {
    const d = new Date(ts);
    d.setUTCMinutes(0, 0, 0);
    const hour = d.toISOString();
    hours.set(hour, (hours.get(hour) ?? 0) + kwh / 1000 * CURTAILMENT_RATE);
  }
  return Array.from(hours.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw }));
}

export function buildNewZealandData(points: CurtailmentPoint[]): RegionData {
  return {
    regionId: "new-zealand",
    profile: timeOfDayAverageGW(points),
    totalTWh: totalTWh30d(points),
    peakGW: peakGW(points),
    lastUpdated: points.at(-1)?.utcTimestamp ?? new Date().toISOString(),
    sourceNote: "NZ EMI Generation_MD wind+solar+geothermal CSV × 1.3% calibrated curtailment proxy",
  };
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

const run = async (): Promise<RegionData> => {
  const now = new Date();
  const months = [new Date(now), new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))];
  const points: CurtailmentPoint[] = [];
  for (const date of months) {
    const key = monthKey(date);
    try {
      points.push(...parseEmiGenerationCsv(await fetchText(`${BASE_URL}/${key}_Generation_MD.csv`, { timeoutMs: 60000, retries: 1 })));
    } catch (err) {
      console.warn(`nz emi month skipped ${key}: ${(err as Error).message}`);
    }
  }
  if (!points.length) throw new Error("NZ EMI returned no usable Generation_MD rows");
  return buildNewZealandData(points);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  withFallback<RegionData>("new-zealand", run, {
    tagLive: (r) => ({ ...r, sourceStatus: "live" }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" }),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("new-zealand loader failed", err);
      process.exit(1);
    });
}
