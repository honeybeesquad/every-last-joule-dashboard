import { pathToFileURL } from "url";
import { buildTypicalSolarRegion, buildTypicalWindRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

/**
 * Philippines — typical-shape fallback (T3-static), split by fuel.
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
 *   model not present in any public IEMOP feed. T3 is therefore correct.
 *
 * Split into solar + wind so the dashboard renders each fuel correctly.
 * Both remain T3 until IEMOP/WESM publishes a citable curtailment rate.
 *
 * Path back to T1b: integrate satellite irradiance + wind-speed CF model
 * alongside RTD dispatch, or wait for IEMOP to publish explicit curtailment
 * reports (analogous to ENTSO-E B19 dispatch-down).
 */

const SOLAR_REGION_ID = "philippines-solar";
const WIND_REGION_ID = "philippines-wind";

// Provisional anchors from IRENA Philippines RE Statistics 2024.
// PHL solar generation ~3 TWh/yr, wind ~1 TWh/yr. Small placeholders that
// reflect data uncertainty rather than asserting a measured volume.
const SOLAR_ANCHOR_TWH = 0.04;
const WIND_ANCHOR_TWH = 0.02;

// Philippines is UTC+8 — local solar noon = 04:00 UTC.
const LOCAL_SOLAR_PEAK_UTC = 4;

const SOURCE_NOTE =
  "Typical-shape fallback: IEMOP RTD endpoint exposes current-day dispatch schedules, not curtailed-energy. The 2% rate previously applied was an invented placeholder with no published source. Provisional anchor from IRENA Philippines RE Statistics 2024 (~0.04 TWh/yr solar + ~0.02 TWh/yr wind). Held at T3 until IEMOP/WESM publishes a citable renewable-curtailment rate.";

export function buildPhilippinesData(): Record<string, RegionData> {
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

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  process.stdout.write(JSON.stringify(buildPhilippinesData()));
}
