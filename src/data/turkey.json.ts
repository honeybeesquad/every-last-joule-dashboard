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
): { points: CurtailmentPoint[]; windMwTotal: number; solarMwTotal: number } {
  const hourly = new Map<string, { wind: number; solar: number }>();

  for (const item of response.items ?? []) {
    if (!item.date) continue;
    const date = new Date(item.date);
    if (Number.isNaN(date.getTime())) continue;
    date.setUTCMinutes(0, 0, 0);
    const key = date.toISOString();
    const bucket = hourly.get(key) ?? { wind: 0, solar: 0 };
    bucket.wind += numberOrZero(item.wind);
    bucket.solar += numberOrZero(item.sun);
    hourly.set(key, bucket);
  }

  let windMwTotal = 0;
  let solarMwTotal = 0;
  const points = Array.from(hourly.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([utcTimestamp, value]) => {
      windMwTotal += value.wind;
      solarMwTotal += value.solar;
      return {
        utcTimestamp,
        mw: (value.wind + value.solar) * rate,
      };
    });

  return { points, windMwTotal, solarMwTotal };
}

export function buildTurkeyData(
  response: EpiasDashboardResponse,
  sourceNote = "EPIAS Transparency dashboard realtime-generation wind+solar",
): RegionData {
  const { points, windMwTotal, solarMwTotal } = parseEpiasDashboard(response);
  if (points.length === 0) throw new Error("EPIAS dashboard returned no wind/solar generation points");

  const fuelTotal = windMwTotal + solarMwTotal;
  const fuelShare = fuelTotal > 0
    ? {
        wind: windMwTotal / fuelTotal,
        solar: solarMwTotal / fuelTotal,
      }
    : undefined;

  const latestProfile = latestCompleteUtcDayProfileGW(points);
  const partialDayNote = latestProfile
    ? ""
    : " Current EPIAS dashboard endpoint exposes the current Turkey day only; latestProfile remains null until a complete 24-hour day is available.";

  return {
    regionId: REGION_ID,
    profile: timeOfDayAverageGW(points),
    latestProfile,
    totalTWh: totalTWh30d(points),
    peakGW: peakGW(points),
    lastUpdated: response.latestUpdateTime
      ? new Date(response.latestUpdateTime).toISOString()
      : points.at(-1)?.utcTimestamp ?? new Date().toISOString(),
    sourceNote: `${sourceNote} × ${(TURKEY_CURTAILMENT_RATE * 100).toFixed(1)}% conservative calibrated proxy (~0.5 TWh/yr 2024 anchor).${partialDayNote}`,
    ...(fuelShare ? { fuelShare } : {}),
  };
}

const run = async (): Promise<RegionData> => {
  const response = await fetchJSON<EpiasDashboardResponse>(API, {
    headers: {
      Accept: "application/json",
      "User-Agent": "every-last-joule-dashboard/1.0",
    },
    retries: 2,
    timeoutMs: 30000,
  });
  return buildTurkeyData(response);
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<RegionData>(REGION_ID, run, {
    regionTier: "live" as const,
    tagLive: (r) => ({ ...r, sourceStatus: "live" as const }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" as const }),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("turkey loader failed", err);
      process.exit(1);
    });
}
