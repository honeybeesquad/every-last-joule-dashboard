import { pathToFileURL } from "node:url";
import { fetchText } from "../lib/fetch.js";
import { latestCompleteUtcDayProfileGW, peakGW, timeOfDayAverageGW, totalTWh30d } from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";

const API = "https://api.energidataservice.dk/dataset/ProductionConsumptionSettlement";
const CURTAILMENT_RATE = 0.04;
const WIND_COLUMNS = [
  "OffshoreWindLt100MW_MWh",
  "OffshoreWindGe100MW_MWh",
  "OnshoreWindLt50kW_MWh",
  "OnshoreWindGe50kW_MWh",
];
const SOLAR_COLUMNS = [
  "SolarPowerLt10kW_MWh",
  "SolarPowerGe10Lt40kW_MWh",
  "SolarPowerGe40kW_MWh",
  "SolarPowerSelfConMWh",
];
const WIND_SOLAR_COLUMNS = [...WIND_COLUMNS, ...SOLAR_COLUMNS];

interface EnerginetResponse {
  records: Array<Record<string, string | number | null>>;
}

export interface EnerginetParsed {
  points: CurtailmentPoint[];
  windMwhTotal: number;
  solarMwhTotal: number;
}

export function parseEnerginetPayload(payload: string): EnerginetParsed {
  const parsed = JSON.parse(payload) as EnerginetResponse;
  const totals = new Map<string, number>();
  let windMwhTotal = 0;
  let solarMwhTotal = 0;
  for (const row of parsed.records ?? []) {
    const ts = String(row.HourUTC ?? "");
    if (!ts) continue;
    const windMwh = WIND_COLUMNS.reduce((sum, col) => {
      const v = Number(row[col] ?? 0);
      return sum + (Number.isFinite(v) ? v : 0);
    }, 0);
    const solarMwh = SOLAR_COLUMNS.reduce((sum, col) => {
      const v = Number(row[col] ?? 0);
      return sum + (Number.isFinite(v) ? v : 0);
    }, 0);
    windMwhTotal += Math.max(0, windMwh);
    solarMwhTotal += Math.max(0, solarMwh);
    const mwh = Math.max(0, windMwh + solarMwh);
    const utcTimestamp = new Date(`${ts}Z`).toISOString();
    totals.set(utcTimestamp, (totals.get(utcTimestamp) ?? 0) + mwh * CURTAILMENT_RATE);
  }
  const points = Array.from(totals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw }));
  return { points, windMwhTotal, solarMwhTotal };
}

export function buildDenmarkData(parsed: EnerginetParsed): RegionData {
  const { points, windMwhTotal, solarMwhTotal } = parsed;
  const denom = windMwhTotal + solarMwhTotal;
  const fuelShare = denom > 0
    ? { wind: windMwhTotal / denom, solar: solarMwhTotal / denom }
    : undefined;
  return {
    regionId: "denmark",
    profile: timeOfDayAverageGW(points),
    latestProfile: latestCompleteUtcDayProfileGW(points),
    totalTWh: totalTWh30d(points),
    peakGW: peakGW(points),
    lastUpdated: points.at(-1)?.utcTimestamp ?? new Date().toISOString(),
    lastSuccessAt: points.at(-1)?.utcTimestamp ?? new Date().toISOString(),
    sourceNote: fuelShare
      ? `Energinet wind+solar × 4% curtailment proxy (observed 30d split: wind ${(fuelShare.wind * 100).toFixed(0)}% / solar ${(fuelShare.solar * 100).toFixed(0)}%)`
      : "Energinet ProductionConsumptionSettlement wind+solar × 4% calibrated curtailment rate",
    ...(fuelShare ? { fuelShare } : {}),
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
    regionTier: "live" as const,
    tagLive: (r) => ({ ...r, sourceStatus: "live" }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" }),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("denmark loader failed", err);
      process.exit(1);
    });
}
