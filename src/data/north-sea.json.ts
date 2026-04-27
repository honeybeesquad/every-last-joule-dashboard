import { fetchJSON } from "../lib/fetch.js";
import { timeOfDayAverageGW, totalTWh30d, peakGW, latestCompleteUtcDayProfileGW } from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import type { RegionData, CurtailmentPoint } from "../lib/types.js";
import { pathToFileURL } from "url";

const SOLAR_RATE = 0.069;
const WIND_RATE = 0.069;
const API = "https://data.elexon.co.uk/bmrs/api/v1/datasets/AGWS";

interface AGWSRecord {
  psrType: "Wind Onshore" | "Wind Offshore" | "Solar" | string;
  quantity: number;
  startTime: string;
}

interface AGWSResponse {
  data: AGWSRecord[];
}

export interface NorthSeaParsed {
  windPoints: CurtailmentPoint[];
  solarPoints: CurtailmentPoint[];
}

/** Pure parser: combines multiple 7-day response pages into per-fuel CurtailmentPoint arrays (un-rate-multiplied). */
export function parseNorthSea(pages: AGWSResponse[]): NorthSeaParsed {
  const windTotals = new Map<string, number>();
  const solarTotals = new Map<string, number>();
  const windTypes = new Set(["Wind Onshore", "Wind Offshore"]);

  for (const page of pages) {
    for (const record of page.data ?? []) {
      const quantity = Number(record.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) continue;
      const isWind = windTypes.has(record.psrType);
      const isSolar = record.psrType === "Solar";
      if (!isWind && !isSolar) continue;
      const timestamp = new Date(record.startTime).toISOString();
      if (isWind) {
        windTotals.set(timestamp, (windTotals.get(timestamp) ?? 0) + quantity);
      } else {
        solarTotals.set(timestamp, (solarTotals.get(timestamp) ?? 0) + quantity);
      }
    }
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
  regionId: "north-sea-solar" | "north-sea-wind",
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
    fuelShare: regionId === "north-sea-solar" ? { solar: 1, wind: 0 } : { solar: 0, wind: 1 },
  };
}

export interface NorthSeaOutput {
  "north-sea-solar": RegionData;
  "north-sea-wind": RegionData;
}

const run = async (): Promise<NorthSeaOutput> => {
  const now = new Date();
  const pages: AGWSResponse[] = [];

  for (let i = 4; i >= 1; i--) {
    const to = new Date(now.getTime() - (i - 1) * 7 * 24 * 3600 * 1000);
    const from = new Date(now.getTime() - i * 7 * 24 * 3600 * 1000);
    const iso = (d: Date) => d.toISOString().slice(0, 19) + "Z";
    const params = new URLSearchParams({
      publishDateTimeFrom: iso(from),
      publishDateTimeTo: iso(to),
      format: "json",
    });
    const page = await fetchJSON<AGWSResponse>(`${API}?${params.toString()}`);
    pages.push(page);
  }

  const { windPoints, solarPoints } = parseNorthSea(pages);
  return {
    "north-sea-solar": buildPerFuelRegion(
      "north-sea-solar",
      solarPoints,
      SOLAR_RATE,
      "Elexon BMRS AGWS Solar × 6.9% calibrated curtailment (UK 2024 actuals: 6.6 TWh / 95 TWh)",
    ),
    "north-sea-wind": buildPerFuelRegion(
      "north-sea-wind",
      windPoints,
      WIND_RATE,
      "Elexon BMRS AGWS Wind Onshore+Offshore × 6.9% calibrated curtailment (UK 2024 actuals: 6.6 TWh / 95 TWh)",
    ),
  };
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  withFallback<NorthSeaOutput>("north-sea", run, {
    regionTier: "live" as const,
    tagLive: (r) => ({ ...r, sourceStatus: "live" as const }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" as const }),
  })
    .then((d) => process.stdout.write(JSON.stringify(d)))
    .catch((err) => {
      console.error("north-sea loader failed", err);
      process.exit(1);
    });
}
