import { fetchJSON } from "../../lib/fetch.js";
import { timeOfDayAverageGW, totalTWh30d, peakGW } from "../../lib/profile.js";
import { withFallback } from "../../lib/resilient.js";
import type { RegionData, CurtailmentPoint } from "../../lib/types.js";
import { pathToFileURL } from "url";

/**
 * CAISO (California) solar curtailment loader - v0 proxy.
 *
 * Source: EIA Hourly Electric Grid Monitor, CISO respondent, SUN fueltype.
 * CAISO's own OASIS API has obsolete curtailment-report query names in 2026;
 * EIA publishes the same underlying data with a stable schema.
 *
 * Curtailment derivation: EIA does not directly publish curtailment for
 * CAISO.  We apply a calibrated proxy rate of 4.25% to hourly solar
 * generation.  The rate is CAISO's 2024 curtailment ratio (3.4 TWh
 * curtailed / 80 TWh generated) per Ascend Analytics, CAISO daily reports,
 * and `research/energy_arithmetic.md`.
 *
 * The 30-day time-of-day average inherits the real solar diurnal shape -
 * midday-heavy - which matches CAISO's actual duck-curve curtailment
 * pattern.
 */

const CURTAILMENT_RATE = 0.0425;
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
}

export function parseCaiso(raw: EIAResponse): RegionData {
  const records = raw.response.data;
  const points: CurtailmentPoint[] = records.map((r) => {
    const utcTimestamp = `${r.period}:00:00Z`;
    const solarMW = Math.max(0, Number(r.value));   // clamp negatives
    const curtailmentMW = solarMW * CURTAILMENT_RATE;
    return { utcTimestamp, mw: curtailmentMW };
  });

  return {
    regionId: "caiso",
    profile: timeOfDayAverageGW(points),
    totalTWh: totalTWh30d(points),
    peakGW: peakGW(points),
    lastUpdated: records.at(-1)?.period ?? new Date().toISOString(),
    sourceNote:
      "EIA hourly solar × 4.25% calibrated curtailment rate (CAISO 2024 actuals)",
  };
}

const run = async (): Promise<RegionData> => {
  const apiKey = process.env.EIA_API_KEY;
  if (!apiKey) throw new Error("EIA_API_KEY not set");

  const now = new Date();
  const end = now.toISOString().slice(0, 13);
  const start = new Date(now.getTime() - 30 * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 13);

  const params = new URLSearchParams({
    api_key: apiKey,
    frequency: "hourly",
    "data[0]": "value",
    "facets[respondent][]": "CISO",
    "facets[fueltype][]": "SUN",
    start,
    end,
    "sort[0][column]": "period",
    "sort[0][direction]": "asc",
    length: "5000",
  });
  const url = `${API_BASE}?${params.toString()}`;
  const raw = await fetchJSON<EIAResponse>(url);
  return parseCaiso(raw);
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<RegionData>("caiso", run, {
    tagLive: (r) => ({ ...r, sourceStatus: "live" as const }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" as const }),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("caiso loader failed", err);
      process.exit(1);
    });
}
