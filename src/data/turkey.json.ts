import { pathToFileURL } from "url";
import { fetchJSON } from "../lib/fetch.js";
import {
  latestCompleteUtcDayProfileGW,
  peakGW,
  timeOfDayAverageGW,
  totalTWh30d,
} from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";

const REGION_ID = "turkey";
const API = "https://seffaflik.epias.com.tr/electricity-service/v1/dashboard/realtime-generation";

// Conservative 2024 anchor: ~0.5 TWh/yr, derived as 0.8% of Turkey's
// 2024 wind+solar generation (~18% of national generation per Ember).
export const TURKEY_CURTAILMENT_RATE = 0.008;

interface EpiasDashboardItem {
  date?: string;
  hour?: string;
  wind?: number;
  sun?: number;
}

interface EpiasDashboardResponse {
  items?: EpiasDashboardItem[];
  latestUpdateTime?: string;
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function parseEpiasDashboard(
  response: EpiasDashboardResponse,
  rate = TURKEY_CURTAILMENT_RATE,
): { points: CurtailmentPoint[]; windPoints: CurtailmentPoint[]; solarPoints: CurtailmentPoint[]; windMwTotal: number; solarMwTotal: number } {
  const hourlyWind = new Map<string, number>();
  const hourlySolar = new Map<string, number>();

  for (const item of response.items ?? []) {
    if (!item.date) continue;
    const date = new Date(item.date);
    if (Number.isNaN(date.getTime())) continue;
    date.setUTCMinutes(0, 0, 0);
    const key = date.toISOString();
    hourlyWind.set(key, (hourlyWind.get(key) ?? 0) + numberOrZero(item.wind));
    hourlySolar.set(key, (hourlySolar.get(key) ?? 0) + numberOrZero(item.sun));
  }

  let windMwTotal = 0;
  let solarMwTotal = 0;

  const windPoints = Array.from(hourlyWind.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([utcTimestamp, mw]) => {
      windMwTotal += mw;
      return { utcTimestamp, mw: mw * rate };
    });

  const solarPoints = Array.from(hourlySolar.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([utcTimestamp, mw]) => {
      solarMwTotal += mw;
      return { utcTimestamp, mw: mw * rate };
    });

  // Combined points for backward-compat
  const combined = new Map<string, number>();
  for (const p of windPoints) combined.set(p.utcTimestamp, (combined.get(p.utcTimestamp) ?? 0) + p.mw);
  for (const p of solarPoints) combined.set(p.utcTimestamp, (combined.get(p.utcTimestamp) ?? 0) + p.mw);
  const points = Array.from(combined.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw }));

  return { points, windPoints, solarPoints, windMwTotal, solarMwTotal };
}

export function buildTurkeyPerFuelData(
  response: EpiasDashboardResponse,
  sourceNote = "EPIAS Transparency dashboard realtime-generation",
): { wind: RegionData; solar: RegionData } {
  const { windPoints, solarPoints, windMwTotal, solarMwTotal } = parseEpiasDashboard(response);
  if (windPoints.length === 0 && solarPoints.length === 0) throw new Error("EPIAS dashboard returned no wind/solar generation points");

  const fuelTotal = windMwTotal + solarMwTotal;
  const fuelShare = fuelTotal > 0
    ? { wind: windMwTotal / fuelTotal, solar: solarMwTotal / fuelTotal }
    : undefined;

  const lastUpdated = response.latestUpdateTime
    ? new Date(response.latestUpdateTime).toISOString()
    : (windPoints.at(-1) ?? solarPoints.at(-1))?.utcTimestamp ?? new Date().toISOString();

  const noteStr = `${sourceNote} × ${(TURKEY_CURTAILMENT_RATE * 100).toFixed(1)}% conservative calibrated proxy (~0.5 TWh/yr 2024 anchor).`;

  return {
    wind: {
      regionId: "turkey-wind",
      profile: timeOfDayAverageGW(windPoints),
      latestProfile: latestCompleteUtcDayProfileGW(windPoints),
      totalTWh: totalTWh30d(windPoints),
      peakGW: peakGW(windPoints),
      lastUpdated,
      lastSuccessAt: lastUpdated,
      sourceNote: noteStr + " — wind share",
    },
    solar: {
      regionId: "turkey-solar",
      profile: timeOfDayAverageGW(solarPoints),
      latestProfile: latestCompleteUtcDayProfileGW(solarPoints),
      totalTWh: totalTWh30d(solarPoints),
      peakGW: peakGW(solarPoints),
      lastUpdated,
      lastSuccessAt: lastUpdated,
      sourceNote: noteStr + " — solar share",
    },
  };
}

/** @deprecated Use buildTurkeyPerFuelData instead */
export function buildTurkeyData(
  response: EpiasDashboardResponse,
  sourceNote = "EPIAS Transparency dashboard realtime-generation wind+solar",
): RegionData {
  const { wind, solar } = buildTurkeyPerFuelData(response, sourceNote);
  // Return combined for backward compat. The aggregate (mixed) variant
  // legitimately carries fuelShare; per-fuel variants do not (per the
  // pillar-base / colour invariant — see tests/fuel-attribution.test.ts).
  const { points, windMwTotal, solarMwTotal } = parseEpiasDashboard(response);
  const lastUpdated = wind.lastUpdated;
  const fuelTotal = (wind.totalTWh + solar.totalTWh);
  const denom = windMwTotal + solarMwTotal;
  const fuelShare = denom > 0
    ? { wind: windMwTotal / denom, solar: solarMwTotal / denom }
    : undefined;
  return {
    regionId: "turkey",
    profile: timeOfDayAverageGW(points),
    latestProfile: latestCompleteUtcDayProfileGW(points),
    totalTWh: fuelTotal,
    peakGW: peakGW(points),
    lastUpdated,
    lastSuccessAt: lastUpdated,
    sourceNote: wind.sourceNote ?? sourceNote,
    ...(fuelShare ? { fuelShare } : {}),
  };
}

const run = async (): Promise<{ wind: RegionData; solar: RegionData }> => {
  const response = await fetchJSON<EpiasDashboardResponse>(API, {
    headers: {
      Accept: "application/json",
      "User-Agent": "every-last-joule-dashboard/1.0",
    },
    retries: 2,
    timeoutMs: 30000,
  });
  return buildTurkeyPerFuelData(response);
};

function adaptCachedTurkeyToPerFuel(
  cached: { wind: RegionData; solar: RegionData } | RegionData,
): { wind: RegionData; solar: RegionData } {
  if (cached && "wind" in cached && "solar" in cached) {
    return cached as { wind: RegionData; solar: RegionData };
  }
  // Old single-RegionData snapshot — synthesise per-fuel from fuelShare
  const old = cached as RegionData;
  const windShare = old.fuelShare?.wind ?? 0.5;
  const solarShare = old.fuelShare?.solar ?? 0.5;
  const ts = old.lastUpdated ?? new Date().toISOString();
  return {
    wind: {
      ...old,
      regionId: "turkey-wind",
      totalTWh: old.totalTWh * windShare,
      peakGW: old.peakGW * windShare,
      sourceNote: (old.sourceNote ?? "") + " — wind share (adapted from cached aggregate)",
    },
    solar: {
      ...old,
      regionId: "turkey-solar",
      totalTWh: old.totalTWh * solarShare,
      peakGW: old.peakGW * solarShare,
      sourceNote: (old.sourceNote ?? "") + " — solar share (adapted from cached aggregate)",
    },
  };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<{ wind: RegionData; solar: RegionData }>(REGION_ID, run, {
    regionTier: "live" as const,
    tagLive: (r) => r,
    tagCached: (c) => adaptCachedTurkeyToPerFuel(c as { wind: RegionData; solar: RegionData } | RegionData),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("turkey loader failed", err);
      process.exit(1);
    });
}
