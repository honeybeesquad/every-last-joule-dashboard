import { pathToFileURL } from "url";
import { buildTypicalSolarRegion, buildTypicalWindRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

/**
 * Philippines — typical-shape fallback (T3-static).
 *
 * History: was promoted T3-static → T1a live in commit ef953c4 via the
 * IEMOP RTD dispatch endpoint × an invented 2% curtailment rate. Reverted
 * 2026-04-29 because:
 *   - IEMOP RTD exposes current-day dispatch schedules, not curtailed-energy
 *     (same demotion rationale that retired malaysia / taiwan / dominican-
 *     republic from T1b → T3 in the prior commit).
 *   - The 2% rate had no published source: not in IEMOP, WESM, NGCP, DOE
 *     PEP, or any cited document. Per `docs/methodology/tier-classification-
 *     guide.md` §"What this does NOT accept" for T1a: "An estimated rate
 *     invented without a published source."
 *
 * Path back to T1: a published renewable curtailment rate or a reproducible
 * derivation from explicit dispatch-vs-schedule data. Until then, this is a
 * provisional solar+wind anchor against IRENA Philippines RE Statistics 2024.
 *
 * Loader emits two regions (philippines-solar, philippines-wind) so the
 * existing per-fuel-split snapshot shape is preserved. Both rows route
 * through `deriveTier` to T3-modelled (static + solar / static + wind).
 */

const SOLAR_REGION_ID = "philippines-solar";
const WIND_REGION_ID = "philippines-wind";

// Provisional anchors. PHL solar generation ~3 TWh/yr, wind ~1 TWh/yr (IRENA
// 2024). At a low-single-digit curtailment placeholder these become small
// enough that the figure mostly carries the candid disclosure rather than
// asserting a measured volume. Update if/when a published rate is found.
const SOLAR_ANCHOR_TWH = 0.04;
const WIND_ANCHOR_TWH = 0.02;

// Local solar peak: PHL is UTC+8, local noon = 04:00 UTC.
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
