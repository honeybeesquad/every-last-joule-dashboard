import { pathToFileURL } from "node:url";
import { parseDelimitedRows } from "../lib/csv.js";
import { fetchText } from "../lib/fetch.js";
import { latestCompleteUtcDayProfileGW, peakGW, timeOfDayAverageGW, totalTWh30d } from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";

const WIND_URL = "https://opendata.elia.be/api/explore/v2.1/catalog/datasets/ods086/exports/csv";
const SOLAR_URL = "https://opendata.elia.be/api/explore/v2.1/catalog/datasets/ods087/exports/csv";
const SOLAR_RATE = 0.02; // Keep existing 2% blended rate for now
const WIND_RATE = 0.02; // Keep existing 2% blended rate for now

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
    .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw }));
}

/** Build a per-fuel RegionData record. fuelShare is hard-set to 100%/0% for the fuel. */
export function buildPerFuelRegion(
  regionId: "belgium-solar" | "belgium-wind",
  points: CurtailmentPoint[],
  rate: number,
  sourceNote: string,
): RegionData {
  const curtailedPoints = points.map((p) => ({ utcTimestamp: p.utcTimestamp, mw: p.mw * rate }));
  const lastUpdated = curtailedPoints.at(-1)?.utcTimestamp ?? new Date().toISOString();
  return {
    regionId,
    profile: timeOfDayAverageGW(curtailedPoints),
    latestProfile: latestCompleteUtcDayProfileGW(curtailedPoints),
    totalTWh: totalTWh30d(curtailedPoints),
    peakGW: peakGW(curtailedPoints),
    lastUpdated,
    lastSuccessAt: lastUpdated,
    sourceNote,
    fuelShare: regionId === "belgium-solar" ? { solar: 1, wind: 0 } : { solar: 0, wind: 1 },
  };
}

export interface BelgiumOutput {
  "belgium-solar": RegionData;
  "belgium-wind": RegionData;
}

const run = async (): Promise<BelgiumOutput> => {
  const windCsv = await fetchText(WIND_URL);
  const solarCsv = await fetchText(SOLAR_URL);

  const windPoints = parseEliaCsv(windCsv);
  const solarPoints = parseEliaCsv(solarCsv);

  return {
    "belgium-solar": buildPerFuelRegion(
      "belgium-solar",
      solarPoints,
      SOLAR_RATE,
      "Elia solar realtime CSV × 2% calibrated curtailment (Belgium 2024)",
    ),
    "belgium-wind": buildPerFuelRegion(
      "belgium-wind",
      windPoints,
      WIND_RATE,
      "Elia wind realtime CSV × 2% calibrated curtailment (Belgium 2024)",
    ),
  };
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  withFallback<BelgiumOutput>("belgium", run, {
    regionTier: "live" as const,
    tagLive: (r) => ({ ...r, sourceStatus: "live" }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" }),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("belgium loader failed", err);
      process.exit(1);
    });
}
