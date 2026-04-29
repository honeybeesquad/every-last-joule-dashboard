import { pathToFileURL } from "url";
import { buildTypicalSolarRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "dominican-republic";
const ANNUAL_ANCHOR_TWH = 0.5;

export function buildDominicanRepublicData(): RegionData {
  return buildTypicalSolarRegion(
    REGION_ID,
    16,
    ANNUAL_ANCHOR_TWH,
    "Typical-shape fallback: OC Dominican Republic GetGeneracionReprogramadaJSon exposes scheduled/actual total generation, not renewable curtailment. IRENA 2024 + OC report references retained as a provisional solar-dominant curtailment anchor (~0.5 TWh/yr). Held at T3 until an explicit curtailed-energy annual figure or hourly curtailment feed is verified.",
    "2024",
  );
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  process.stdout.write(JSON.stringify(buildDominicanRepublicData()));
}
