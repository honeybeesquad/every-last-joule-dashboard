import { pathToFileURL } from "node:url";
import { parseDelimitedRows, hourlyAverage } from "../lib/csv.js";
import { fetchText } from "../lib/fetch.js";
import { latestCompleteUtcDayProfileGW, peakGW, timeOfDayAverageGW, totalTWh30d } from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";

const BASE_URL = "https://odre.opendatasoft.com/api/explore/v2.1/catalog/datasets/eco2mix-national-tr/exports/csv";
const SOLAR_RATE = 0.03;
const WIND_RATE = 0.03;

export interface FranceParsed {
  windPoints: CurtailmentPoint[];
  solarPoints: CurtailmentPoint[];
}

export function parseRteEco2MixCsv(csv: string): FranceParsed {
  const rows = parseDelimitedRows(csv, ";");
  const windTotals = new Map<string, number>();
  const solarTotals = new Map<string, number>();
  for (const row of rows) {
    const ts = row.date_heure;
    if (!ts) continue;
    const wind = Number(row.eolien_terrestre || 0) + Number(row.eolien_offshore || 0);
    const solar = Number(row.solaire || 0);
    if (!Number.isFinite(wind) && !Number.isFinite(solar)) continue;
    const utcTimestamp = new Date(ts).toISOString();
    windTotals.set(utcTimestamp, (windTotals.get(utcTimestamp) ?? 0) + Math.max(0, wind));
    solarTotals.set(utcTimestamp, (solarTotals.get(utcTimestamp) ?? 0) + Math.max(0, solar));
  }
  const windPoints = hourlyAverage(Array.from(windTotals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw })));
  const solarPoints = hourlyAverage(Array.from(solarTotals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw })));
  return { windPoints, solarPoints };
}

/** Build a per-fuel RegionData record. fuelShare is hard-set to 100%/0% for the fuel. */
export function buildPerFuelRegion(
  regionId: "france-solar" | "france-wind",
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
    fuelShare: regionId === "france-solar" ? { solar: 1, wind: 0 } : { solar: 0, wind: 1 },
  };
}

export interface FranceOutput {
  "france-solar": RegionData;
  "france-wind": RegionData;
}

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const run = async (): Promise<FranceOutput> => {
  const now = new Date();
  const prev = new Date(now);
  prev.setUTCMonth(prev.getUTCMonth() - 1);
  const allWind: CurtailmentPoint[] = [];
  const allSolar: CurtailmentPoint[] = [];
  for (const month of [monthKey(prev), monthKey(now)]) {
    const url = `${BASE_URL}?refine=date_heure:${month}`;
    const parsed = parseRteEco2MixCsv(await fetchText(url));
    allWind.push(...parsed.windPoints);
    allSolar.push(...parsed.solarPoints);
  }
  const cutoff = now.getTime() - 30 * 24 * 3600 * 1000;
  const recentWind = allWind.filter((p) => new Date(p.utcTimestamp).getTime() >= cutoff);
  const recentSolar = allSolar.filter((p) => new Date(p.utcTimestamp).getTime() >= cutoff);
  return {
    "france-solar": buildPerFuelRegion(
      "france-solar",
      recentSolar,
      SOLAR_RATE,
      "RTE eco2mix solar (solaire) CSV × 3% calibrated curtailment (France 2024)",
    ),
    "france-wind": buildPerFuelRegion(
      "france-wind",
      recentWind,
      WIND_RATE,
      "RTE eco2mix wind (eolien_terrestre + eolien_offshore) CSV × 3% calibrated curtailment (France 2024)",
    ),
  };
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  withFallback<FranceOutput>("france", run, {
    regionTier: "live" as const,
    tagLive: (r) => ({ ...r, sourceStatus: "live" }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" }),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("france loader failed", err);
      process.exit(1);
    });
}
