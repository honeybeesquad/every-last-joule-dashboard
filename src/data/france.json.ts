import { pathToFileURL } from "node:url";
import { parseDelimitedRows, hourlyAverage } from "../lib/csv.js";
import { fetchText } from "../lib/fetch.js";
import { peakGW, timeOfDayAverageGW, totalTWh30d } from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";

const BASE_URL = "https://odre.opendatasoft.com/api/explore/v2.1/catalog/datasets/eco2mix-national-tr/exports/csv";
const CURTAILMENT_RATE = 0.03;

export function parseRteEco2MixCsv(csv: string): CurtailmentPoint[] {
  const rows = parseDelimitedRows(csv, ";");
  const totals = new Map<string, number>();
  for (const row of rows) {
    const ts = row.date_heure;
    if (!ts) continue;
    const wind = Number(row.eolien_terrestre || 0) + Number(row.eolien_offshore || 0);
    const solar = Number(row.solaire || 0);
    const mw = wind + solar;
    if (!Number.isFinite(mw)) continue;
    const utcTimestamp = new Date(ts).toISOString();
    totals.set(utcTimestamp, (totals.get(utcTimestamp) ?? 0) + Math.max(0, mw) * CURTAILMENT_RATE);
  }
  return hourlyAverage(Array.from(totals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw })));
}

export function buildFranceData(points: CurtailmentPoint[]): RegionData {
  return {
    regionId: "france",
    profile: timeOfDayAverageGW(points),
    totalTWh: totalTWh30d(points),
    peakGW: peakGW(points),
    lastUpdated: points.at(-1)?.utcTimestamp ?? new Date().toISOString(),
    sourceNote: "RTE eco2mix national wind+solar CSV × 3% calibrated curtailment rate (France 2024)",
  };
}

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const run = async (): Promise<RegionData> => {
  const now = new Date();
  const prev = new Date(now);
  prev.setUTCMonth(prev.getUTCMonth() - 1);
  const points: CurtailmentPoint[] = [];
  for (const month of [monthKey(prev), monthKey(now)]) {
    const url = `${BASE_URL}?refine=date_heure:${month}`;
    points.push(...parseRteEco2MixCsv(await fetchText(url)));
  }
  const cutoff = now.getTime() - 30 * 24 * 3600 * 1000;
  return buildFranceData(points.filter((p) => new Date(p.utcTimestamp).getTime() >= cutoff));
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  withFallback<RegionData>("france", run, {
    tagLive: (r) => ({ ...r, sourceStatus: "live" }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" }),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("france loader failed", err);
      process.exit(1);
    });
}
