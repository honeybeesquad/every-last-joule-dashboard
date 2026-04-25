/**
 * Authoritative tier-count tally as the dashboard / paper would present.
 *
 * Walks `REGIONS` from src/lib/regions.ts and resolves each region's tier
 * the same way the dashboard does:
 *   - `Region.tier === "live"`     → T1-live-TSO
 *   - `Region.tier === "flare"`    → T2 flare (presented separately)
 *   - `Region.tier === "static"`:
 *       * Look up the loader / static spec to get profileKind
 *       * Pass through deriveTier
 *
 * Output: per-tier counts and per-tier region lists, suitable for pasting
 * into Figure 4 caption, §4.5 classification table, and CHANGELOG counts.
 */

import { REGIONS } from "../src/lib/regions.js";
import { deriveTier, type TierInputs, type ConfidenceTier } from "../src/lib/uncertainty.js";

type ProfileKind = NonNullable<TierInputs["profileKind"]>;

/**
 * Per-region static profileKind. For static regions only; live and flare
 * regions don't need this. Mirrors the buildTypicalXxx call inside each
 * loader, plus the per-spec kind in src/data/statics.json.ts.
 */
const STATIC_PROFILE_KIND: Record<string, ProfileKind> = {
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

const FLARE_IDS = new Set(["permian", "w-siberia", "s-iraq", "e-saudi"]);

interface ResolvedRegion {
  id: string;
  name: string;
  tier: ConfidenceTier;
  bucket: "T1" | "T2-flare" | "T2" | "T3";
}

const resolved: ResolvedRegion[] = [];
const unresolved: string[] = [];

for (const r of REGIONS) {
  let inputs: TierInputs;
  if (r.tier === "live") {
    inputs = { regionTier: "live" };
  } else if (r.tier === "flare") {
    inputs = { regionTier: "flare" };
  } else {
    const kind = STATIC_PROFILE_KIND[r.id];
    if (!kind) {
      unresolved.push(r.id);
      continue;
    }
    inputs = { regionTier: "static", profileKind: kind };
  }
  const tier = deriveTier(inputs);
  let bucket: ResolvedRegion["bucket"];
  if (tier === "T1-live-TSO") bucket = "T1";
  else if (tier === "T3-modelled") bucket = "T3";
  else if (FLARE_IDS.has(r.id)) bucket = "T2-flare";
  else bucket = "T2";
  resolved.push({ id: r.id, name: r.name, tier, bucket });
}

const counts = { T1: 0, T2: 0, "T2-flare": 0, T3: 0 };
for (const r of resolved) counts[r.bucket]++;

console.log("=== Tier counts ===");
console.log(`T1-live-TSO:           ${counts.T1}`);
console.log(`T2-annual-calibrated:  ${counts.T2}`);
console.log(`T2-flare:              ${counts["T2-flare"]}`);
console.log(`T3-modelled:           ${counts.T3}`);
console.log(`Total:                 ${resolved.length}`);
if (unresolved.length) {
  console.log(`\n!! Unresolved (no profileKind mapping): ${unresolved.join(", ")}`);
}

console.log("\n=== Per-bucket lists ===");
for (const bucket of ["T1", "T2", "T2-flare", "T3"] as const) {
  const inBucket = resolved.filter((r) => r.bucket === bucket);
  console.log(`\n${bucket} (${inBucket.length}):`);
  for (const r of inBucket) {
    console.log(`  ${r.id.padEnd(28)} ${r.name}`);
  }
}
