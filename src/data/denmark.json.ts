import { pathToFileURL } from "node:url";
import { fetchText } from "../lib/fetch.js";
import { peakGW, timeOfDayAverageGW, totalTWh30d } from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";

const API = "https://api.energidataservice.dk/dataset/ProductionConsumptionSettlement";
const CURTAILMENT_RATE = 0.04;
const WIND_SOLAR_COLUMNS = [
  "OffshoreWindLt100MW_MWh",
  "OffshoreWindGe100MW_MWh",
  "OnshoreWindLt50kW_MWh",
  "OnshoreWindGe50kW_MWh",
  "SolarPowerLt10kW_MWh",
  "SolarPowerGe10Lt40kW_MWh",
  "SolarPowerGe40kW_MWh",
  "SolarPowerSelfConMWh",
];

interface EnerginetResponse {
  records: Array<Record<string, string | number | null>>;
}

export function parseEnerginetPayload(payload: string): CurtailmentPoint[] {
  const parsed = JSON.parse(payload) as EnerginetResponse;
  const totals = new Map<string, number>();
  for (const row of parsed.records ?? []) {
    const ts = String(row.HourUTC ?? "");
    if (!ts) continue;
    const mwh = WIND_SOLAR_COLUMNS.reduce((sum, col) => {
      const value = Number(row[col] ?? 0);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
    const utcTimestamp = new Date(`${ts}Z`).toISOString();
    totals.set(utcTimestamp, (totals.get(utcTimestamp) ?? 0) + Math.max(0, mwh) * CURTAILMENT_RATE);
  }
  return Array.from(totals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw }));
}

export function buildDenmarkData(points: CurtailmentPoint[]): RegionData {
  return {
    regionId: "denmark",
    profile: timeOfDayAverageGW(points),
    totalTWh: totalTWh30d(points),
    peakGW: peakGW(points),
    lastUpdated: points.at(-1)?.utcTimestamp ?? new Date().toISOString(),
    sourceNote: "Energinet ProductionConsumptionSettlement wind+solar × 4% calibrated curtailment rate",
  };
}

const run = async (): Promise<RegionData> => {
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 24 * 3600 * 1000);
  const params = new URLSearchParams({
    start: start.toISOString().slice(0, 16),
    end: end.toISOString().slice(0, 16),
    format: "csv",
  });
  return buildDenmarkData(parseEnerginetPayload(await fetchText(`${API}?${params.toString()}`)));
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  withFallback<RegionData>("denmark", run, {
    tagLive: (r) => ({ ...r, sourceStatus: "live" }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" }),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("denmark loader failed", err);
      process.exit(1);
    });
}
