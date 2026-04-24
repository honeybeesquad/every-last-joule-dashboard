import { pathToFileURL } from "node:url";
import { parseDelimitedRows, hourlyAverage } from "../lib/csv.js";
import { fetchText } from "../lib/fetch.js";
import { latestCompleteUtcDayProfileGW, peakGW, timeOfDayAverageGW, totalTWh30d } from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";

const BASE_URL = "https://odre.opendatasoft.com/api/explore/v2.1/catalog/datasets/eco2mix-national-tr/exports/csv";
const CURTAILMENT_RATE = 0.03;

export interface FranceParsed {
  points: CurtailmentPoint[];
  windMwTotal: number;
  solarMwTotal: number;
}

export function parseRteEco2MixCsv(csv: string): FranceParsed {
  const rows = parseDelimitedRows(csv, ";");
  const totals = new Map<string, number>();
  let windMwTotal = 0;
  let solarMwTotal = 0;
  for (const row of rows) {
    const ts = row.date_heure;
    if (!ts) continue;
    const wind = Number(row.eolien_terrestre || 0) + Number(row.eolien_offshore || 0);
    const solar = Number(row.solaire || 0);
    const mw = wind + solar;
    if (!Number.isFinite(mw)) continue;
    const utcTimestamp = new Date(ts).toISOString();
    const windCurt = Math.max(0, wind) * CURTAILMENT_RATE;
    const solarCurt = Math.max(0, solar) * CURTAILMENT_RATE;
    windMwTotal += windCurt;
    solarMwTotal += solarCurt;
    totals.set(utcTimestamp, (totals.get(utcTimestamp) ?? 0) + windCurt + solarCurt);
  }
  const points = hourlyAverage(Array.from(totals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw })));
  return { points, windMwTotal, solarMwTotal };
}

export function buildFranceData(parsed: FranceParsed): RegionData {
  const { points, windMwTotal, solarMwTotal } = parsed;
  const denom = windMwTotal + solarMwTotal;
  const fuelShare = denom > 0
    ? { wind: windMwTotal / denom, solar: solarMwTotal / denom }
    : undefined;
  return {
    regionId: "france",
    profile: timeOfDayAverageGW(points),
    latestProfile: latestCompleteUtcDayProfileGW(points),
    totalTWh: totalTWh30d(points),
    peakGW: peakGW(points),
    lastUpdated: points.at(-1)?.utcTimestamp ?? new Date().toISOString(),
    sourceNote: fuelShare
      ? `RTE eco2mix wind+solar × 3% curtailment (observed split: wind ${(fuelShare.wind * 100).toFixed(0)}% / solar ${(fuelShare.solar * 100).toFixed(0)}%)`
      : "RTE eco2mix national wind+solar CSV × 3% calibrated curtailment rate (France 2024)",
    ...(fuelShare ? { fuelShare } : {}),
  };
}

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const run = async (): Promise<RegionData> => {
  const now = new Date();
  const prev = new Date(now);
  prev.setUTCMonth(prev.getUTCMonth() - 1);
  const allPoints: CurtailmentPoint[] = [];
  let windMwTotal = 0;
  let solarMwTotal = 0;
  for (const month of [monthKey(prev), monthKey(now)]) {
    const url = `${BASE_URL}?refine=date_heure:${month}`;
    const parsed = parseRteEco2MixCsv(await fetchText(url));
    allPoints.push(...parsed.points);
    windMwTotal += parsed.windMwTotal;
    solarMwTotal += parsed.solarMwTotal;
  }
  const cutoff = now.getTime() - 30 * 24 * 3600 * 1000;
  const recent = allPoints.filter((p) => new Date(p.utcTimestamp).getTime() >= cutoff);
  return buildFranceData({ points: recent, windMwTotal, solarMwTotal });
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  withFallback<RegionData>("france", run, {
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
