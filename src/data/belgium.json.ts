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

export function buildBelgiumData(
  fuel: "wind" | "solar",
  points: CurtailmentPoint[],
  fuelShare?: { wind: number; solar: number },
): RegionData {
  const hourly = hourlyAverage(points);
  const regionId = `belgium-${fuel}`;
  return {
    regionId,
    profile: timeOfDayAverageGW(hourly),
    latestProfile: latestCompleteUtcDayProfileGW(hourly),
    totalTWh: totalTWh30d(hourly),
    peakGW: peakGW(hourly),
    lastUpdated: hourly.at(-1)?.utcTimestamp ?? new Date().toISOString(),
    lastSuccessAt: hourly.at(-1)?.utcTimestamp ?? new Date().toISOString(),
    sourceNote: fuelShare
      ? `Elia ${fuel} realtime CSV × 2% calibrated curtailment (observed 30d split: wind ${(fuelShare.wind * 100).toFixed(0)}% / solar ${(fuelShare.solar * 100).toFixed(0)}%)`
      : "Elia wind+solar realtime CSV × 2% calibrated curtailment rate (Belgium 2024)",
    ...(fuelShare ? { fuelShare } : {}),
  };
}

const run = async (): Promise<Record<string, RegionData>> => {
  const now = new Date();
  const cutoff = now.getTime() - 30 * 24 * 3600 * 1000;
  const windPoints: CurtailmentPoint[] = [];
  const solarPoints: CurtailmentPoint[] = [];
  for (const [url, bucket] of [
    [WIND_URL, windPoints] as const,
    [SOLAR_URL, solarPoints] as const,
  ]) {
    const csv = await fetchText(url);
    bucket.push(...parseEliaCsv(csv));
  }
  const windRecent = windPoints.filter((p) => new Date(p.utcTimestamp).getTime() >= cutoff);
  const solarRecent = solarPoints.filter((p) => new Date(p.utcTimestamp).getTime() >= cutoff);
  const windMw = windRecent.reduce((s, p) => s + p.mw, 0);
  const solarMw = solarRecent.reduce((s, p) => s + p.mw, 0);
  const denom = windMw + solarMw;
  const fuelShare = denom > 0
    ? { wind: windMw / denom, solar: solarMw / denom }
    : undefined;
  return {
    "belgium-wind": buildBelgiumData("wind", windRecent, fuelShare),
    "belgium-solar": buildBelgiumData("solar", solarRecent, fuelShare),
  };
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  withFallback<Record<string, RegionData>>("belgium", run, {
    regionTier: "live" as const,
    tagLive: (r) => {
      const tagged: Record<string, RegionData> = {};
      for (const [k, v] of Object.entries(r)) tagged[k] = { ...v, sourceStatus: "live" };
      return tagged;
    },
    tagCached: (c) => {
      const tagged: Record<string, RegionData> = {};
      for (const [k, v] of Object.entries(c)) tagged[k] = { ...v, sourceStatus: "cached" };
      return tagged;
    },
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("belgium loader failed", err);
      process.exit(1);
    });
}