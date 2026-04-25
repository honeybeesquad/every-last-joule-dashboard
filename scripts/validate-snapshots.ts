#!/usr/bin/env tsx
/**
 * Validate every committed snapshot against
 * `dataset/schema/region-snapshot.schema.json` without pulling a JSON
 * Schema runtime into the project. Hand-rolled because:
 *   - we already have one source of truth for shape (`src/lib/profile.ts`
 *     emits these objects, so the schema is a contract not the source);
 *   - the validation invariants we care about for submission are
 *     readable in 50 lines of TS — bringing in ajv would be 90 packages
 *     of transitive dependency for one CI-style assertion;
 *   - this script is the kind of thing reviewers can run locally, so
 *     keeping the dependency surface flat matters.
 *
 * Usage:
 *   npx tsx scripts/validate-snapshots.ts
 *
 * Exits 0 on a clean pass, 1 on any violation. Emits a per-region
 * status line so failures are diagnosable from the log.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

interface PerRegion {
  regionId: string;
  profile: unknown;
  latestProfile: unknown;
  totalTWh: unknown;
  peakGW: unknown;
  lastUpdated: unknown;
  lastSuccessAt: unknown;
  sourceNote: unknown;
  sourceStatus?: unknown;
  fuelShare: unknown;
  uncertaintyLowGW?: unknown;
  uncertaintyHighGW?: unknown;
  observedStdGW?: unknown;
  confidenceTier?: unknown;
}

// Required matches dataset/schema/region-snapshot.schema.json which in
// turn matches the RegionData interface in src/lib/types.ts. fuelShare
// and sourceNote are optional in the runtime contract; latestProfile
// is required-but-nullable.
const REQUIRED = [
  "regionId",
  "profile",
  "latestProfile",
  "totalTWh",
  "peakGW",
  "lastUpdated",
  "lastSuccessAt"
] as const;

const FUEL_KEYS = new Set(["solar", "wind", "hydro", "geothermal", "flare"]);
const TIER_ENUM = new Set([
  "T1-live-TSO",
  "T2-annual-calibrated",
  "T3-modelled",
  "T4-structural-gap"
]);
const STATUS_ENUM: ReadonlySet<unknown> = new Set(["live", "cached", "degraded", null]);

function isNonNegNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x) && x >= 0;
}

function check24(arr: unknown, label: string, errs: string[]): void {
  if (!Array.isArray(arr)) {
    errs.push(`${label} not an array`);
    return;
  }
  if (arr.length !== 24) {
    errs.push(`${label} length ${arr.length}, expected 24`);
    return;
  }
  for (let i = 0; i < 24; i++) {
    if (!isNonNegNumber(arr[i])) {
      errs.push(`${label}[${i}] = ${JSON.stringify(arr[i])} not non-neg number`);
    }
  }
}

function checkLatestProfile(value: unknown, errs: string[]): void {
  // Schema: latestProfile is required but nullable. Loaders that
  // pin a same-day raw curve emit a 24-element array; loaders that
  // can't return null (see RegionData.latestProfile in src/lib/types.ts).
  if (value === null) return;
  check24(value, "latestProfile", errs);
}

function validate(obj: unknown, ctx: string): string[] {
  const errs: string[] = [];
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    return [`${ctx}: not an object`];
  }
  const r = obj as PerRegion;

  for (const key of REQUIRED) {
    if (!(key in r)) errs.push(`missing required field "${key}"`);
  }
  if (typeof r.regionId !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(r.regionId)) {
    errs.push(`regionId "${r.regionId}" violates kebab-case pattern`);
  }
  check24(r.profile, "profile", errs);
  checkLatestProfile(r.latestProfile, errs);
  if (!isNonNegNumber(r.totalTWh)) errs.push(`totalTWh = ${JSON.stringify(r.totalTWh)} not non-neg number`);
  if (!isNonNegNumber(r.peakGW)) errs.push(`peakGW = ${JSON.stringify(r.peakGW)} not non-neg number`);
  if (typeof r.lastUpdated !== "string") errs.push(`lastUpdated not string`);
  if (typeof r.lastSuccessAt !== "string" || !Number.isFinite(new Date(r.lastSuccessAt).getTime())) {
    errs.push(`lastSuccessAt not ISO-8601 string`);
  }
  if ("sourceNote" in r && r.sourceNote !== undefined && typeof r.sourceNote !== "string") {
    errs.push(`sourceNote present but not a string`);
  }

  if ("sourceStatus" in r && !STATUS_ENUM.has(r.sourceStatus as unknown)) {
    errs.push(`sourceStatus = ${JSON.stringify(r.sourceStatus)} not in {live, cached, degraded, null}`);
  }

  // fuelShare is optional. When present, validate keys + value range.
  if ("fuelShare" in r && r.fuelShare !== undefined) {
    if (typeof r.fuelShare !== "object" || r.fuelShare === null || Array.isArray(r.fuelShare)) {
      errs.push(`fuelShare present but not an object`);
    } else {
      for (const [k, v] of Object.entries(r.fuelShare)) {
        if (!FUEL_KEYS.has(k)) errs.push(`fuelShare unknown key "${k}"`);
        if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1) {
          errs.push(`fuelShare.${k} = ${v} not in [0, 1]`);
        }
      }
    }
  }

  if ("confidenceTier" in r && r.confidenceTier !== undefined) {
    if (!TIER_ENUM.has(r.confidenceTier as string)) {
      errs.push(`confidenceTier = ${JSON.stringify(r.confidenceTier)} not in tier enum`);
    }
  }
  if ("uncertaintyLowGW" in r && r.uncertaintyLowGW !== undefined) {
    if (!isNonNegNumber(r.uncertaintyLowGW)) errs.push(`uncertaintyLowGW not non-neg number`);
  }
  if ("uncertaintyHighGW" in r && r.uncertaintyHighGW !== undefined) {
    if (!isNonNegNumber(r.uncertaintyHighGW)) errs.push(`uncertaintyHighGW not non-neg number`);
  }
  if ("observedStdGW" in r && r.observedStdGW !== undefined) {
    if (!isNonNegNumber(r.observedStdGW)) errs.push(`observedStdGW not non-neg number`);
  }

  // Cross-field invariant — the envelope must straddle peakGW. This
  // is the assertion that the gap-closure plan §S2 success-criterion
  // requires for every parquet row, applied here at the snapshot
  // boundary too.
  if (
    isNonNegNumber(r.peakGW) &&
    isNonNegNumber(r.uncertaintyLowGW as number) &&
    isNonNegNumber(r.uncertaintyHighGW as number)
  ) {
    const low = r.uncertaintyLowGW as number;
    const high = r.uncertaintyHighGW as number;
    if (!(low <= r.peakGW && r.peakGW <= high)) {
      errs.push(
        `envelope violation: ${low.toFixed(3)} ≤ ${r.peakGW.toFixed(3)} ≤ ${high.toFixed(3)} false`
      );
    }
  }

  return errs.map((e) => `${ctx}: ${e}`);
}

function isRecordOfRegions(obj: unknown): obj is Record<string, PerRegion> {
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) return false;
  // A wrapper looks like { regionA: { regionId, profile, ... }, regionB: { ... } }
  // A single record has top-level keys like regionId/profile.
  const o = obj as Record<string, unknown>;
  if ("regionId" in o && "profile" in o) return false;
  return true;
}

const SNAP_DIR = join(process.cwd(), "data", "snapshots", "last-good");
if (!existsSync(SNAP_DIR)) {
  console.error(`snapshot dir not found at ${SNAP_DIR}`);
  process.exit(2);
}

// Sibling snapshots that share the same directory but follow different
// shape contracts (NOT region snapshots). cbeci.json carries CBECIData
// (hashrateEHps / annualisedConsumptionTWh — see src/lib/types.ts).
// Add to this set if more non-region siblings appear; do NOT silently
// skip ones we want to validate against the region schema.
const NON_REGION_FILES = new Set(["cbeci.json"]);

const files = readdirSync(SNAP_DIR)
  .filter((f) => f.endsWith(".json"))
  .filter((f) => !NON_REGION_FILES.has(f));
let totalRegions = 0;
let withTier = 0;
const failures: string[] = [];

for (const f of files) {
  const path = join(SNAP_DIR, f);
  const text = readFileSync(path, "utf-8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    failures.push(`${f}: JSON parse error: ${(e as Error).message}`);
    continue;
  }
  const fileLabel = basename(f);
  if (isRecordOfRegions(parsed)) {
    for (const [rid, region] of Object.entries(parsed as Record<string, PerRegion>)) {
      totalRegions++;
      if ((region as PerRegion).confidenceTier) withTier++;
      const errs = validate(region, `${fileLabel}#${rid}`);
      failures.push(...errs);
    }
  } else {
    totalRegions++;
    if ((parsed as PerRegion).confidenceTier) withTier++;
    const errs = validate(parsed, fileLabel);
    failures.push(...errs);
  }
}

console.log(`Validated ${files.length} snapshot files → ${totalRegions} region records`);
console.log(`Tier-enriched: ${withTier} / ${totalRegions} (${((withTier / totalRegions) * 100).toFixed(1)}%)`);
if (failures.length === 0) {
  console.log("All snapshots conform to dataset/schema/region-snapshot.schema.json invariants.");
  process.exit(0);
}
console.error(`\n${failures.length} validation failures:\n`);
for (const f of failures) console.error(`  ${f}`);
process.exit(1);
