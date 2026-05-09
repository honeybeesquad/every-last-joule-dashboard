import { pathToFileURL } from "node:url";
import { parseDelimitedRows, hourlyAverage } from "../lib/csv.js";
import { fetchText } from "../lib/fetch.js";
import { latestCompleteUtcDayProfileGW, peakGW, timeOfDayAverageGW, totalTWh30d } from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";

const BASE_URL = "https://odre.opendatasoft.com/api/explore/v2.1/catalog/datasets/eco2mix-national-tr/exports/csv";
const CURTAILMENT_RATE = 0.03;

export interface FranceFuelCurtailment {
  windPoints: CurtailmentPoint[];
  solarPoints: CurtailmentPoint[];
  windMwTotal: number;
  solarMwTotal: number;
}

export function parseRteEco2MixCsv(csv: string): FranceFuelCurtailment {
  const windTotals = new Map<string, number>();
  const solarTotals = new Map<string, number>();
  let windMwTotal = 0;
  let solarMwTotal = 0;
  for (const row of parseDelimitedRows(csv, ";")) {
    const ts = row.date_heure;
    if (!ts) continue;
    const wind = Number(row.eolien_terrestre || 0) + Number(row.eolien_offshore || 0);
    const solar = Number(row.solaire || 0);
    if (!Number.isFinite(wind) && !Number.isFinite(solar)) continue;
    const utcTimestamp = new Date(ts).toISOString();
    const windCurt = Math.max(0, wind) * CURTAILMENT_RATE;
    const solarCurt = Math.max(0, solar) * CURTAILMENT_RATE;
    windMwTotal += windCurt;
    solarMwTotal += solarCurt;
    windTotals.set(utcTimestamp, (windTotals.get(utcTimestamp) ?? 0) + windCurt);
    solarTotals.set(utcTimestamp, (solarTotals.get(utcTimestamp) ?? 0) + solarCurt);
  }
  const toPoints = (m: Map<string, number>): CurtailmentPoint[] =>
    hourlyAverage(
      Array.from(m.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw })),
    );
  return { windPoints: toPoints(windTotals), solarPoints: toPoints(solarTotals), windMwTotal, solarMwTotal };
}

export function buildFranceData(
  fuel: "wind" | "solar",
  points: CurtailmentPoint[],
  fuelShare: { wind: number; solar: number },
): RegionData {
  const hourly = hourlyAverage(points);
  const regionId = `france-${fuel}`;
  return {
    regionId,
    profile: timeOfDayAverageGW(hourly),
    latestProfile: latestCompleteUtcDayProfileGW(hourly),
    totalTWh: totalTWh30d(hourly),
    peakGW: peakGW(hourly),
    lastUpdated: hourly.at(-1)?.utcTimestamp ?? new Date().toISOString(),
    lastSuccessAt: hourly.at(-1)?.utcTimestamp ?? new Date().toISOString(),
    sourceNote:
      `RTE eco2mix ${fuel} × 3% curtailment (observed 30d split: wind ${(fuelShare.wind * 100).toFixed(0)}% / solar ${(fuelShare.solar * 100).toFixed(0)}%)`,
  };
}

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const run = async (): Promise<Record<string, RegionData>> => {
  const now = new Date();
  const prev = new Date(now);
  prev.setUTCMonth(prev.getUTCMonth() - 1);
  let windMwTotal = 0;
  let solarMwTotal = 0;
  const allWindPoints: CurtailmentPoint[] = [];
  const allSolarPoints: CurtailmentPoint[] = [];
  for (const month of [monthKey(prev), monthKey(now)]) {
    const url = `${BASE_URL}?refine=date_heure:${month}`;
    const parsed = parseRteEco2MixCsv(await fetchText(url));
    allWindPoints.push(...parsed.windPoints);
    allSolarPoints.push(...parsed.solarPoints);
    windMwTotal += parsed.windMwTotal;
    solarMwTotal += parsed.solarMwTotal;
  }
  const cutoff = now.getTime() - 30 * 24 * 3600 * 1000;
  const windRecent = allWindPoints.filter((p) => new Date(p.utcTimestamp).getTime() >= cutoff);
  const solarRecent = allSolarPoints.filter((p) => new Date(p.utcTimestamp).getTime() >= cutoff);
  const denom = windMwTotal + solarMwTotal;
  const fuelShare = denom > 0
    ? { wind: windMwTotal / denom, solar: solarMwTotal / denom }
    : { wind: 0.5, solar: 0.5 };
  return {
    "france-wind": buildFranceData("wind", windRecent, fuelShare),
    "france-solar": buildFranceData("solar", solarRecent, fuelShare),
  };
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  withFallback<Record<string, RegionData>>("france", run, {
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
      console.error("france loader failed", err);
      process.exit(1);
    });
}