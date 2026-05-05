import { fetchJSON } from "../lib/fetch.js";
import { timeOfDayAverageGW, totalTWh30d, peakGW, latestCompleteUtcDayProfileGW } from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import type { RegionData, CurtailmentPoint } from "../lib/types.js";
import { pathToFileURL } from "url";

const WIND_RATE = 0.0615;
const SOLAR_RATE = 0.04;
const ERCOT_WEST_SHARE = 0.66;
const ERCOT_EAST_SHARE = 0.34;

const API_BASE = "https://api.eia.gov/v2/electricity/rto/fuel-type-data/data/";

interface EIAResponse {
  response: {
    total: string | number;
    data: Array<{
      period: string;
      respondent: string;
      fueltype: string;
      value: string;
    }>;
  };
  warnings?: unknown;
}

function toPoints(raw: EIAResponse, rate: number): CurtailmentPoint[] {
  return raw.response.data.map((r) => ({
    utcTimestamp: `${r.period}:00:00Z`,
    mw: Math.max(0, Number(r.value) * rate),
  }));
}

function scalePoints(
  points: CurtailmentPoint[],
  share: number,
): CurtailmentPoint[] {
  return points.map((p) => ({ ...p, mw: p.mw * share }));
}

export function parseErcotPerFuel(
  windRaw: EIAResponse,
  solarRaw?: EIAResponse,
): Record<"ercot-east-wind" | "ercot-east-solar" | "ercot-west-wind" | "ercot-west-solar", RegionData> {
  const windPoints = toPoints(windRaw, WIND_RATE);
  const solarPoints = toPoints(solarRaw ?? { response: { total: 0, data: [] } }, SOLAR_RATE);

  const windWestPoints = scalePoints(windPoints, ERCOT_WEST_SHARE);
  const windEastPoints = scalePoints(windPoints, ERCOT_EAST_SHARE);
  const solarWestPoints = scalePoints(solarPoints, ERCOT_WEST_SHARE);
  const solarEastPoints = scalePoints(solarPoints, ERCOT_EAST_SHARE);

  const windWestLast = windWestPoints.at(-1)?.utcTimestamp ?? new Date().toISOString();
  const windEastLast = windEastPoints.at(-1)?.utcTimestamp ?? new Date().toISOString();
  const solarWestLast = solarWestPoints.at(-1)?.utcTimestamp ?? new Date().toISOString();
  const solarEastLast = solarEastPoints.at(-1)?.utcTimestamp ?? new Date().toISOString();

  const windTotalMw = windPoints.reduce((s, p) => s + p.mw, 0);
  const solarTotalMw = solarPoints.reduce((s, p) => s + p.mw, 0);
  const denom = windTotalMw + solarTotalMw;
  const fuelShare = denom > 0
    ? { wind: windTotalMw / denom, solar: solarTotalMw / denom }
    : { wind: 1, solar: 0 };

  return {
    "ercot-west-wind": {
      regionId: "ercot-west-wind",
      profile: timeOfDayAverageGW(windWestPoints),
      latestProfile: latestCompleteUtcDayProfileGW(windWestPoints),
      totalTWh: totalTWh30d(windWestPoints),
      peakGW: peakGW(windWestPoints),
      lastUpdated: windWestLast,
      lastSuccessAt: windWestLast,
      sourceNote: `EIA ERCO wind × ${(WIND_RATE * 100).toFixed(2)}% calibrated curtailment, illustrative 66% West/Panhandle split`,
      fuelShare,
    },
    "ercot-west-solar": {
      regionId: "ercot-west-solar",
      profile: timeOfDayAverageGW(solarWestPoints),
      latestProfile: latestCompleteUtcDayProfileGW(solarWestPoints),
      totalTWh: totalTWh30d(solarWestPoints),
      peakGW: peakGW(solarWestPoints),
      lastUpdated: solarWestLast,
      lastSuccessAt: solarWestLast,
      sourceNote: `EIA ERCO solar × ${(SOLAR_RATE * 100).toFixed(1)}% calibrated curtailment, illustrative 66% West/Panhandle split`,
      fuelShare,
    },
    "ercot-east-wind": {
      regionId: "ercot-east-wind",
      profile: timeOfDayAverageGW(windEastPoints),
      latestProfile: latestCompleteUtcDayProfileGW(windEastPoints),
      totalTWh: totalTWh30d(windEastPoints),
      peakGW: peakGW(windEastPoints),
      lastUpdated: windEastLast,
      lastSuccessAt: windEastLast,
      sourceNote: `EIA ERCO wind × ${(WIND_RATE * 100).toFixed(2)}% calibrated curtailment, illustrative 34% East/Central split`,
      fuelShare,
    },
    "ercot-east-solar": {
      regionId: "ercot-east-solar",
      profile: timeOfDayAverageGW(solarEastPoints),
      latestProfile: latestCompleteUtcDayProfileGW(solarEastPoints),
      totalTWh: totalTWh30d(solarEastPoints),
      peakGW: peakGW(solarEastPoints),
      lastUpdated: solarEastLast,
      lastSuccessAt: solarEastLast,
      sourceNote: `EIA ERCO solar × ${(SOLAR_RATE * 100).toFixed(1)}% calibrated curtailment, illustrative 34% East/Central split`,
      fuelShare,
    },
  };
}

async function fetchFueltype(apiKey: string, fueltype: "WND" | "SUN"): Promise<EIAResponse> {
  const now = new Date();
  const end = now.toISOString().slice(0, 13);
  const start = new Date(now.getTime() - 30 * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 13);
  const params = new URLSearchParams({
    api_key: apiKey,
    frequency: "hourly",
    "data[0]": "value",
    "facets[respondent][]": "ERCO",
    "facets[fueltype][]": fueltype,
    start,
    end,
    "sort[0][column]": "period",
    "sort[0][direction]": "asc",
    length: "5000",
  });
  return fetchJSON<EIAResponse>(`${API_BASE}?${params.toString()}`);
}

const run = async (): Promise<Record<"ercot-east-wind" | "ercot-east-solar" | "ercot-west-wind" | "ercot-west-solar", RegionData>> => {
  const apiKey = process.env.EIA_API_KEY;
  if (!apiKey) throw new Error("EIA_API_KEY not set");
  const [wind, solar] = await Promise.all([
    fetchFueltype(apiKey, "WND"),
    fetchFueltype(apiKey, "SUN").catch((err) => {
      console.warn(`ERCOT SUN fetch failed, continuing wind-only: ${(err as Error).message}`);
      return undefined;
    }),
  ]);
  return parseErcotPerFuel(wind, solar);
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<Record<"ercot-east-wind" | "ercot-east-solar" | "ercot-west-wind" | "ercot-west-solar", RegionData>>("ercot", run, {
    regionTier: "live" as const,
    tagLive: (r) => r,
    tagCached: (c) => c,
  })
    .then((data) => {
      process.stdout.write(JSON.stringify(data));
    })
    .catch((err) => {
      console.error("ercot loader failed", err);
      process.exit(1);
    });
}