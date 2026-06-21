import { pathToFileURL } from "url";
import { buildTypicalSolarRegion, buildTypicalWindRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

/**
 * Philippines — T3 estimated.
 *
 * History:
 *   - 2026-04-30: Split from a single composite 0.5 TWh entry (philippines)
 *     into philippines-solar and philippines-wind. The prior 0.5 TWh anchor
 *     was based on an invented 2% curtailment rate with no published source.
 *   - 2026-06-18: IEMOP RTD archive (iemop.ph) probed — RTD carries SCHED_MW
 *     only (dispatched generation), no available-capacity column. Curtailment
 *     cannot be measured from this feed. No published curtailment rate
 *     available from IEMOP/WESM. Held at estimated.
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
 * Path back to T1b: IEMOP would need to publish explicit curtailment reports
 * (analogous to ENTSO-E B19 dispatch-down), or integrate satellite irradiance
 * + wind-speed CF model alongside RTD dispatch.
 */

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
  "IRENA Philippines RE Statistics 2024 anchor (~0.04 TWh/yr solar, ~0.02 TWh/yr wind). " +
  "IEMOP RTD archive probed 2026-06-18 — RTD carries SCHED_MW only (dispatch schedules), " +
  "no available-capacity column. No published curtailment rate available from IEMOP/WESM. " +
  "Typical-profile fallback used; held at estimated until IEMOP publishes explicit " +
  "curtailment data or a machine-readable alternative appears.";

function buildData(): Record<string, RegionData> {
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
  process.stdout.write(JSON.stringify(buildData()));
}

export const buildPhilippinesData = () => buildData();
