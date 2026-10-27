/**
 * Jordan — NEPCO publishes PDF commentary and no hourly waste series.
 * Waste unpublished. The 0.5 TWh/yr IRENA static used to overwrite this
 * loader from the page spread; that anchor is gone.
 */

import { pathToFileURL } from "url";
import { withFallback } from "../lib/resilient.js";
import { stampRegionSourceProvenance } from "../lib/source-provenance.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import type { RegionData } from "../lib/types.js";
import { unpublishedEmptyRegion } from "../lib/waste-status.js";

const REGION_ID = "jordan";
const NOTE =
  "NEPCO publishes PDF commentary and no hourly waste series. Waste unpublished. " +
  "Not TSO-collected until a scheduled extract lands. Missing waste is not zero.";

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
    .catch((err) => { console.error("jordan loader failed", err); process.exit(1); });
}

export const buildJordanData = () => Promise.resolve(build());
