import { pathToFileURL } from "url";
import { buildTypicalSolarRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "florida";
const ANNUAL_ANCHOR_TWH = 0.5;

// Florida at lon −81.2°E → localSolarPeakUTC = 12.0 − (−81.2 / 15) = 17.4 ≈ UTC 17.
const LOCAL_SOLAR_PEAK_UTC = 17;

export function buildFloridaData(): RegionData {
  return buildTypicalSolarRegion(
    REGION_ID,
    LOCAL_SOLAR_PEAK_UTC,
    ANNUAL_ANCHOR_TWH,
    "Typical-shape fallback: EIA Hourly Grid Monitor FLA exposes solar generation (SUN+SNB), not curtailed solar. A provisional ~0.5 TWh/yr anchor is retained from FPL IRP / FRCC-style low-curtailment assumptions, but this remains T3 until a public curtailed-energy annual figure or measured hourly curtailment feed is verified.",
    "2024",
  );
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  process.stdout.write(JSON.stringify(buildFloridaData()));
}
