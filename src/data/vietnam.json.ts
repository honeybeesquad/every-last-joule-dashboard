/**
 * Vietnam — EVN/NSMO daily dispatch is not machine-readable from this build.
 * Waste unpublished. The 4 TWh/yr literature shape is not an EVN series.
 */

import { pathToFileURL } from "url";
import { withFallback } from "../lib/resilient.js";
import { stampRegionSourceProvenance } from "../lib/source-provenance.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import type { RegionData } from "../lib/types.js";
import { unpublishedEmptyRegion } from "../lib/waste-status.js";

const REGION_ID = "vietnam";
const NOTE =
  "EVN/NSMO PDF daily dispatch is not machine-readable from this build. " +
  "Waste unpublished until a relay writes a CSV. A 2020 news quote and an Ember stub " +
  "are not an EVN series. Missing waste is not zero.";

function build(): RegionData {
  return stampRegionSourceProvenance(
    applyUncertainty(
      unpublishedEmptyRegion(REGION_ID, NOTE),
      { regionTier: "estimated", profileKind: "solar" },
    ),
  );
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback(REGION_ID, () => Promise.resolve(build()))
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("vietnam loader failed", err);
      process.exit(1);
    });
}

export const buildVietnamData = () => Promise.resolve(build());
