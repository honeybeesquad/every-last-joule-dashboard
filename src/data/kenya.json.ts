import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import {
  buildGeothermalOvernightRegion,
  HYDRO_SEASONAL_SHARES,
} from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

/**
 * Kenya is Africa's clearest case of baseload (geothermal) curtailment as
 * distinct from VRE curtailment. EPRA Kenya Energy & Petroleum Statistics
 * Report (June 2025) documents:
 *   - 668.70 GWh curtailed in year ending June 2025 (down 17.72% YoY from 812.80).
 *   - Curtailment mainly affects geothermal plants resulting in steam venting
 *     that occurs at night between 0000–0500hrs LOCAL.
 *   - Wind plants are only affected when they meet contracted annual generation
 *     thresholds; no wind curtailment in the reporting period.
 *   - Monthly peak July 2024: 117.5 GWh; low June 2025: 6.6 GWh.
 *
 * Kenya local time is UTC+3. "0000–0500 local" = UTC 21:00–02:00. We model as
 * a raised-cosine bump centred on UTC 23:30 with half-width 2.5 hours, so the
 * profile is zero during daytime and peaks overnight — matches EPRA's
 * literal description of the curtailment window.
 *
 * Seasonal scaling from HYDRO_SEASONAL_SHARES.kenya applies a July-peak /
 * June-trough monthly scalar based on EPRA's published month-by-month totals.
 */

const REGION_ID = "kenya";
const ANNUAL_TWH = 0.669;           // EPRA FY2024/25
const PEAK_UTC_HOUR = 23.5;         // middle of UTC 21-02 venting window
const HALF_WIDTH_HOURS = 2.5;       // ~5-hour total window
const SOURCE_URL = "https://www.epra.go.ke/publications/";

async function run({ probe = true } = {}): Promise<RegionData> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      // EPRA publishes annual PDFs, not an hourly feed. Fall back to the
      // documented overnight pattern with seasonal scaling.
      throw new Error("EPRA publications page reachable but hourly curtailment feed is PDF-only, not machine-readable");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    return buildGeothermalOvernightRegion(
      REGION_ID,
      ANNUAL_TWH,
      PEAK_UTC_HOUR,
      HALF_WIDTH_HOURS,
      HYDRO_SEASONAL_SHARES.kenya,
      `Calibrated overnight-geothermal fallback per EPRA 2025 (${(err as Error).message}); 668.70 GWh FY2024/25 venting in UTC 21:00–02:00 window, Olkaria / Menengai geothermal fields`,
      "2025-06",
    );
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback(REGION_ID, () => run())
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("kenya loader failed", err);
      process.exit(1);
    });
}

export const buildKenyaData = () => run({ probe: false });
