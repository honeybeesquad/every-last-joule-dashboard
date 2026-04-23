import { fetchJSON } from "./fetch.js";
import { timeOfDayAverageGW, totalTWh30d, peakGW, latestCompleteUtcDayProfileGW } from "./profile.js";
import { withFallback } from "./resilient.js";
import type { CurtailmentPoint, RegionData } from "./types.js";
import { pathToFileURL } from "url";

const API_BASE = "https://api.eia.gov/v2/electricity/rto/fuel-type-data/data/";

export interface EIAResponse {
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

export interface EiaIsoConfig {
  regionId: string;
  respondent: string;
  displayName: string;
  windRate: number;
  solarRate: number;
}

function mergeSum(a: CurtailmentPoint[], b: CurtailmentPoint[]): CurtailmentPoint[] {
  const map = new Map<string, number>();
  for (const p of a) map.set(p.utcTimestamp, (map.get(p.utcTimestamp) ?? 0) + p.mw);
  for (const p of b) map.set(p.utcTimestamp, (map.get(p.utcTimestamp) ?? 0) + p.mw);
  return Array.from(map.entries())
    .sort(([x], [y]) => x.localeCompare(y))
    .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw }));
}

export function parseEiaIsoRegion(
  config: EiaIsoConfig,
  windRaw: EIAResponse,
  solarRaw?: EIAResponse,
): RegionData {
  const windPoints: CurtailmentPoint[] = windRaw.response.data.map((r) => ({
    utcTimestamp: `${r.period}:00:00Z`,
    mw: Math.max(0, Number(r.value) * config.windRate),
  }));
  const solarPoints: CurtailmentPoint[] = (solarRaw?.response?.data ?? []).map((r) => ({
    utcTimestamp: `${r.period}:00:00Z`,
    mw: Math.max(0, Number(r.value) * config.solarRate),
  }));

  const combined = mergeSum(windPoints, solarPoints);
  const windTotalMw = windPoints.reduce((sum, p) => sum + p.mw, 0);
  const solarTotalMw = solarPoints.reduce((sum, p) => sum + p.mw, 0);
  const denom = windTotalMw + solarTotalMw;
  const fuelShare = denom > 0
    ? { wind: windTotalMw / denom, solar: solarTotalMw / denom }
    : { wind: 1, solar: 0 };
  const lastPeriod = combined.at(-1)?.utcTimestamp ?? new Date().toISOString();

  return {
    regionId: config.regionId,
    profile: timeOfDayAverageGW(combined),
    latestProfile: latestCompleteUtcDayProfileGW(combined),
    totalTWh: totalTWh30d(combined),
    peakGW: peakGW(combined),
    lastUpdated: lastPeriod,
    sourceNote: `EIA ${config.respondent} hourly wind × ${(config.windRate * 100).toFixed(1)}% + solar × ${(config.solarRate * 100).toFixed(1)}% calibrated curtailment (observed 30d split: wind ${(fuelShare.wind * 100).toFixed(0)}% / solar ${(fuelShare.solar * 100).toFixed(0)}%)`,
    fuelShare,
  };
}

async function fetchFueltype(
  apiKey: string,
  respondent: string,
  fueltype: "WND" | "SUN",
): Promise<EIAResponse> {
  const now = new Date();
  const end = now.toISOString().slice(0, 13);
  const start = new Date(now.getTime() - 30 * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 13);
  const params = new URLSearchParams({
    api_key: apiKey,
    frequency: "hourly",
    "data[0]": "value",
    "facets[respondent][]": respondent,
    "facets[fueltype][]": fueltype,
    start,
    end,
    "sort[0][column]": "period",
    "sort[0][direction]": "asc",
    length: "5000",
  });
  return fetchJSON<EIAResponse>(`${API_BASE}?${params.toString()}`);
}

export function buildEiaIsoRegion(config: EiaIsoConfig) {
  const parse = (windRaw: EIAResponse, solarRaw?: EIAResponse) => parseEiaIsoRegion(config, windRaw, solarRaw);

  const run = async (): Promise<RegionData> => {
    const apiKey = process.env.EIA_API_KEY;
    if (!apiKey) throw new Error("EIA_API_KEY not set");
    const [wind, solar] = await Promise.all([
      fetchFueltype(apiKey, config.respondent, "WND"),
      fetchFueltype(apiKey, config.respondent, "SUN").catch((err) => {
        console.warn(`${config.displayName} SUN fetch failed, continuing wind-only: ${(err as Error).message}`);
        return undefined;
      }),
    ]);
    return parse(wind, solar);
  };

  const runCli = async (): Promise<void> => {
    const data = await withFallback<RegionData>(config.regionId, run, {
      tagLive: (r) => ({ ...r, sourceStatus: "live" as const }),
      tagCached: (c) => ({ ...c, sourceStatus: "cached" as const }),
    });
    process.stdout.write(JSON.stringify(data));
  };

  const isMain = (metaUrl: string) => Boolean(process.argv[1] && metaUrl === pathToFileURL(process.argv[1]).href);

  return { parse, run, runCli, isMain };
}
