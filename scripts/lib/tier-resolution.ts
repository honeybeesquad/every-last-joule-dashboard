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
  // ireland-republic / northern-ireland: live as of 82b5496 (Phase 2.6).
  // The entries below are kept as a fallback profileKind in case the
  // EirGrid/SONI DD-HH workbook becomes inaccessible and the loader has
  // to be reverted to a typical-shape probe-only static. Profile shape
  // is wind-dominant; the all-island DD is split ROI 58% / NI 42% per
  // the SONI/EirGrid 2024 annual constraint+curtailment anchor.
  "ireland-republic": "wind",
  "northern-ireland": "wind",
  israel: "solar",
  // japan: live as of CODEX-PHASE26-J (2026-04-26). Loader fetches the
  // Kyushu Electric T&D `td_power_usages` daily area-demand CSV (Shift-JIS,
  // 5-min solar generation column) and applies a 10% calibration rate
  // against the Kyushu 2024 ~1.7 TWh/yr anchor. The solar entry here is
  // the fallback profileKind if Kyushu Electric's CSV becomes inaccessible
  // and the loader has to be reverted to probe-only.
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
  philippines: "solar",
  paraguay: "hydro-seasonal",
  qinghai: "solar",
  quebec: "hydro-seasonal",
  "russia-mainland": "hydro-seasonal",
  saskatchewan: "wind",
  "saudi-solar": "solar",
  "south-korea": "solar",
  taiwan: "solar",
  thailand: "solar",
  tibet: "hydro-seasonal",
  uae: "solar",
  vietnam: "solar",
  yunnan: "hydro-seasonal",
  // Phase-2.7 Pattern-D Latin-America bulk-add (2026-04-27).
  // Sixteen new T3-modelled statics from
  // `data/coverage-audit/2026-04-26-latin-america.csv`. profileKind values
  // mirror the StaticSpec.kind values declared in `src/data/statics.json.ts`
  // for the same ids. All sixteen route to T3-modelled per
  // `applyUncertainty` (`solar`, `wind`, `mixed`, `hydro-seasonal` profile
  // kinds all map to T3 via deriveTier in src/lib/uncertainty.ts).
  guatemala: "solar",
  "el-salvador": "solar",
  nicaragua: "solar",
  // Costa Rica is hydro-dominated per IRENA 2024 but the StaticSpec emits
  // a flat 24/7 profile (no seasonal-shares table for CR); routed via
  // profileKind "mixed" to retain the ±40% T3 envelope honestly.
  "costa-rica": "mixed",
  panama: "solar",
  "guatemala-siepac": "solar",
  // Cuba's anchor reflects post-Hurricane-Ian grid stress (mixed-fuel
  // composite); flat profile, T3 envelope.
  cuba: "mixed",
  "dominican-republic": "solar",
  jamaica: "solar",
  // Trinidad & Tobago's anchor is GGFR offshore flare lifted onto the
  // T&TEC grid for coverage continuity. Flat 24/7 profile via the
  // "mixed" profile kind so the ±40% T3 envelope correctly reflects
  // the modelling uncertainty (rather than the ±20% T2-flare envelope
  // we use for the directly-observed Permian / W-Siberia / S-Iraq /
  // E-Saudi flare bboxes).
  "trinidad-tobago": "mixed",
  barbados: "solar",
  bolivia: "solar",
  ecuador: "mixed",
  // Guyana / Suriname offshore flare anchors lifted onto the country
  // grid for coverage; same modelling-flat treatment as Trinidad.
  guyana: "mixed",
  suriname: "mixed",
  "french-guiana": "solar",
  // Phase-2.7 Pattern-D — Africa bulk-add (2026-04-27).
  // 26 net-new T3-modelled statics. Map value mirrors the StaticSpec.kind
  // collapse done inside `buildStaticRegion` (hydro→mixed for tier
  // resolution, since both produce a flat profile and route to T3-modelled).
  // See `src/data/statics.json.ts` for the canonical specs.
  algeria: "solar",
  angola: "solar",
  benin: "solar",
  botswana: "solar",
  "burkina-faso": "solar",
  "cabo-verde": "mixed",
  cameroon: "mixed",
  "congo-drc": "mixed",
  "cote-divoire": "mixed",
  eswatini: "mixed",
  gabon: "mixed",
  ghana: "mixed",
  madagascar: "mixed",
  malawi: "mixed",
  mauritania: "wind",
  mauritius: "mixed",
  mozambique: "mixed",
  nigeria: "mixed",
  rwanda: "mixed",
  senegal: "mixed",
  tanzania: "mixed",
  togo: "solar",
  tunisia: "mixed",
  uganda: "mixed",
  zambia: "mixed",
  zimbabwe: "mixed",
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
