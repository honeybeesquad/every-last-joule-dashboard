/**
 * Authoritative tier-count tally as the dashboard / paper would present.
 *
 * Walks `REGIONS` from src/lib/regions.ts and resolves each region's tier
 * the same way the dashboard does:
 *   - `Region.tier === "live"`                     → T1a-live-tso
 *   - `Region.tier === "live-domestic-anchored"`   → T1b-live-domestic-anchored
 *   - `Region.tier === "live-neighbour-anchored"`  → T1c-live-neighbour-anchored
 *   - `Region.tier === "anchored"` + `kind === "flare"` → T2 flare (presented separately)
 *   - `Region.tier === "anchored"` (non-flare)     → T2 annual-calibrated
 *   - `Region.tier === "estimated"`:
 *       * Look up the loader / static spec to get profileKind
 *       * Pass through deriveTier
 *
 * Output: per-tier counts and per-tier region lists, suitable for pasting
 * into Figure 4 caption, §4.5 classification table, and CHANGELOG counts.
 *
 * The B4-Option-B subdivision (locked 2026-04-25) splits the legacy
 * `T1-live-TSO` bucket into T1a/T1b/T1c. For continuity with pre-2026
 * snapshots the legacy `T1-live-TSO` label is mapped to the T1a bucket.
 *
 * Resolution rules and the static-region profileKind table live in
 * `scripts/lib/tier-resolution.ts` so the same logic backs the CI gate
 * scripts under `scripts/ci/`.
 */

import { resolveAll, countByBucket, type Bucket } from "./lib/tier-resolution.js";

const { resolved, unresolved } = resolveAll();
const counts = countByBucket(resolved);

console.log("=== Tier counts ===");
console.log(`T1a-live-tso:                  ${counts.T1a}`);
console.log(`T1b-live-domestic-anchored:    ${counts.T1b}`);
console.log(`T1c-live-neighbour-anchored:   ${counts.T1c}`);
console.log(`T2-annual-calibrated:          ${counts.T2}`);
console.log(`T2-flare:                      ${counts["T2-flare"]}`);
console.log(`T3-modelled:                   ${counts.T3}`);
console.log(`Total:                         ${resolved.length}`);
if (unresolved.length) {
  console.log(
    `\n!! Unresolved (${unresolved.length}): ${unresolved
      .map((u) => `${u.id} (${u.reason})`)
      .join("; ")}`,
  );
}

console.log("\n=== Per-bucket lists ===");
for (const bucket of ["T1a", "T1b", "T1c", "T2", "T2-flare", "T3"] as const satisfies readonly Bucket[]) {
  const inBucket = resolved.filter((r) => r.bucket === bucket);
  console.log(`\n${bucket} (${inBucket.length}):`);
  for (const r of inBucket) {
    console.log(`  ${r.id.padEnd(28)} ${r.name}`);
  }
}
