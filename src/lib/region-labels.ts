/**
 * Reader-facing glosses for the fields that decide how much a region's number
 * can be trusted.
 *
 * Every string here already exists somewhere in the repo — in the doc comments
 * of `types.ts`, in `TIER_LABEL`, in `docs/methodology/` — but nowhere a reader
 * of the website can see it. The `/region/<id>` pages and the `/regions`
 * directory are the first surface that shows them, so this module is the one
 * place they are written down for rendering.
 *
 * Build-time only: the page loaders bake these strings into static HTML, so
 * nothing here ships to the browser. The one value import below carries an
 * explicit `.ts` extension because the page loaders run under plain `node`
 * (Framework's `.js` interpreter), and Node's type stripping resolves module
 * specifiers literally — it does not rewrite `.js` to `.ts` the way `tsx` and
 * Framework's client bundler do.
 */

import type { RegionTier, RegionKind, SourceProvenance } from "./types.js";
import type { QualityBucket } from "./region-quality.js";
import { deriveTier, TIER_DEFAULT_FRACTION } from "./uncertainty.ts";

/** Short label for the coarse three-way quality bucket used by the globe legend. */
export const QUALITY_LABEL: Record<QualityBucket, string> = {
  measured: "Measured",
  anchored: "Anchored",
  estimated: "Estimated",
};

/** One-line definition of each quality bucket, for the directory legend. */
export const QUALITY_GLOSS: Record<QualityBucket, string> = {
  measured: "A grid operator publishes the underlying hourly series.",
  anchored: "No live feed. Scaled to a published annual or monthly total.",
  estimated: "Modelled profile scaled to a capacity or literature anchor.",
};

/** Plain-English gloss of each canonical `Region.tier`, from types.ts. */
export const TIER_GLOSS: Record<RegionTier, string> = {
  live:
    "The transmission system operator publishes an hourly series, and the calibration rate comes from the same jurisdiction.",
  "live-domestic-anchored":
    "The operator publishes an hourly series, but the calibration rate comes from a domestic statistical agency or a modelled share-split of a national anchor.",
  "live-neighbour-anchored":
    "The operator publishes an hourly series, but no domestic rate is published, so the rate is extrapolated from a neighbouring zone.",
  anchored:
    "No live feed. A published annual or monthly total from an operator, regulator, or satellite programme sets the level.",
  estimated:
    "No live feed and no published total for this region. A typical-shape profile is scaled to a capacity-based or literature anchor.",
};

/** Plain-English gloss of each `sourceProvenance`, from types.ts. */
export const PROVENANCE_LABEL: Record<SourceProvenance, string> = {
  verified: "Verified upstream link",
  "official-lead": "Official source identified, live path not producing",
  "modelled-fallback": "No verified upstream link",
};

/** Longer gloss of each `sourceProvenance`. */
export const PROVENANCE_GLOSS: Record<SourceProvenance, string> = {
  verified: "The snapshot value comes from a verified upstream feed or anchor.",
  "official-lead":
    "An authoritative source exists and the loader is wired or scaffolded, but the live path is not producing usable data — geoblocked, auth-gated, or parser pending. The emitted snapshot falls back to modelled or last-good values.",
  "modelled-fallback":
    "There is no verified upstream link. The snapshot is a typical-shape profile scaled to an anchor, or otherwise estimated.",
};

/** Display label for the waste modality. */
export const KIND_LABEL: Record<RegionKind, string> = {
  solar: "Solar",
  wind: "Wind",
  hydro: "Hydro",
  geo: "Geothermal",
  mixed: "Mixed",
};

/**
 * Published ± envelope on peak GW for a region's tier, as a percentage string.
 *
 * This is `TIER_DEFAULT_FRACTION` rendered for humans. It is the single most
 * under-surfaced number in the dataset: every `RegionData` record carries the
 * absolute bounds and no dashboard surface shows them.
 */
export function uncertaintyBandPercent(tier: RegionTier): string {
  const fraction = TIER_DEFAULT_FRACTION[deriveTier({ regionTier: tier })];
  const percent = fraction * 100;
  return `${Number.isInteger(percent) ? percent : Number(percent.toFixed(1))}%`;
}

/**
 * The caveat that belongs next to `uncertaintyBandPercent`, or null when the
 * band is used as written. Live own-jurisdiction regions replace the default
 * fraction with ±2σ of observed variance once a backfill archive exists.
 */
export function uncertaintyBandCaveat(tier: RegionTier): string | null {
  return tier === "live"
    ? "Regions with a five-year backfill archive use ±2σ of observed annual variance instead of this default fraction."
    : null;
}
