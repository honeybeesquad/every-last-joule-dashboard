#!/usr/bin/env tsx
/**
 * CI gate: assert that every committed snapshot region's `confidenceTier`
 * matches the canonical tier derived from `src/lib/regions.ts` +
 * `scripts/lib/tier-resolution.ts`.
 *
 * Catches the class of regression where:
 *   - someone changes `Region.tier` in regions.ts (e.g., live → static)
 *     but does not refresh the affected snapshot, so the dashboard
 *     keeps showing the old tier badge until the next data-refresh
 *     pulls a fresh snapshot;
 *   - someone migrates a region to a new sub-tier (e.g., live →
 *     live-neighbour-anchored) but the snapshot is stale at T1a;
 *   - someone hand-edits a snapshot's confidenceTier value to a label
 *     inconsistent with the canonical resolution.
 *
 * Tolerates the legacy `T1-live-TSO` label as an alias for
 * `T1a-live-tso` per B4 Option B (decision doc 2026-04-25).
 *
 * Exits 0 on a clean pass, 1 on any mismatch. Emits a per-violation line
 * so CI logs are actionable without re-running locally.
 *
 * Usage:
 *   npx tsx scripts/ci/check-tier-coherence.ts
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

import { resolveAll, type ResolvedRegion } from "../lib/tier-resolution.js";
import type { ConfidenceTier } from "../../src/lib/uncertainty.js";

const SNAP_DIR = join(process.cwd(), "data", "snapshots", "last-good");
const NON_REGION_FILES = new Set(["cbeci.json"]);

/**
 * Snapshot region ids that are intentionally NOT in the canonical REGIONS
 * table — typically pre-split aggregates retained for legacy fallback or
 * Phase B2 spike outputs. Adding to this set requires a one-line comment
 * explaining why the id exists outside the canonical table.
 *
 * If you are adding an id here, ask yourself: "could I instead split this
 * snapshot into the canonical sub-region ids and delete the parent file?"
 * That is the preferred fix; the allow-list is the escape hatch.
 */
const KNOWN_AGGREGATE_IDS = new Set<string>([
  // pre-split denmark.json — canonical split is denmark-east + denmark-west
  // via entsoe.json, retained for legacy fallback in src/index.md.
  "denmark",
  // pre-split iso-ne.json — canonical split is iso-ne-maine-vermont +
  // iso-ne-rest, retained for legacy fallback.
  "iso-ne",
  // pre-split nyiso.json — canonical split is nyiso-zones-d-e + nyiso-rest.
  "nyiso",
  // pre-split norway.json — canonical split is norway-no1..no5, retained
  // for the all-zones aggregate displayed in the legacy hotspot list.
  "n-norway",
  // pre-split north-sea.json — was the UK offshore aggregate before the
  // gb-england-wales / gb-scotland split landed; retained for legacy fallback.
  "north-sea",
  // Phase B2 ERCOT native-OAuth2 spike outputs (parallel to ercot-west /
  // ercot-east which are EIA-proxy). Both shapes coexist until the native
  // spike is promoted to canonical.
  "ercot-native-west",
  "ercot-native-east",
]);

// Legacy T1-live-TSO is an accepted alias of T1a-live-tso for pre-2026-04-25
// snapshots (B4 Option B decision, 2026-04-25). New emissions must use the
// sub-tier label, but a stale snapshot still reading T1-live-TSO is a soft
// warning here — `npm run snapshot` will refresh it on the next data pull.
function tierMatches(actual: string, expected: ConfidenceTier): boolean {
  if (actual === expected) return true;
  if (
    actual === "T1-live-TSO" &&
    (expected === "T1a-live-tso" || expected === "T1-live-TSO")
  ) {
    return true;
  }
  return false;
}

interface PerRegionRecord {
  regionId?: unknown;
  confidenceTier?: unknown;
}

function isRecordOfRegions(obj: unknown): obj is Record<string, PerRegionRecord> {
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) return false;
  const o = obj as Record<string, unknown>;
  if ("regionId" in o && "profile" in o) return false;
  return true;
}

if (!existsSync(SNAP_DIR)) {
  console.error(`snapshot dir not found at ${SNAP_DIR}`);
  process.exit(2);
}

const { resolved, unresolved } = resolveAll();
const RESOLVED_BY_ID = new Map<string, ResolvedRegion>(
  resolved.map((r) => [r.id, r]),
);

if (unresolved.length) {
  console.error("Cannot proceed: REGIONS table contains unresolved entries:");
  for (const u of unresolved) console.error(`  - ${u.id}: ${u.reason}`);
  process.exit(2);
}

// Flare-bucket invariant: every region with `Region.tier === "flare"` must
// resolve to the T2-flare bucket, and every region in the T2-flare bucket
// must have `Region.tier === "flare"`.
//
// The original failure mode was a hardcoded FLARE_IDS set in tier-resolution.ts
// that drifted behind regions.ts when new flare regions were added (qatar,
// kuwait, russia-yamal, russia-e-siberia were silently misbucketed into T2).
// The bucket-derivation logic now keys off Region.tier; this gate makes sure
// the two stay aligned even if someone re-introduces an id-set lookup.
//
// Note: this checks Region.tier, not Region.kind. A handful of regions
// (trinidad-tobago, guyana, suriname) are intentionally `kind: "flare"` +
// `tier: "static"` — offshore-flare anchors lifted onto country-level
// modelled coverage; they belong in T3, not T2-flare.
const bucketMismatches: string[] = [];
for (const r of resolved) {
  const tieredFlare = r.region.tier === "flare";
  const inFlareBucket = r.bucket === "T2-flare";
  if (tieredFlare !== inFlareBucket) {
    bucketMismatches.push(
      `${r.id}: tier="${r.region.tier}" but bucket="${r.bucket}" — flare-bucket invariant violated`,
    );
  }
}
if (bucketMismatches.length) {
  console.error("Flare-bucket invariant violations:");
  for (const m of bucketMismatches) console.error(`  - ${m}`);
  process.exit(2);
}

const files = readdirSync(SNAP_DIR)
  .filter((f) => f.endsWith(".json"))
  .filter((f) => !NON_REGION_FILES.has(f));

const failures: string[] = [];
const legacyAliases: string[] = [];
const aggregatesSeen: string[] = [];
let totalChecked = 0;
let totalMissingTier = 0;

for (const f of files) {
  const path = join(SNAP_DIR, f);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf-8"));
  } catch (e) {
    failures.push(`${f}: JSON parse error: ${(e as Error).message}`);
    continue;
  }
  const fileLabel = basename(f);

  const records: { rid: string; rec: PerRegionRecord }[] = [];
  if (isRecordOfRegions(parsed)) {
    for (const [rid, rec] of Object.entries(parsed as Record<string, PerRegionRecord>)) {
      records.push({ rid, rec });
    }
  } else {
    const rec = parsed as PerRegionRecord;
    const rid = typeof rec.regionId === "string" ? rec.regionId : fileLabel.replace(/\.json$/, "");
    records.push({ rid, rec });
  }

  for (const { rid, rec } of records) {
    totalChecked++;
    const canonical = RESOLVED_BY_ID.get(rid);
    if (!canonical) {
      if (KNOWN_AGGREGATE_IDS.has(rid)) {
        // Allow-listed legacy aggregate; still validate confidenceTier is
        // a recognised label by relying on the schema check in
        // validate-snapshots.ts. Skip canonical match here.
        aggregatesSeen.push(`${fileLabel}#${rid}`);
        continue;
      }
      failures.push(
        `${fileLabel}#${rid}: snapshot region not found in REGIONS table — either add to src/lib/regions.ts, remove the snapshot, or (if intentional) add to KNOWN_AGGREGATE_IDS in this script with a one-line justification`,
      );
      continue;
    }
    const actual = rec.confidenceTier;
    if (actual === undefined || actual === null) {
      totalMissingTier++;
      failures.push(
        `${fileLabel}#${rid}: missing confidenceTier (expected ${canonical.tier}) — run \`npm run snapshot\` to refresh, or check that the loader passes through enrichWithTier`,
      );
      continue;
    }
    if (typeof actual !== "string") {
      failures.push(
        `${fileLabel}#${rid}: confidenceTier is ${JSON.stringify(actual)}, expected string ${canonical.tier}`,
      );
      continue;
    }
    if (!tierMatches(actual, canonical.tier)) {
      failures.push(
        `${fileLabel}#${rid}: confidenceTier="${actual}" but canonical resolution → "${canonical.tier}" (Region.tier="${canonical.region.tier}") — refresh the snapshot or correct the canonical tier`,
      );
      continue;
    }
    if (actual === "T1-live-TSO" && canonical.tier === "T1a-live-tso") {
      legacyAliases.push(`${fileLabel}#${rid}`);
    }
  }
}

console.log(
  `Tier-coherence: checked ${totalChecked} region records across ${files.length} snapshot files.`,
);
if (legacyAliases.length) {
  console.log(
    `  ${legacyAliases.length} legacy T1-live-TSO alias(es) accepted (refresh on next \`npm run snapshot\` to migrate to T1a-live-tso): ${legacyAliases
      .slice(0, 5)
      .join(", ")}${legacyAliases.length > 5 ? "…" : ""}`,
  );
}
if (totalMissingTier > 0) {
  console.log(`  ${totalMissingTier} region(s) missing confidenceTier.`);
}
if (aggregatesSeen.length) {
  console.log(
    `  ${aggregatesSeen.length} allow-listed legacy aggregate(s) skipped: ${aggregatesSeen.join(", ")}`,
  );
}

if (failures.length === 0) {
  console.log(
    "All snapshot tiers coherent with canonical regions.ts + tier-resolution.ts.",
  );
  process.exit(0);
}

console.error(`\n${failures.length} tier-coherence failures:\n`);
for (const f of failures) console.error(`  ${f}`);
process.exit(1);
