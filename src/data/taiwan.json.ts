import { pathToFileURL } from "url";
import { buildTypicalMixedRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "taiwan";
const SOLAR_ANCHOR_TWH = 0.2;
const WIND_ANCHOR_TWH = 0.4;
const ANNUAL_ANCHOR_TWH = SOLAR_ANCHOR_TWH + WIND_ANCHOR_TWH;

export function buildTaiwanData(): RegionData {
  return buildTypicalMixedRegion(
    REGION_ID,
    ANNUAL_ANCHOR_TWH,
    { wind: WIND_ANCHOR_TWH / ANNUAL_ANCHOR_TWH, solar: SOLAR_ANCHOR_TWH / ANNUAL_ANCHOR_TWH },
    "Typical-shape fallback: TAIPOWER genary.json exposes current unit-level output and embedded instantaneous renewable curtailment percentages, but no public 30-day hourly curtailment archive or single published annual curtailed-energy rate was verified. TAIPOWER/TREC/IRENA 2024 anchor retained provisionally at ~0.6 TWh/yr; held at T3 until the archive/rate chain is citable.",
    "2024",
    4,
    6,
  );
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  process.stdout.write(JSON.stringify(buildTaiwanData()));
}
