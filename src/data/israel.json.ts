/**
 * Israel — Noga/IEC pages are not an hourly curtailment series.
 * Waste unpublished unless Noga documents curtailment. The 1.2 TWh/yr
 * PUA-derived shape was a literature pillar, not a measurement.
 */

import { pathToFileURL } from "url";
import { withFallback } from "../lib/resilient.js";
import { stampRegionSourceProvenance } from "../lib/source-provenance.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import type { RegionData } from "../lib/types.js";
import { unpublishedEmptyRegion } from "../lib/waste-status.js";

const REGION_ID = "israel";
const NOTE =
  "Noga/IEC public pages do not expose hourly solar curtailment. Waste unpublished " +
  "unless Noga documents a curtailment series. A homepage probe is not TSO collection. " +
  "Missing waste is not zero.";

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
    .catch((err) => { console.error("israel loader failed", err); process.exit(1); });
}

export const buildIsraelData = () => Promise.resolve(build());
