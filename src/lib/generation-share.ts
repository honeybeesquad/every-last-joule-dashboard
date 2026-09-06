import type { GenerationBasis, Region, RegionData } from "./types.js";

/**
 * Curtailment as a share of generation — and, more importantly, the gate that
 * decides when that number is allowed to exist.
 *
 * WHY THIS FILE IS A GATE AND NOT A DIVISION
 * ------------------------------------------
 * Most loaders in this repo compute curtailment as `generation x rate`, where
 * `rate` is a calibration constant (see the rate tables in `src/data/*.json.ts`
 * and `src/lib/eia-iso.ts` / `src/lib/entsoe.ts`). For those regions
 *
 *     totalTWh / generationTotalTWh  ===  rate
 *
 * identically, by construction. Publishing that as an observed share would
 * present an input as a finding — the exact failure mode CLAUDE.md rule 3
 * exists to prevent. Several of those loaders DO emit `generationProfile` /
 * `generationTotalTWh` (they have been since v1.0.0), so "both fields are
 * present" is NOT sufficient grounds to divide. The `generationBasis` field is.
 *
 * A share is therefore computed only when the loader has explicitly declared
 * `generationBasis: "measured-independent"`, meaning the upstream source
 * publishes curtailment as its own measured quantity AND publishes generation
 * for the same window. As of this module's introduction that is:
 *
 *   - the 10 Japanese OCCTO area CSVs (12 region ids) — the same 30-minute row
 *     carries measured curtailment (太陽光/風力出力制御量) and measured
 *     generation (太陽光/風力発電実績);
 *   - the 10 AEMO per-plant DUIDs — NEMWEB dispatch publishes UIGF (available)
 *     and TOTALCLEARED (dispatched) per unit; curtailment is the shortfall on
 *     SEMIDISPATCHCAP intervals, generation is TOTALCLEARED across all of them.
 *
 * Every other region returns `null` and a reason. A region with no share is NOT
 * a region with zero curtailment, and callers must render the two differently.
 */

/** Why a region cannot show a share. Ordered most- to least-specific. */
export type ShareUnavailableCode =
  | "circular"
  | "anchor-implied"
  | "modelled"
  | "no-generation";

export interface ShareUnavailable {
  code: ShareUnavailableCode;
  /** Short label for a list cell. */
  label: string;
  /** One sentence a reader can act on. */
  reason: string;
}

const UNAVAILABLE: Record<ShareUnavailableCode, Omit<ShareUnavailable, "code">> = {
  circular: {
    label: "n/a — derived",
    reason:
      "This loader computes curtailment as generation x a calibrated rate, so a share would " +
      "return that assumed rate rather than an observation.",
  },
  "anchor-implied": {
    label: "n/a — anchored",
    reason:
      "Generation is measured, but the curtailment magnitude is a published annual anchor " +
      "spread across the window, so the ratio is an implied rate rather than an observed share.",
  },
  modelled: {
    label: "n/a — modelled",
    reason:
      "Both the shape and the magnitude are modelled from an annual anchor; there is no " +
      "measured generation for this window to divide by.",
  },
  "no-generation": {
    label: "n/a — no generation feed",
    reason:
      "Curtailment is measured here, but the source publishes no generation series for the " +
      "same window, so there is no honest denominator.",
  },
};

function describe(code: ShareUnavailableCode): ShareUnavailable {
  return { code, ...UNAVAILABLE[code] };
}

/**
 * True when this record's generation may be used as the denominator of a
 * published share. The ONLY basis that qualifies.
 */
export function hasIndependentGeneration(data?: RegionData | null): boolean {
  return data?.generationBasis === "measured-independent";
}

/**
 * Curtailment as a fraction of measured generation over the same trailing
 * 30-day window, or `null` when the region has no honest share.
 *
 * Returns null (never 0, never NaN) for: a missing record, a basis other than
 * "measured-independent", a missing/zero/negative denominator, and any record
 * violating the schema invariant `generationTotalTWh >= totalTWh`. The last is
 * a data fault rather than a 100%+ share, so it is withheld rather than shown.
 */
export function curtailmentShare(data?: RegionData | null): number | null {
  if (!hasIndependentGeneration(data)) return null;
  const gen = data?.generationTotalTWh;
  const curt = data?.totalTWh;
  if (typeof gen !== "number" || !Number.isFinite(gen) || gen <= 0) return null;
  if (typeof curt !== "number" || !Number.isFinite(curt) || curt < 0) return null;
  if (curt > gen) return null;
  return curt / gen;
}

/**
 * Why this region has no share. Call only when `curtailmentShare` returned
 * null; the reason is derived from the record's own declared fields plus the
 * canonical region tier, never guessed.
 */
export function shareUnavailable(region: Region, data?: RegionData | null): ShareUnavailable {
  const basis: GenerationBasis | undefined = data?.generationBasis;
  if (basis === "derived-from-generation") return describe("circular");
  if (basis === "anchor-implied") return describe("anchor-implied");
  // "measured-independent" that still failed the arithmetic above (zero or
  // missing denominator, e.g. a last-good snapshot predating the generation
  // columns) reads as a missing feed, which is what it is.
  if (region.tier === "estimated") return describe("modelled");
  return describe("no-generation");
}

/** Format a 0..1 fraction as a percentage string. Two significant places below 1%. */
export function formatShare(fraction: number): string {
  const pct = fraction * 100;
  if (pct >= 10) return `${pct.toFixed(0)}%`;
  if (pct >= 1) return `${pct.toFixed(1)}%`;
  return `${pct.toFixed(2)}%`;
}
