/**
 * Single source of truth for resolving every region in `src/lib/regions.ts`
 * to a `ConfidenceTier` and a presentational bucket.
 *
 * Used by:
 *   - `scripts/tally-tiers.ts`              — informational tally
 *   - `scripts/ci/check-tier-coherence.ts`  — snapshot↔canonical assertion
 *   - `scripts/ci/check-tally-golden.ts`    — golden-count assertion
 *   - `scripts/ci/check-docs-drift.ts`      — docs/validation/*.md ↔ canonical
 *
 * The resolution rules mirror `src/lib/uncertainty.ts::deriveTier` but are
 * lifted out so that tooling can resolve a tier without instantiating a
 * loader. The static-region `profileKind` table is curated here because the
 * canonical `REGIONS` table only carries `tier`, not the loader's profile
 * shape — when a static region's loader changes shape (e.g., flat → mixed),
 * the entry here must be updated. The `unresolved` list surfaces any
 * region that has been added to REGIONS without a profileKind so the gap
 * is loud, not silent.
 */

import { REGIONS } from "../../src/lib/regions.js";
import type { Region } from "../../src/lib/types.js";
import {
  deriveTier,
  type ConfidenceTier,
  type TierInputs,
} from "../../src/lib/uncertainty.js";

export type ProfileKind = NonNullable<TierInputs["profileKind"]>;

/** Presentational bucket — separates flare from non-flare T2 for Figure 4. */
export type Bucket = "T1a" | "T1b" | "T1c" | "T2-flare" | "T2" | "T3";

/**
 * Per-region static profileKind. For static regions only; live and flare
 * regions don't need this. Mirrors the buildTypicalXxx call inside each
 * loader, plus the per-spec kind in `src/data/statics.json.ts`.
 */
export const STATIC_PROFILE_KIND: Record<string, ProfileKind> = {
  // statics.json.ts hand-curated specs
  sichuan: "hydro-seasonal",
  xinjiang: "solar",
  iceland: "hydro-seasonal",
  ukraine: "solar",
  "hawaii-oahu": "solar",
  "hawaii-maui": "solar",
  "hawaii-island": "solar",
  austria: "flat",
  "russia-murmansk-wind": "flat",
  // typical-shape loaders
  argentina: "wind",
  bangladesh: "solar",
  "british-columbia": "hydro-seasonal",
  "chile-wind": "wind",
  cyprus: "solar",
  egypt: "solar",
  ethiopia: "hydro-seasonal",
  gansu: "mixed",
  honduras: "solar",
  "india-east": "solar",
  "india-north": "solar",
  "india-south": "mixed",
  "india-west": "mixed",
  indonesia: "solar",
  "inner-mongolia": "wind",
  iran: "solar",
  "iraq-mainland": "solar",
  // ireland-republic / northern-ireland: 2026-04-25 demoted live → static.
  // The EirGrid loader is probe-only; the emitted profile is a calibrated
  // wind typical-shape scaled to SONI/EirGrid 2024 anchor (2.18 TWh
  // all-island), split 58/42 at consumption time.
  "ireland-republic": "wind",
  "northern-ireland": "wind",
  israel: "solar",
  japan: "solar",
  jeju: "wind",
  jordan: "solar",
  kazakhstan: "wind",
  kenya: "overnight",
  kurdistan: "solar",
  malaysia: "solar",
  manitoba: "mixed",
  mexico: "solar",
  mongolia: "wind",
  morocco: "wind",
  namibia: "solar",
  ningxia: "mixed",
  "nt-pilbara": "solar",
  oman: "solar",
  pakistan: "mixed",
  paraguay: "hydro-seasonal",
  peru: "hydro-seasonal",
  qinghai: "solar",
  // south-africa: 2026-04-25 demoted live → static. The Eskom Data Portal
  // loader is probe-only; the emitted profile is calibrated wind+solar
  // mixed-shape scaled to ~4.4 TWh/yr (SAREM 2025).
  "south-africa": "mixed",
  quebec: "hydro-seasonal",
  "russia-mainland": "hydro-seasonal",
  saskatchewan: "wind",
  "saudi-solar": "solar",
  "south-korea": "solar",
  taiwan: "solar",
  thailand: "solar",
  tibet: "hydro-seasonal",
  uae: "solar",
  uruguay: "wind",
  vietnam: "solar",
  "wa-swis": "solar",
  yunnan: "hydro-seasonal",
};

/**
 * Region ids whose flat 24/7 profile is a *physical* base load (associated-
 * gas flaring) rather than a modelling concession, presented in Figure 4 as
 * a separate "flare" bucket.
 */
export const FLARE_IDS = new Set([
  "permian",
  "w-siberia",
  "s-iraq",
  "e-saudi",
]);

export interface ResolvedRegion {
  id: string;
  name: string;
  region: Region;
  tier: ConfidenceTier;
  bucket: Bucket;
}

export interface ResolutionResult {
  resolved: ResolvedRegion[];
  unresolved: { id: string; reason: string }[];
}

/**
 * Resolve a single region to its canonical confidence tier + presentational
 * bucket. Returns null if the region cannot be resolved (e.g., static region
 * missing a STATIC_PROFILE_KIND entry).
 */
export function resolveRegion(r: Region): ResolvedRegion | { unresolvedReason: string } {
  let inputs: TierInputs;
  if (r.tier === "live") {
    inputs = { regionTier: "live" };
  } else if (r.tier === "live-domestic-anchored") {
    inputs = { regionTier: "live-domestic-anchored" };
  } else if (r.tier === "live-neighbour-anchored") {
    inputs = { regionTier: "live-neighbour-anchored" };
  } else if (r.tier === "flare") {
    inputs = { regionTier: "flare" };
  } else if (r.tier === "static") {
    const kind = STATIC_PROFILE_KIND[r.id];
    if (!kind) {
      return {
        unresolvedReason:
          "static region missing entry in STATIC_PROFILE_KIND — add a row in scripts/lib/tier-resolution.ts",
      };
    }
    inputs = { regionTier: "static", profileKind: kind };
  } else {
    return { unresolvedReason: `unknown Region.tier value: ${String(r.tier)}` };
  }
  const tier = deriveTier(inputs);
  let bucket: Bucket;
  if (tier === "T1a-live-tso" || tier === "T1-live-TSO") bucket = "T1a";
  else if (tier === "T1b-live-domestic-anchored") bucket = "T1b";
  else if (tier === "T1c-live-neighbour-anchored") bucket = "T1c";
  else if (tier === "T3-modelled") bucket = "T3";
  else if (FLARE_IDS.has(r.id)) bucket = "T2-flare";
  else bucket = "T2";
  return { id: r.id, name: r.name, region: r, tier, bucket };
}

/**
 * Resolve every region in REGIONS. The returned `unresolved` list is
 * loud-by-default — callers should treat any non-empty list as a hard
 * failure for golden / coherence purposes.
 */
export function resolveAll(): ResolutionResult {
  const resolved: ResolvedRegion[] = [];
  const unresolved: { id: string; reason: string }[] = [];
  for (const r of REGIONS) {
    const out = resolveRegion(r);
    if ("unresolvedReason" in out) {
      unresolved.push({ id: r.id, reason: out.unresolvedReason });
    } else {
      resolved.push(out);
    }
  }
  return { resolved, unresolved };
}

/**
 * Bucket counts. Stable key order so JSON-serialised output is comparable.
 */
export function countByBucket(resolved: ResolvedRegion[]): Record<Bucket, number> {
  const counts: Record<Bucket, number> = {
    T1a: 0,
    T1b: 0,
    T1c: 0,
    T2: 0,
    "T2-flare": 0,
    T3: 0,
  };
  for (const r of resolved) counts[r.bucket]++;
  return counts;
}
