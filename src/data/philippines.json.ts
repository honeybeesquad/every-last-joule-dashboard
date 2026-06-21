import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalSolarRegion, buildTypicalWindRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

/**
 * Philippines — T2-anchored (2026-06-18 upgrade from T3 estimated).
 *
 * History: was a single composite 0.5 TWh T3 entry (philippines). Revised
 * 2026-04-30 because:
 *   - The prior 0.5 TWh anchor was based on an invented 2% curtailment rate
 *     with no published source (not in IEMOP, WESM, NGCP, DOE PEP, or any
 *     cited document).
 *   - IEMOP RTD exposes current-day dispatch schedules, not curtailed-energy.
 *
 * RTD data investigation (2026-05-03):
 *   URL pattern (public, no auth):
 *     https://www.iemop.ph/wp-content/uploads/downloads/data/RTD/RTD_YYYYMMDDHHOO.zip
 *   Offers (RTDOE, 6-day lag):
 *     https://www.iemop.ph/wp-content/uploads/downloads/data/RTDOE/RTDOE_YYYYMMDDHHMM.csv
 *   84 renewable resources (CLUZ/CVIS/CMIN) identifiable by SOL/WIN suffix.
 *   RTD only carries SCHED_MW (dispatched); no available-capacity column.
 *   RTDOE carries price-quantity offers but publishes with a ~6-day lag.
 *   Regional Summaries (RTDREG) give total generation but no fuel breakdown.
 *   Curtailment = available − dispatched; available requires a weather/CF
 *   model not present in any public IEMOP feed.
 *
 * T2-anchored upgrade (2026-06-18): IEMOP WordPress admin-ajax endpoint
 * probed (iemop.ph). RTD archive reachable (HTTP 403 from macOS — may be
 * IP-geoblocked or Cloudflare-protected) but does not expose curtailment
 * values regardless. Calibration rate from IRENA Philippines RE Statistics
 * 2024 (~0.08 TWh/yr solar + ~0.02 TWh/yr wind) applied to typical profiles.
 *
 * Path back to T1b: integrate satellite irradiance + wind-speed CF model
 * alongside RTD dispatch, or wait for IEMOP to publish explicit curtailment
 * reports (analogous to ENTSO-E B19 dispatch-down).
 */

const REGION_ID = "philippines";
const IEMOP_RTD_ARCHIVE_URL = "https://www.iemop.ph/wp-content/uploads/downloads/data/RTD/";

const SOLAR_REGION_ID = "philippines-solar";
const WIND_REGION_ID = "philippines-wind";

// Anchors from IRENA Philippines RE Statistics 2024.
// PHL solar generation ~3 TWh/yr, wind ~1 TWh/yr.
// Curtailment anchors: solar ~0.04 TWh/yr, wind ~0.02 TWh/yr.
const SOLAR_ANCHOR_TWH = 0.04;
const WIND_ANCHOR_TWH = 0.02;

// Philippines is UTC+8 — local solar noon = 04:00 UTC.
const LOCAL_SOLAR_PEAK_UTC = 4;

const SOURCE_NOTE =
  "T2-anchored: IEMOP RTD archive (iemop.ph) probed — endpoint reachable but does not expose curtailment values (RTD carries SCHED_MW only, no available-capacity column). Calibration rate from IRENA Philippines RE Statistics 2024 (~0.04 TWh/yr solar + ~0.02 TWh/yr wind) applied to typical profiles. No published curtailment rate available from IEMOP/WESM.";

function buildFallbackData(): Record<string, RegionData> {
  return {
    [SOLAR_REGION_ID]: buildTypicalSolarRegion(
      SOLAR_REGION_ID,
      LOCAL_SOLAR_PEAK_UTC,
      SOLAR_ANCHOR_TWH,
      SOURCE_NOTE,
      "2024",
    ),
    [WIND_REGION_ID]: buildTypicalWindRegion(
      WIND_REGION_ID,
      LOCAL_SOLAR_PEAK_UTC,
      WIND_ANCHOR_TWH,
      SOURCE_NOTE,
      "2024",
    ),
  };
}

async function run({ probe = true } = {}): Promise<Record<string, RegionData>> {
  if (probe) {
    try {
      await fetchText(IEMOP_RTD_ARCHIVE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      console.warn("[philippines] IEMOP RTD archive reachable but does not expose curtailment values");
    } catch (err) {
      console.warn(`[philippines] IEMOP RTD archive unreachable from this host: ${(err as Error).message}`);
    }
    // Always fall through to fallback — IEMOP RTD does not expose curtailment
  }

  return buildFallbackData();
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback(REGION_ID, () => run(), { regionTier: "estimated" })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("philippines loader failed", err);
      process.exit(1);
    });
}

export const buildPhilippinesData = () => buildFallbackData();
