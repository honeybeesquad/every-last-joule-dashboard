import { pathToFileURL } from "url";
import { buildTypicalSolarRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "malaysia";
const ANNUAL_ANCHOR_TWH = 0.15;

export function buildMalaysiaData(): RegionData {
  return buildTypicalSolarRegion(
    REGION_ID,
    4,
    ANNUAL_ANCHOR_TWH,
    "Typical-shape fallback: GSO Malaysia publishes current-day real-time solar generation arrays, but no public 30-day curtailed-energy feed or explicit curtailed-energy annual anchor was verified. IRENA Malaysia Renewable Energy Statistics 2024 + Malaysia Energy Commission ST 2024 Annual Report used as provisional solar-curtailment anchor (~0.15 TWh/yr). Held at T3 pending a genuine curtailment source.",
    "2024",
  );
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  process.stdout.write(JSON.stringify(buildMalaysiaData()));
}
