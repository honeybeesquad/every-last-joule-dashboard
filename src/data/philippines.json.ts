import { pathToFileURL } from "url";
import { buildTypicalSolarRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "philippines";

export function buildPhilippinesData(): RegionData {
  return buildTypicalSolarRegion(
    REGION_ID,
    4,
    0.5,
    "IEMOP Market Data + NGCP/PEMC 2024 audit composite (WESM island grids; IEMOP CAPEG confirms solar/wind resource registry, MOT redispatch feed currently sparse; provisional T3 solar-shaped fallback)",
    "2024",
  );
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  process.stdout.write(JSON.stringify(buildPhilippinesData()));
}
