import { fetchJSON } from "../../lib/fetch.js";
import { timeOfDayAverageGW, totalTWh30d, peakGW } from "../../lib/profile.js";
import type { RegionData, CurtailmentPoint } from "../../lib/types.js";

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

/** Pure parser: EIA JSON in, RegionData out. Exported for unit tests. */
export function parseErcot(raw: EIAResponse): RegionData {
  const records = raw.response.data;
  const points: CurtailmentPoint[] = records.map((r) => {
    // Period like "2026-04-21T04" is UTC-hour. Append ":00:00Z" for ISO.
    const utcTimestamp = `${r.period}:00:00Z`;
    const windMW = Number(r.value);
    const curtailmentMW = Math.max(0, windMW * CURTAILMENT_RATE);
    return { utcTimestamp, mw: curtailmentMW };
  });

  const profile = timeOfDayAverageGW(points);
  return {
    regionId: "ercot",
    profile,
    totalTWh: totalTWh30d(points),
    peakGW: peakGW(points),
    lastUpdated: records.at(-1)?.period ?? new Date().toISOString(),
    sourceNote: "EIA hourly wind × 6.15% calibrated curtailment rate (ERCOT 2024 actuals)",
  };
}

async function run(): Promise<RegionData> {
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
}

run()
  .then((data) => {
    process.stdout.write(JSON.stringify(data));
  })
  .catch((err) => {
    console.error("ercot loader failed", err);
    process.exit(1);
  });
