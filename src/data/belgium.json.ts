import { pathToFileURL } from "node:url";
import { parseDelimitedRows, hourlyAverage } from "../lib/csv.js";
import { fetchText } from "../lib/fetch.js";
import { latestCompleteUtcDayProfileGW, peakGW, timeOfDayAverageGW, totalTWh30d } from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";

const WIND_URL = "https://opendata.elia.be/api/explore/v2.1/catalog/datasets/ods086/exports/csv";
const SOLAR_URL = "https://opendata.elia.be/api/explore/v2.1/catalog/datasets/ods087/exports/csv";
const CURTAILMENT_RATE = 0.02;

export function parseEliaCsv(csv: string): CurtailmentPoint[] {
  const rows = parseDelimitedRows(csv, ";");
  const totals = new Map<string, number>();
  for (const row of rows) {
    const ts = row.datetime;
    const value = Number(row.realtime || row.mostrecentforecast || 0);
    if (!ts || !Number.isFinite(value)) continue;
    const utcTimestamp = new Date(ts).toISOString();
    totals.set(utcTimestamp, (totals.get(utcTimestamp) ?? 0) + Math.max(0, value));
  }
  return Array.from(totals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw: mw * CURTAILMENT_RATE }));
}

export function buildBelgiumData(points: CurtailmentPoint[]): RegionData {
  const hourly = hourlyAverage(points);
  return {
    regionId: "belgium",
    profile: timeOfDayAverageGW(hourly),
    latestProfile: latestCompleteUtcDayProfileGW(hourly),
    totalTWh: totalTWh30d(hourly),
    peakGW: peakGW(hourly),
    lastUpdated: hourly.at(-1)?.utcTimestamp ?? new Date().toISOString(),
    sourceNote: "Elia wind+solar realtime CSV × 2% calibrated curtailment rate (Belgium 2024)",
  };
}

const run = async (): Promise<RegionData> => {
  const now = new Date();
  const cutoff = now.getTime() - 30 * 24 * 3600 * 1000;
  const points: CurtailmentPoint[] = [];
  for (const url of [WIND_URL, SOLAR_URL]) {
    const csv = await fetchText(url);
    points.push(...parseEliaCsv(csv));
  }
  return buildBelgiumData(points.filter((p) => new Date(p.utcTimestamp).getTime() >= cutoff));
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  withFallback<RegionData>("belgium", run, {
    tagLive: (r) => ({ ...r, sourceStatus: "live" }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" }),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("belgium loader failed", err);
      process.exit(1);
    });
}
