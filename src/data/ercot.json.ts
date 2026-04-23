import { fetchJSON } from "../lib/fetch.js";
import { timeOfDayAverageGW, totalTWh30d, peakGW, latestCompleteUtcDayProfileGW } from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import type { RegionData, CurtailmentPoint } from "../lib/types.js";
import { pathToFileURL } from "url";

/**
 * ERCOT (Texas) wind curtailment loader - v0 proxy.
 *
 * Source: EIA Hourly Electric Grid Monitor, ERCO respondent, WND fueltype.
 * Endpoint docs: https://www.eia.gov/opendata/browser/electricity/rto/fuel-type-data
 *
 * Curtailment derivation: EIA does not directly publish curtailment. We apply
 * a calibrated proxy rate of 6.15 % to hourly wind generation. The rate is
 * ERCOT's 2024 curtailment ratio (8 TWh curtailed / 130 TWh generated) per
 * Modo Energy and the book's `research/energy_arithmetic.md`.
 *
 * The 30-day time-of-day average of the resulting series inherits the real
 * diurnal wind shape - night-heavy - which matches ERCOT's actual curtailment
 * pattern (overnight low-demand plus high-wind hours are when Generic
 * Transmission Constraints bind most often).
 *
 * v0.5 upgrade path: swap to native ERCOT 5-minute dispatch-down data once
 * the VPN+CI pattern is in place. See docs/data-source-log.md.
 */

const CURTAILMENT_RATE = 0.0615;

const API_BASE = "https://api.eia.gov/v2/electricity/rto/fuel-type-data/data/";

interface EIAResponse {
  response: {
    total: string | number;
    data: Array<{
      period: string;     // "YYYY-MM-DDTHH" in UTC
      respondent: string;
      fueltype: string;
      value: string;      // MWh, stringified
    }>;
  };
  warnings?: unknown;
}

function scaleRegion(base: RegionData, regionId: string, share: number, sourceNote: string): RegionData {
  return {
    ...base,
    regionId,
    profile: base.profile.map((gw) => gw * share),
    latestProfile: base.latestProfile?.map((gw) => gw * share) ?? null,
    totalTWh: base.totalTWh * share,
    peakGW: base.peakGW * share,
    sourceNote,
  };
}

/** Pure parser: EIA JSON in, split RegionData out. Exported for unit tests. */
export function parseErcot(raw: EIAResponse): Record<"ercot-west" | "ercot-east", RegionData> {
  const records = raw.response.data;
  const points: CurtailmentPoint[] = records.map((r) => {
    // Period like "2026-04-21T04" is UTC-hour. Append ":00:00Z" for ISO.
    const utcTimestamp = `${r.period}:00:00Z`;
    const windMW = Number(r.value);
    const curtailmentMW = Math.max(0, windMW * CURTAILMENT_RATE);
    return { utcTimestamp, mw: curtailmentMW };
  });

  const base: RegionData = {
    regionId: "ercot",
    profile: timeOfDayAverageGW(points),
    latestProfile: latestCompleteUtcDayProfileGW(points),
    totalTWh: totalTWh30d(points),
    peakGW: peakGW(points),
    lastUpdated: records.at(-1)?.period ?? new Date().toISOString(),
    sourceNote: "EIA hourly wind × 6.15% calibrated curtailment rate (ERCOT 2024 actuals)",
  };

  return {
    "ercot-west": scaleRegion(
      base,
      "ercot-west",
      0.66,
      "EIA hourly wind × 6.15% calibrated curtailment rate, split 66% West/Panhandle (ERCOT 2024 actuals)",
    ),
    "ercot-east": scaleRegion(
      base,
      "ercot-east",
      0.34,
      "EIA hourly wind × 6.15% calibrated curtailment rate, split 34% East/Central (ERCOT 2024 actuals)",
    ),
  };
}

const run = async (): Promise<Record<"ercot-west" | "ercot-east", RegionData>> => {
  const apiKey = process.env.EIA_API_KEY;
  if (!apiKey) throw new Error("EIA_API_KEY not set");

  const now = new Date();
  const end = now.toISOString().slice(0, 13);                        // YYYY-MM-DDTHH
  const start = new Date(now.getTime() - 30 * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 13);

  const params = new URLSearchParams({
    api_key: apiKey,
    frequency: "hourly",
    "data[0]": "value",
    "facets[respondent][]": "ERCO",
    "facets[fueltype][]": "WND",
    start,
    end,
    "sort[0][column]": "period",
    "sort[0][direction]": "asc",
    length: "5000",
  });
  const url = `${API_BASE}?${params.toString()}`;
  const raw = await fetchJSON<EIAResponse>(url);
  return parseErcot(raw);
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<Record<"ercot-west" | "ercot-east", RegionData>>("ercot", run, {
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
