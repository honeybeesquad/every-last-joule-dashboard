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
 * loader. The estimated-region `profileKind` table is curated here because
 * the canonical `REGIONS` table only carries `tier`, not the loader's profile
 * shape — when an estimated region's loader changes shape (e.g., solar →
 * mixed), the entry here must be updated. The `unresolved` list surfaces any
 * estimated region that has been added to REGIONS without a profileKind so
 * the gap is loud, not silent.
 */

import { REGIONS } from "../../src/lib/regions.js";
import type { Region } from "../../src/lib/types.js";
import {
  deriveTier,
  type ConfidenceTier,
  type TierInputs,
} from "../../src/lib/uncertainty.js";

export type ProfileKind = NonNullable<TierInputs["profileKind"]>;

/** Presentational bucket for Figure 4. */
export type Bucket = "T1a" | "T1b" | "T1c" | "T2" | "T3";

/**
 * Per-region profileKind. For estimated (and anchored non-live) regions only;
 * live regions don't need this. Mirrors the buildTypicalXxx call inside each
 * loader, plus the per-spec kind in `src/data/statics.json.ts`.
 */
export const STATIC_PROFILE_KIND: Record<string, ProfileKind> = {
  // statics.json.ts hand-curated specs
  sichuan: "hydro-seasonal",
  "xinjiang-wind": "wind",
  "xinjiang-solar": "solar",
  // W2 China provinces — typical-shape loaders (NEA 2024 provincial RE bulletin)
  "china-shandong-wind": "wind",
  "china-shandong-solar": "solar",
  "china-guangdong": "mixed",
  "china-jiangsu-wind": "wind",
  "china-jiangsu-solar": "solar",
  "china-anhui-wind": "wind",
  "china-anhui-solar": "solar",
  "china-hunan-wind": "wind",
  "china-hunan-solar": "solar",
  "china-hunan-hydro": "flat",
  "china-liaoning-wind": "wind",
  "china-liaoning-solar": "solar",
  "china-hubei-wind": "wind",
  "china-hubei-solar": "solar",
  "china-hubei-hydro": "flat",
  "china-shanxi-wind": "wind",
  "china-shanxi-solar": "solar",
  "china-shaanxi-wind": "wind",
  "china-shaanxi-solar": "solar",
  "china-zhejiang": "mixed",
  "china-henan-wind": "wind",
  "china-henan-solar": "solar",
  "china-fujian": "mixed",
  "china-jiangxi": "solar",
  "china-beijing": "solar",
  "china-guizhou-solar": "solar",
  "china-guizhou-hydro": "flat",
  "china-chongqing-hydro": "flat",
  "china-chongqing-solar": "solar",
  "china-tianjin": "mixed",
  "china-hainan": "solar",
  "china-shanghai": "solar",
  // China W3 (Phase-2.7, 2026-05-03): northeast wind-corridor provinces.
  "china-hebei-wind": "wind",
  "china-hebei-solar": "solar",
  "china-heilongjiang-wind": "wind",
  "china-heilongjiang-solar": "solar",
  "china-jilin-wind": "wind",
  "china-jilin-solar": "solar",
  iceland: "hydro-seasonal",
  ukraine: "solar",
  "ukraine-wind": "wind",
  "hawaii-oahu": "solar",
  "hawaii-maui": "solar",
  "hawaii-island": "solar",
  florida: "solar",
  tva: "solar",
  austria: "flat",
  "russia-murmansk-wind": "flat",
  // typical-shape loaders
  argentina: "wind",
  bangladesh: "solar",
  "british-columbia": "hydro-seasonal",
  "atacama-hydro": "hydro-seasonal",
  colombia: "hydro-seasonal",
  "colombia-wind": "wind",
  "colombia-solar": "solar",
  cyprus: "solar",
  egypt: "solar",
  ethiopia: "hydro-seasonal",
  "gansu-wind": "wind",
  "gansu-solar": "solar",
  // China provincial RE curtailment splits (NEA 2024 provincial RE bulletin),
  // 6 provinces × wind+solar typical-shape loaders.
  "inner-mongolia-wind": "wind",
  "inner-mongolia-solar": "solar",
  "qinghai-wind": "wind",
  "qinghai-solar": "solar",
  "yunnan-wind": "wind",
  "yunnan-solar": "solar",
  "tibet-wind": "wind",
  "tibet-solar": "solar",
  "sichuan-wind": "wind",
  "sichuan-solar": "solar",
  "guangxi-wind": "wind",
  "guangxi-solar": "solar",
  honduras: "solar",
  "india-east": "solar",
  // India W1/W2/W3 state-SLDC loaders: declared `tier: "live"` from
  // 2026-05-02 in anticipation of an India-egress relay, but the live
  // sources are geoblocked / unparsed from the build environment so each
  // loader currently emits T3-modelled typical-shape data. Reverted to
  // `tier: "estimated"` on 2026-05-03 to make tier honesty match emitted data
  // (Sci-Data integrity); flip back to `tier: "live"` plus remove these
  // entries once each loader's live path is actually wired up.
  "india-rajasthan": "solar",
  "india-gujarat": "solar",
  "india-karnataka": "solar",
  "india-andhra-pradesh": "solar",
  "india-tamil-nadu": "wind",
  "india-maharashtra": "flat",   // T2 measured MSLDC monthly totals; daily energy only, no intraday shape claimed
  "india-madhya-pradesh": "solar",
  "india-telangana": "mixed",
  "india-uttar-pradesh": "solar",
  "india-punjab": "solar",
  "india-odisha": "wind",
  "india-chhattisgarh": "solar",
  indonesia: "solar",
  iran: "solar",
  "iraq-mainland": "solar",
  // ireland-republic / northern-ireland: live as of 82b5496 (Phase 2.6).
  // The entries below are kept as a fallback profileKind in case the
  // EirGrid/SONI DD-HH workbook wind data split ROI 58% / NI 42% per
  // the SONI/EirGrid 2024 annual constraint+curtailment anchor.
  "ireland-republic-wind":   "wind",
  "ireland-republic-solar":  "solar",
  "northern-ireland-wind":   "wind",
  "northern-ireland-solar":  "solar",
  israel: "solar",
  // All 10 Japan area loaders are live (T1a) reading direct eria_jukyu area
  // CSVs as of Phase 2 (2026-06-07). No STATIC_PROFILE_KIND entries needed.
  jeju: "wind",
  jordan: "solar",
  kazakhstan: "wind",
  kenya: "overnight",
  kurdistan: "solar",
  // Peru per-plant — COES medidoresgeneracion (estimated curtailment)
  malaysia: "solar",
  manitoba: "mixed",
  "mexico-solar": "solar",
  "mexico-wind": "wind",
  mongolia: "wind",
  morocco: "wind",
  namibia: "solar",
  nepal: "hydro-seasonal",
  "ningxia-wind": "wind",
  "ningxia-solar": "solar",
  "nt-pilbara": "solar",
  oman: "solar",
  palestine: "solar",
  "pakistan-wind": "wind",
  "pakistan-solar": "solar",
  "philippines-solar": "solar",
  "philippines-wind": "wind",
  paraguay: "hydro-seasonal",
  quebec: "hydro-seasonal",
  "russia-mainland": "hydro-seasonal",
  saskatchewan: "wind",
  "saudi-solar": "solar",
  "south-korea-solar": "solar",
  "south-korea-wind": "wind",
  taiwan: "solar",
  thailand: "solar",
  uae: "solar",
  vietnam: "solar",
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
  "dominican-republic-wind": "wind",
  jamaica: "solar",
  barbados: "solar",
  bolivia: "solar",
  ecuador: "mixed",
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
  // Lithuania/Latvia/Malta reverted live→estimated 2026-05-11: ENTSO-E A75 produces
  // no usable curtailment rate for any of them. Production data flows via the
  // IRENA 2024 anchor in statics.json.ts, so register their profileKind here.
  lithuania: "wind",
  latvia: "wind",
  malta: "solar",
  // norway-no5 reverted live→estimated 2026-06-07: Statnett not reporting to
  // ENTSO-E A75 for this bidding zone. Uses hydro-seasonal Iceland-proxy shape.
  "norway-no5": "hydro-seasonal",
  // serbia/north-macedonia solar reverted live→estimated 2026-06-06 (PR #119):
  // ENTSO-E A75 B16 feed unreliable (non-EU Energy Community TSOs). Anchored
  // to IRENA RCS 2025 statics; both emit solar-shaped profiles.
  "serbia-solar": "solar",
  "north-macedonia-solar": "solar",
  // Phase 2 IRENA T3 anchors (2026-05-04): 11 new T3-static regions
  // sourced from IRENA RE Statistics 2024 capacity anchors.
  // All emit solar-shaped or mixed profiles; hydro → mixed per T3 routing.
  albania: "solar",
  georgia: "mixed",
  armenia: "solar",
  azerbaijan: "mixed",
  uzbekistan: "solar",
  "sri-lanka": "mixed",
  sudan: "solar",
  venezuela: "wind",
  laos: "solar",
  cambodia: "solar",
  myanmar: "solar",
  // Phase 4-A completionist Tier A (2026-05-05): 17 new T3-static countries
  // sourced from IRENA RCS 2025. hydro → mixed per T3 routing.
  afghanistan: "solar",
  bahrain: "solar",
  "belarus-wind": "wind",
  "belarus-solar": "solar",
  brunei: "solar",
  haiti: "solar",
  kyrgyzstan: "mixed",
  lebanon: "solar",
  libya: "solar",
  mali: "solar",
  niger: "solar",
  "north-korea": "solar",
  singapore: "solar",
  syria: "solar",
  tajikistan: "mixed",
  turkmenistan: "solar",
  yemen: "solar",
  // Phase 4-B completionist Tier B (2026-05-05): 26 new T3-static countries
  // sourced from IRENA RCS 2025. hydro → mixed per T3 routing.
  burundi: "mixed",
  bhutan: "mixed",
  "central-african-republic": "mixed",
  "congo-republic": "mixed",
  comoros: "solar",
  djibouti: "solar",
  eritrea: "solar",
  fiji: "mixed",
  gambia: "solar",
  guinea: "mixed",
  "guinea-bissau": "solar",
  "equatorial-guinea": "mixed",
  lesotho: "mixed",
  liberia: "mixed",
  maldives: "solar",
  "papua-new-guinea": "mixed",
  "solomon-islands": "solar",
  "sierra-leone": "mixed",
  somalia: "solar",
  "south-sudan": "solar",
  "sao-tome": "solar",
  seychelles: "solar",
  chad: "solar",
  "east-timor": "solar",
  vanuatu: "solar",
  samoa: "solar",
  // Phase 4-C completionist Tier C (2026-05-05): 19 new T3-static
  // microstates/small-island states from IRENA RCS 2025.
  // Small hydro grids (andorra, liechtenstein, belize) use "mixed" profileKind
  // since they emit flat 24/7 profiles, routing to T3-modelled.
  andorra: "mixed",
  liechtenstein: "mixed",
  monaco: "solar",
  "san-marino": "solar",
  "antigua-and-barbuda": "solar",
  bahamas: "solar",
  belize: "mixed",
  dominica: "solar",
  grenada: "solar",
  "st-kitts-and-nevis": "solar",
  "st-lucia": "solar",
  "st-vincent": "solar",
  kiribati: "solar",
  "marshall-islands": "solar",
  micronesia: "solar",
  nauru: "solar",
  palau: "solar",
  tonga: "solar",
  tuvalu: "solar",
  // Peru per-plant (2026-06-20): COES SINAC per-plant generation × 2% national
  // curtailment calibration (T3-modelled). Real generation shape from a
  // residential-relay committed CSV; profileKind registered for tier coherence.
  "solar-sunny": "solar",
  "solar-san-martin": "solar",
  "solar-rubi": "solar",
  "solar-clemesi": "solar",
  "solar-intipampa": "solar",
  "solar-matarani": "solar",
  "solar-majes": "solar",
  "wind-punta-lomitas": "wind",
  "wind-wayra": "wind",
  "wind-san-juan": "wind",
  "wind-tres-hermanas": "wind",
  "wind-cupisnique": "wind",
};

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
 * bucket.
 */
export function resolveRegion(r: Region): ResolvedRegion | { unresolvedReason: string } {
  const inputs: TierInputs = { regionTier: r.tier };

  if (r.tier === "estimated") {
    const kind = STATIC_PROFILE_KIND[r.id];
    if (!kind) {
      return {
        unresolvedReason:
          "estimated region missing entry in STATIC_PROFILE_KIND — add a row in scripts/lib/tier-resolution.ts",
      };
    }
    inputs.profileKind = kind;
  }

  const tier = deriveTier(inputs);
  let bucket: Bucket;
  if (tier === "T1a-live-tso" || tier === "T1-live-TSO") bucket = "T1a";
  else if (tier === "T1b-live-domestic-anchored") bucket = "T1b";
  else if (tier === "T1c-live-neighbour-anchored") bucket = "T1c";
  else if (tier === "T3-modelled") bucket = "T3";
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
    T3: 0,
  };
  for (const r of resolved) counts[r.bucket]++;
  return counts;
}
