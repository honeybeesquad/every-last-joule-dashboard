import { pathToFileURL } from "url";
import { withFallback } from "../lib/resilient.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import type { RegionData } from "../lib/types.js";
import { unpublishedEmptyRegion } from "../lib/waste-status.js";
import { TSO_GRID_MARKERS } from "../lib/tso-grid-markers.js";

export { TSO_GRID_MARKERS };

function run(): Record<string, RegionData> {
  const out: Record<string, RegionData> = {};
  for (const marker of TSO_GRID_MARKERS) {
    out[marker.id] = applyUncertainty(
      unpublishedEmptyRegion(marker.id, marker.note),
      { regionTier: "estimated", profileKind: marker.profileKind },
    );
  }
  return out;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<Record<string, RegionData>>("tso-grid-markers", async () => run(), {
    regionTier: "estimated" as const,
    tagLive: (r) => r,
    tagCached: (c) => c as Record<string, RegionData>,
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("tso-grid-markers loader failed", err);
      process.exit(1);
    });
}

export const buildTsoGridMarkers = run;
