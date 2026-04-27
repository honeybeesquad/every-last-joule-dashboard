import { pathToFileURL } from "node:url";
import { fetchJSON } from "../lib/fetch.js"; // Changed from fetchText
import { latestCompleteUtcDayProfileGW, peakGW, timeOfDayAverageGW, totalTWh30d } from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";

const API = "https://api.energidataservice.dk/dataset/ProductionConsumptionSettlement";
const SOLAR_RATE = 0.04;
const WIND_RATE = 0.04;
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

interface EnerginetResponse {
  records: Array<Record<string, string | number | null>>;
}

export interface EnerginetParsed {
  windPoints: CurtailmentPoint[];
  solarPoints: CurtailmentPoint[];
}

export function parseEnerginetPayload(payload: EnerginetResponse): EnerginetParsed {
  const windTotals = new Map<string, number>();
  const solarTotals = new Map<string, number>();

  for (const row of payload.records ?? []) {
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

    const utcTimestamp = new Date(`${ts}Z`).toISOString();
    windTotals.set(utcTimestamp, (windTotals.get(utcTimestamp) ?? 0) + Math.max(0, windMwh));
    solarTotals.set(utcTimestamp, (solarTotals.get(utcTimestamp) ?? 0) + Math.max(0, solarMwh));
  }

  const windPoints = Array.from(windTotals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw }));

  const solarPoints = Array.from(solarTotals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw }));

  return { windPoints, solarPoints };
}

/** Build a per-fuel RegionData record. fuelShare is hard-set to 100%/0% for the fuel. */
export function buildPerFuelRegion(
  regionId: "denmark-solar" | "denmark-wind",
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
    fuelShare: regionId === "denmark-solar" ? { solar: 1, wind: 0 } : { solar: 0, wind: 1 },
  };
}

export interface DenmarkOutput {
  "denmark-solar": RegionData;
  "denmark-wind": RegionData;
}

const run = async (): Promise<DenmarkOutput> => {
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 24 * 3600 * 1000);
  const params = new URLSearchParams({
    start: start.toISOString().slice(0, 16),
    end: end.toISOString().slice(0, 16),
    format: "json", // Changed from csv
  });
  const payload = await fetchJSON<EnerginetResponse>(`${API}?${params.toString()}`); // Changed from fetchText
  const { windPoints, solarPoints } = parseEnerginetPayload(payload);

  return {
    "denmark-solar": buildPerFuelRegion(
      "denmark-solar",
      solarPoints,
      SOLAR_RATE,
      "Energinet solar data × 4% calibrated curtailment (Denmark 2024)",
    ),
    "denmark-wind": buildPerFuelRegion(
      "denmark-wind",
      windPoints,
      WIND_RATE,
      "Energinet wind data × 4% calibrated curtailment (Denmark 2024)",
    ),
  };
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  withFallback<DenmarkOutput>("denmark", run, {
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
