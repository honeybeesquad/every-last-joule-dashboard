import { fetchJSON } from "../lib/fetch.js";
import { timeOfDayAverageGW, totalTWh30d, peakGW, latestCompleteUtcDayProfileGW } from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import type { RegionData, CurtailmentPoint } from "../lib/types.js";
import { pathToFileURL } from "url";

/**
 * ERCOT (Texas) wind + solar curtailment loader - v0 proxy.
 *
 * Source: EIA Hourly Electric Grid Monitor, ERCO respondent, WND and SUN
 * fueltypes fetched in parallel and merged.
 * Endpoint docs: https://www.eia.gov/opendata/browser/electricity/rto/fuel-type-data
 *
 * Curtailment derivation: EIA does not directly publish curtailment. We apply
 * separate calibrated proxy rates to hourly wind and solar generation:
 *   wind  → 6.15 %  (ERCOT 2024: ~8 TWh wind curtailed / ~130 TWh wind gen)
 *   solar → 4.0 %   (ERCOT 2024: ~0.8 TWh solar curtailed / ~20 TWh solar gen;
 *                    rising fast with Lamesa / Roadrunner / Phoebe clusters)
 * Rates per Potomac Economics 2024 ERCOT State of the Market figures
 * and public ERCOT/EIA generation data. The West/East allocation below is
 * illustrative because no public ERCOT zonal dispatch-down series was found;
 * it preserves the book-derived 66/34 West+Panhandle split pending a native
 * ERCOT zonal curtailment feed.
 *
 * The resulting per-hour series is wind-heavy overnight (Generic Transmission
 * Constraints bind on West Texas wind) and solar-peaky mid-day in West Texas
 * transmission bottlenecks.
 *
 * Emits a dynamic fuelShare per sub-region derived from observed MW volumes so
 * hotspot bucketing reflects the real wind/solar mix, not a static kind.
 */

const WIND_RATE = 0.0615;
const SOLAR_RATE = 0.04;
// Illustrative, derived from Gates 2024 book research: West+Panhandle
// 5.3 TWh of about 8 TWh 2024 ERCOT curtailment. Not an ERCOT-published
// zonal curtailment statistic; see docs/methodology/flare-ercot-brazil.md.
const ERCOT_WEST_SHARE = 0.66;
const ERCOT_EAST_SHARE = 0.34;

const API_BASE = "https://api.eia.gov/v2/electricity/rto/fuel-type-data/data/";

interface EIAResponse {
  response: {
    total: string | number;
    data: Array<{
      period: string;     // "YYYY-MM-DDTHH" in UTC
      respondent: string;
      fueltype: string;   // "WND" | "SUN" | ...
      value: string;      // MWh
    }>;
  };
  warnings?: unknown;
}

function mergeSum(a: CurtailmentPoint[], b: CurtailmentPoint[]): CurtailmentPoint[] {
  const map = new Map<string, number>();
  for (const p of a) map.set(p.utcTimestamp, (map.get(p.utcTimestamp) ?? 0) + p.mw);
  for (const p of b) map.set(p.utcTimestamp, (map.get(p.utcTimestamp) ?? 0) + p.mw);
  return Array.from(map.entries())
    .sort(([x], [y]) => x.localeCompare(y))
    .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw }));
}

function scaleRegion(
  base: RegionData,
  regionId: string,
  share: number,
  sourceNote: string,
  fuelShare?: { wind: number; solar: number },
): RegionData {
  return {
    ...base,
    regionId,
    profile: base.profile.map((gw) => gw * share),
    latestProfile: base.latestProfile?.map((gw) => gw * share) ?? null,
    totalTWh: base.totalTWh * share,
    peakGW: base.peakGW * share,
    sourceNote,
    ...(fuelShare ? { fuelShare } : {}),
  };
}

/** Pure parser: EIA JSON in (possibly multi-fueltype), split RegionData out. */
export function parseErcot(
  windRaw: EIAResponse,
  solarRaw?: EIAResponse,
): Record<"ercot-west" | "ercot-east", RegionData> {
  const windPoints: CurtailmentPoint[] = windRaw.response.data.map((r) => ({
    utcTimestamp: `${r.period}:00:00Z`,
    mw: Math.max(0, Number(r.value) * WIND_RATE),
  }));
  const solarPoints: CurtailmentPoint[] = (solarRaw?.response?.data ?? []).map((r) => ({
    utcTimestamp: `${r.period}:00:00Z`,
    mw: Math.max(0, Number(r.value) * SOLAR_RATE),
  }));

  const combined = mergeSum(windPoints, solarPoints);

  const windTotalMw = windPoints.reduce((s, p) => s + p.mw, 0);
  const solarTotalMw = solarPoints.reduce((s, p) => s + p.mw, 0);
  const denom = windTotalMw + solarTotalMw;
  const fuelShare = denom > 0
    ? { wind: windTotalMw / denom, solar: solarTotalMw / denom }
    : { wind: 1, solar: 0 };

  const lastPeriod = combined.at(-1)?.utcTimestamp ?? new Date().toISOString();

  const base: RegionData = {
    regionId: "ercot",
    profile: timeOfDayAverageGW(combined),
    latestProfile: latestCompleteUtcDayProfileGW(combined),
    totalTWh: totalTWh30d(combined),
    peakGW: peakGW(combined),
    lastUpdated: lastPeriod,
    lastSuccessAt: lastPeriod,
    sourceNote: `EIA hourly wind × ${(WIND_RATE * 100).toFixed(2)}% + solar × ${(SOLAR_RATE * 100).toFixed(1)}% calibrated curtailment (observed 30d split: wind ${(fuelShare.wind * 100).toFixed(0)}% / solar ${(fuelShare.solar * 100).toFixed(0)}%)`,
  };

  const shareNote = `wind ${(fuelShare.wind * 100).toFixed(0)}% / solar ${(fuelShare.solar * 100).toFixed(0)}%`;

  return {
    "ercot-west": scaleRegion(
      base,
      "ercot-west",
      ERCOT_WEST_SHARE,
      `EIA ERCO wind+solar × calibrated rates, illustrative 66% West/Panhandle book-derived split (${shareNote})`,
      fuelShare,
    ),
    "ercot-east": scaleRegion(
      base,
      "ercot-east",
      ERCOT_EAST_SHARE,
      `EIA ERCO wind+solar × calibrated rates, illustrative 34% East/Central book-derived split (${shareNote})`,
      fuelShare,
    ),
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

const run = async (): Promise<Record<"ercot-west" | "ercot-east", RegionData>> => {
  const apiKey = process.env.EIA_API_KEY;
  if (!apiKey) throw new Error("EIA_API_KEY not set");
  const [wind, solar] = await Promise.all([
    fetchFueltype(apiKey, "WND"),
    fetchFueltype(apiKey, "SUN").catch((err) => {
      console.warn(`ERCOT SUN fetch failed, continuing wind-only: ${(err as Error).message}`);
      return undefined;
    }),
  ]);
  return parseErcot(wind, solar);
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<Record<"ercot-west" | "ercot-east", RegionData>>("ercot", run, {
    regionTier: "live" as const,
    tagLive: (r) => ({
      "ercot-west": { ...r["ercot-west"], sourceStatus: "live" as const },
      "ercot-east": { ...r["ercot-east"], sourceStatus: "live" as const },
    }),
    tagCached: (c) => ({
      "ercot-west": { ...c["ercot-west"], sourceStatus: "cached" as const },
      "ercot-east": { ...c["ercot-east"], sourceStatus: "cached" as const },
    }),
  })
    .then((data) => {
      process.stdout.write(JSON.stringify(data));
    })
    .catch((err) => {
      console.error("ercot loader failed", err);
      process.exit(1);
    });
}
