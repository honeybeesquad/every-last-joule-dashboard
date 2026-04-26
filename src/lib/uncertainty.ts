/**
 * Uncertainty model for Scientific Data descriptor (S2 sprint, B4 Option B
 * post-rerun extension).
 *
 * Each region's peakGW carries a ±uncertainty envelope and a confidence tier
 * label. The tier is derived deterministically from the loader's Region.tier
 * (live / live-domestic-anchored / live-neighbour-anchored / static / flare)
 * and — for statics — the profile shape emitted by `src/data/statics.json.ts`.
 *
 * Tier definitions (also surfaced in `docs/methodology/uncertainty.md` and
 * `docs/proposals/b4-option-b-decision.md`):
 *
 *   T1a-live-tso                 live feed + own-jurisdiction calibration
 *                                rate from the same TSO/regulator
 *                                — bounds: 2σ from backfill 5yr observed
 *                                  variance (fallback ±15 % of peakGW when
 *                                  no backfill yet)
 *   T1b-live-domestic-anchored   live feed + calibration rate sourced from
 *                                a domestic statistical agency or modelled
 *                                share-split of a national anchor
 *                                — bounds: ±50 % of peakGW (empirical from
 *                                  post-B1 rerun 2026-04-26; covers
 *                                  scope-mismatch cases like
 *                                  italy-sardinia / netherlands / baltics /
 *                                  italy-north-zone)
 *   T1c-live-neighbour-anchored  live feed + rate extrapolated from a
 *                                neighbouring zone (no domestic rate
 *                                published)
 *                                — bounds: ±35.5 % of peakGW (empirical
 *                                  Switzerland residual against Czech rate)
 *   T1-live-TSO                  legacy alias retained on pre-2026-04-25
 *                                snapshots; equivalent to T1a-live-tso for
 *                                envelope sizing
 *   T2-annual-calibrated         static anchored to a published annual total
 *                                (flare / GGFR, Ember, IRENA), no shape
 *                                modelling — bounds: ±20 % of peakGW
 *   T3-modelled                  static with typical-shape profile (solar /
 *                                hydro-seasonal) scaled to an annual anchor
 *                                — bounds: ±40 % of peakGW
 *   T4-structural-gap            no hourly claim made (not used in emitted
 *                                data; reserved for regions listed only in
 *                                `docs/known-limitations.md`)
 *
 * The bounds are intentionally conservative — a reviewer can always tighten
 * after reading the methodology, but understating uncertainty would be a
 * real integrity problem. See FAIR-NUM-2019 § "Numerical uncertainty" for
 * the provenance of this approach.
 */

import type { RegionData, SourceStatus } from "./types.js";

export type ConfidenceTier =
  | "T1-live-TSO"
  | "T1a-live-tso"
  | "T1b-live-domestic-anchored"
  | "T1c-live-neighbour-anchored"
  | "T2-annual-calibrated"
  | "T3-modelled"
  | "T4-structural-gap";

/**
 * Default fractional ± envelope per tier, used when no backfill variance is
 * available. T1a/T1c are sized from the post-B1 empirical rerun (see
 * docs/proposals/b4-option-b-decision.md §"Post-B1 rerun (2026-04-26)").
 */
export const TIER_DEFAULT_FRACTION: Record<ConfidenceTier, number> = {
  "T1-live-TSO":                 0.15,  // legacy alias; equivalent to T1a
  "T1a-live-tso":                0.15,  // ±15% fallback; replaced with 2σ/peak when backfill present
  "T1b-live-domestic-anchored":  0.50,  // ±50% empirical (post-B1 P67 across the 4 T1b zones)
  "T1c-live-neighbour-anchored": 0.355, // ±35.5% empirical (Switzerland residual against Czech rate)
  "T2-annual-calibrated":        0.20,  // ±20% per published-source implied precision
  "T3-modelled":                 0.40,  // ±40% accounting for profile-shape assumption
  "T4-structural-gap":           0.00,  // n/a
};

/** Inputs that determine a region's confidence tier. */
export interface TierInputs {
  /**
   * Canonical tier from `Region.tier`. Three live sub-tiers are recognised
   * per B4 Option B (locked 2026-04-25); see RegionTier in types.ts for
   * the canonical narrative.
   */
  regionTier:
    | "live"
    | "live-domestic-anchored"
    | "live-neighbour-anchored"
    | "static"
    | "flare";
  /**
   * Profile-shape kind emitted by the typical-profile builders and the
   * hand-curated statics loader.
   *
   *   "flat"            no diurnal or seasonal shape modelled — regions
   *                     using `buildTypicalHydroRegion` (flat annual
   *                     average) or flare base load. Routes to T2.
   *   "solar"           diurnal cos-shape centred on local solar noon —
   *                     `buildTypicalSolarRegion`. Routes to T3.
   *   "wind"            weak diurnal shape — `buildTypicalWindRegion`.
   *                     Routes to T3 because the shape is modelled not
   *                     measured.
   *   "mixed"           sum of solar+wind+hydro shapes per fuelShare —
   *                     `buildTypicalMixedRegion`. Routes to T3.
   *   "hydro-seasonal"  monthly share array × flat diurnal —
   *                     `buildTypicalHydroSeasonalRegion`. Routes to T3.
   *   "overnight"       geothermal steam-venting window —
   *                     `buildGeothermalOvernightRegion`. Routes to T3.
   *
   * For live regions leave undefined.
   */
  profileKind?:
    | "flat"
    | "solar"
    | "wind"
    | "mixed"
    | "hydro-seasonal"
    | "overnight";
  /**
   * Whether the current build served live data or a cached snapshot.
   * Currently advisory — does not change tier, because a one-build cache
   * miss does not change the underlying calibration.
   */
  sourceStatus?: SourceStatus;
}

/**
 * Deterministic tier derivation.
 *
 *   live                                        → T1a-live-tso
 *   live-domestic-anchored                      → T1b-live-domestic-anchored
 *   live-neighbour-anchored                     → T1c-live-neighbour-anchored
 *   flare                                       → T2-annual-calibrated
 *                                                 (GGFR annual is direct observation)
 *   static + flat (or undefined profileKind)    → T2-annual-calibrated
 *                                                 (Ember/IRENA annual, flat base load)
 *   static + solar | wind | mixed               → T3-modelled
 *                                                 (diurnal shape modelled, scaled to annual)
 *   static + hydro-seasonal                     → T3-modelled
 *                                                 (monthly shape modelled, scaled to annual)
 *   static + overnight                          → T3-modelled
 *                                                 (venting-window shape modelled)
 *
 * The function throws on unknown combinations rather than silently assigning
 * a tier; this is defensive — the set of tiers is small and every region
 * must resolve to exactly one.
 */
export function deriveTier(inputs: TierInputs): ConfidenceTier {
  const { regionTier, profileKind } = inputs;
  if (regionTier === "live") return "T1a-live-tso";
  if (regionTier === "live-domestic-anchored") return "T1b-live-domestic-anchored";
  if (regionTier === "live-neighbour-anchored") return "T1c-live-neighbour-anchored";
  if (regionTier === "flare") return "T2-annual-calibrated";
  if (regionTier === "static") {
    if (profileKind === "flat" || profileKind == null) return "T2-annual-calibrated";
    if (
      profileKind === "solar" ||
      profileKind === "wind" ||
      profileKind === "mixed" ||
      profileKind === "hydro-seasonal" ||
      profileKind === "overnight"
    ) {
      return "T3-modelled";
    }
  }
  throw new Error(
    `deriveTier: cannot resolve tier for regionTier=${regionTier} profileKind=${profileKind}`,
  );
}

/** Bounds on peakGW returned from `computeBounds`. */
export interface Bounds {
  uncertaintyLowGW: number;
  uncertaintyHighGW: number;
}

/**
 * Compute uncertainty bounds on peakGW.
 *
 * When `observedStdGW` is provided (from the 5-year backfill archive for a
 * T1 region), bounds are ±2σ. This is the preferred model — it reflects the
 * actual observed year-over-year variance of peak curtailment hours. When
 * absent, the function falls back to a tier-level default fraction.
 *
 * Bounds are clamped so that uncertaintyLow ≥ 0 (peak curtailment cannot be
 * negative) and uncertaintyHigh ≥ peakGW (the point estimate is always in
 * the envelope).
 */
export function computeBounds(
  peakGW: number,
  tier: ConfidenceTier,
  observedStdGW?: number,
): Bounds {
  if (!Number.isFinite(peakGW) || peakGW < 0) {
    return { uncertaintyLowGW: 0, uncertaintyHighGW: 0 };
  }
  if (tier === "T4-structural-gap") {
    return { uncertaintyLowGW: 0, uncertaintyHighGW: 0 };
  }

  let delta: number;
  // 2σ empirical envelope only applies to T1a (own-jurisdiction) regions
  // where the backfill cohort represents the same dispatch-down series.
  // T1b / T1c regions have systematic anchor-scope offset that 2σ does
  // not capture — they use the empirical fractional envelope instead.
  if (
    (tier === "T1a-live-tso" || tier === "T1-live-TSO") &&
    observedStdGW != null &&
    observedStdGW > 0
  ) {
    // 2σ empirical envelope (95% coverage under normal assumption; the
    // methodology note flags that curtailment is non-gaussian but the 2σ
    // rule remains the standard published interval).
    delta = 2 * observedStdGW;
  } else {
    delta = TIER_DEFAULT_FRACTION[tier] * peakGW;
  }

  const low = Math.max(0, peakGW - delta);
  const high = Math.max(peakGW, peakGW + delta);
  return { uncertaintyLowGW: low, uncertaintyHighGW: high };
}

/**
 * Enrich a RegionData object with `confidenceTier`, `uncertaintyLowGW`, and
 * `uncertaintyHighGW`. Pure — returns a new object, does not mutate.
 *
 * Loader callers use this right before the final `RegionData` is written to
 * the snapshot JSON. When backfill archives are available (HB track), pass
 * `observedStdGW` as the standard deviation of annual peakGW across the
 * 2020–2026 backfill for this region.
 */
export function applyUncertainty(
  data: RegionData,
  inputs: TierInputs,
  observedStdGW?: number,
): RegionData {
  const tier = deriveTier(inputs);
  const { uncertaintyLowGW, uncertaintyHighGW } = computeBounds(
    data.peakGW,
    tier,
    observedStdGW,
  );
  return {
    ...data,
    confidenceTier: tier,
    uncertaintyLowGW,
    uncertaintyHighGW,
  };
}

/**
 * Human-readable tier descriptions, useful for tooltips and figure legends.
 *
 * Per B4 Option B (locked 2026-04-25), the legacy "T1-live-TSO" label is
 * retained as an alias for paper continuity but new emissions use the
 * T1a / T1b / T1c sub-labels.
 */
export const TIER_LABEL: Record<ConfidenceTier, string> = {
  "T1-live-TSO":                 "Live TSO feed (legacy label; ±2σ from 5-yr backfill)",
  "T1a-live-tso":                "Live TSO feed, own-jurisdiction rate (±2σ from 5-yr backfill, fallback ±15%)",
  "T1b-live-domestic-anchored":  "Live feed, domestic stat-agency rate (±50% empirical)",
  "T1c-live-neighbour-anchored": "Live feed, neighbour-extrapolated rate (±35.5% empirical)",
  "T2-annual-calibrated":        "Published annual anchor (±20%)",
  "T3-modelled":                 "Modelled profile, scaled to annual (±40%)",
  "T4-structural-gap":           "Structural gap — no hourly claim",
};
