import type { Region, RegionData } from "./types.js";

export type QualityBucket = "measured" | "anchored" | "estimated";
export type DotStyle = "solid" | "ringed" | "hollow" | "degraded";

/** confidenceTier values that count as live-measured. */
const MEASURED_TIERS = new Set([
  "T1a-live-tso",
  "T1b-live-domestic-anchored",
  "T1c-live-neighbour-anchored",
  "T1-live-TSO", // pre-2026-04-25 alias
]);
/** confidenceTier values that count as published-annual anchored. */
const ANCHORED_TIERS = new Set(["T2-annual-calibrated"]);

/** region.tier values that count as live-measured (fallback path). */
const MEASURED_REGION_TIERS = new Set([
  "live",
  "live-domestic-anchored",
  "live-neighbour-anchored",
]);

/**
 * Coarse data-quality bucket for globe encoding. Prefers the per-snapshot
 * `confidenceTier`; falls back to the canonical `region.tier` when a loader
 * has not stamped one. Anything not measured/anchored (incl. T3-modelled,
 * T4-structural-gap, or unknown) is "estimated".
 */
export function qualityBucket(region: Region, data?: RegionData | null): QualityBucket {
  const ct = data?.confidenceTier;
  if (ct) {
    if (MEASURED_TIERS.has(ct)) return "measured";
    if (ANCHORED_TIERS.has(ct)) return "anchored";
    return "estimated";
  }
  if (MEASURED_REGION_TIERS.has(region.tier)) return "measured";
  if (region.tier === "anchored") return "anchored";
  return "estimated";
}

/** Pillar opacity factor per bucket. Multiplies into globe.js visible×sunDim. */
export function qualityOpacity(bucket: QualityBucket): number {
  switch (bucket) {
    case "measured":
      return 1.0;
    case "anchored":
      return 0.8;
    case "estimated":
      return 0.62;
  }
}

/**
 * Base-dot style. A `degraded` sourceStatus (live feed >24h stale) overrides
 * the bucket dot with the amber-ring alarm; live/cached use the bucket dot.
 */
export function dotStyleFor(bucket: QualityBucket, sourceStatus?: string | null): DotStyle {
  if (sourceStatus === "degraded") return "degraded";
  switch (bucket) {
    case "measured":
      return "solid";
    case "anchored":
      return "ringed";
    case "estimated":
      return "hollow";
  }
}
