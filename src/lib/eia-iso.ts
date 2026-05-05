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
  /**
   * Default fuel share used by the stale-cache shape adapter when the
   * EIA-fail fallback path returns a pre-Phase-3b aggregate snapshot
   * (regionId="<iso>", flat profile). The adapter splits the aggregate
   * profile into wind/solar children using this share so consumer lookups
   * like `caiso["caiso-wind"]` succeed instead of returning undefined and
   * crashing aggregateAtHour. Tuned loosely to recent observed VRE mix
   * per RTO; only matters during the EIA-outage window before the next
   * cron-bot regen overwrites the snapshot with real per-fuel data.
   */
  fallbackSplit?: { wind: number; solar: number };
}

/**
 * Stale-cache shape adapter. Pre-Phase-3b ISO snapshots have aggregate
 * shape ({regionId, profile, ...} as a flat RegionData with merged
 * wind+solar curtailment). The Phase-3b loaders return per-fuel shape
 * ({wind, solar}). On the EIA-fail fallback path withFallback hands us
 * the on-disk shape verbatim, so without this adapter `caiso["caiso-wind"]`
 * resolves to undefined and the dashboard crashes in regionGWAtHour
 * (same crash class as malta and baltics — see
 * memory/feedback_loader_wiring_pattern.md).
 *
 * Idempotent: passes through already-per-fuel cache contents unchanged.
 */
export function adaptCachedAggregateToPerFuel(
  cached: unknown,
  regionId: string,
  fallbackSplit: { wind: number; solar: number },
): { wind: RegionData; solar: RegionData } {
  if (
    cached &&
    typeof cached === "object" &&
    "wind" in cached &&
    "solar" in cached
  ) {
    return cached as { wind: RegionData; solar: RegionData };
  }

  const agg = cached as RegionData;
  const note = ` [stale-cache: aggregate split via fallback adapter — replaced on next loader regen]`;
  // Strip aggregate's fuelShare (a country/zone-level mix) when scaling
  // down to a per-fuel slice. dominantFuel must derive from region.kind,
  // not from a shared mix that would collapse all fuels to one colour.
  const { fuelShare: _aggFuelShare, ...aggBase } = agg;
  const scale = (share: number, suffix: "wind" | "solar"): RegionData => ({
    ...aggBase,
    regionId: `${regionId}-${suffix}`,
    profile: agg.profile.map((g) => g * share),
    latestProfile: agg.latestProfile ? agg.latestProfile.map((g) => g * share) : null,
    peakGW: (agg.peakGW ?? 0) * share,
    totalTWh: (agg.totalTWh ?? 0) * share,
    sourceNote: `${agg.sourceNote ?? ""}${note}`,
  });

  return {
    wind: scale(fallbackSplit.wind, "wind"),
    solar: scale(fallbackSplit.solar, "solar"),
  };
}

function mergeSum(a: CurtailmentPoint[], b: CurtailmentPoint[]): CurtailmentPoint[] {
  const map = new Map<string, number>();
  for (const p of a) map.set(p.utcTimestamp, (map.get(p.utcTimestamp) ?? 0) + p.mw);
  for (const p of b) map.set(p.utcTimestamp, (map.get(p.utcTimestamp) ?? 0) + p.mw);
  return Array.from(map.entries())
    .sort(([x], [y]) => x.localeCompare(y))
    .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw }));
}

function toPoints(raw: EIAResponse, rate: number): CurtailmentPoint[] {
  return raw.response.data.map((r) => ({
    utcTimestamp: `${r.period}:00:00Z`,
    mw: Math.max(0, Number(r.value) * rate),
  }));
}

export function parseEiaIsoRegionPerFuel(
  config: EiaIsoConfig,
  windRaw: EIAResponse,
  solarRaw?: EIAResponse,
): { wind: RegionData; solar: RegionData } {
  const windPoints = toPoints(windRaw, config.windRate);
  const solarPoints = toPoints(solarRaw ?? { response: { total: 0, data: [] } }, config.solarRate);

  const windLast = windPoints.at(-1)?.utcTimestamp ?? new Date().toISOString();
  const solarLast = solarPoints.at(-1)?.utcTimestamp ?? new Date().toISOString();

  const windTotalMw = windPoints.reduce((s, p) => s + p.mw, 0);
  const solarTotalMw = solarPoints.reduce((s, p) => s + p.mw, 0);
  const denom = windTotalMw + solarTotalMw;
  const fuelShare = denom > 0
    ? { wind: windTotalMw / denom, solar: solarTotalMw / denom }
    : { wind: 1, solar: 0 };

  const wind: RegionData = {
    regionId: `${config.regionId}-wind`,
    profile: timeOfDayAverageGW(windPoints),
    latestProfile: latestCompleteUtcDayProfileGW(windPoints),
    totalTWh: totalTWh30d(windPoints),
    peakGW: peakGW(windPoints),
    lastUpdated: windLast,
    lastSuccessAt: windLast,
    sourceNote: `EIA ${config.respondent} wind × ${(config.windRate * 100).toFixed(1)}% calibrated curtailment (observed 30d share: wind ${(fuelShare.wind * 100).toFixed(0)}%)`,
  };

  const solar: RegionData = {
    regionId: `${config.regionId}-solar`,
    profile: timeOfDayAverageGW(solarPoints),
    latestProfile: latestCompleteUtcDayProfileGW(solarPoints),
    totalTWh: totalTWh30d(solarPoints),
    peakGW: peakGW(solarPoints),
    lastUpdated: solarLast,
    lastSuccessAt: solarLast,
    sourceNote: `EIA ${config.respondent} solar × ${(config.solarRate * 100).toFixed(1)}% calibrated curtailment (observed 30d share: solar ${(fuelShare.solar * 100).toFixed(0)}%)`,
  };

  return { wind, solar };
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
    lastSuccessAt: lastPeriod,
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
      regionTier: "live" as const,
      tagLive: (r) => ({ ...r, sourceStatus: "live" as const }),
      tagCached: (c) => ({ ...c, sourceStatus: "cached" as const }),
    });
    process.stdout.write(JSON.stringify(data));
  };

  const isMain = (metaUrl: string) => Boolean(process.argv[1] && metaUrl === pathToFileURL(process.argv[1]).href);

  return { parse, run, runCli, isMain };
}

export function buildEiaIsoRegionPerFuel(config: EiaIsoConfig) {
  const parsePerFuel = (windRaw: EIAResponse, solarRaw?: EIAResponse) =>
    parseEiaIsoRegionPerFuel(config, windRaw, solarRaw);

  const run = async (): Promise<{ wind: RegionData; solar: RegionData }> => {
    const apiKey = process.env.EIA_API_KEY;
    if (!apiKey) throw new Error("EIA_API_KEY not set");
    const [wind, solar] = await Promise.all([
      fetchFueltype(apiKey, config.respondent, "WND"),
      fetchFueltype(apiKey, config.respondent, "SUN").catch((err) => {
        console.warn(`${config.displayName} SUN fetch failed, continuing wind-only: ${(err as Error).message}`);
        return undefined;
      }),
    ]);
    return parsePerFuel(wind, solar);
  };

  const fallbackSplit = config.fallbackSplit ?? { wind: 0.5, solar: 0.5 };

  const runCli = async (): Promise<void> => {
    const data = await withFallback<{ wind: RegionData; solar: RegionData }>(
      config.regionId,
      run,
      {
        regionTier: "live" as const,
        tagLive: (r) => r,
        tagCached: (c) =>
          adaptCachedAggregateToPerFuel(c, config.regionId, fallbackSplit),
      },
    );
    process.stdout.write(JSON.stringify(data));
  };

  const isMain = (metaUrl: string) => Boolean(process.argv[1] && metaUrl === pathToFileURL(process.argv[1]).href);

  return { parsePerFuel, run, runCli, isMain };
}
