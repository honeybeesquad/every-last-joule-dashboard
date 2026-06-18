#!/usr/bin/env tsx
/**
 * CI gate: assert that the per-bucket population of the canonical REGIONS
 * table (resolved via `scripts/lib/tier-resolution.ts`) matches the locked
 * golden values in `scripts/ci/golden/tier-counts.json`.
 *
 * Why this exists: a region added or moved between tiers is a substantive
 * change that should appear in PR review explicitly. Without a golden
 * gate, a tier shift is invisible — the test suite is content with the
 * shape of REGIONS, validate-snapshots is content with the schema, and
 * the only tally that catches it (`npm run tally:tiers`) is informational
 * not enforcing. This gate makes the count diff the audit trail.
 *
 * Update procedure when intentionally changing the population:
 *   1. Make the regions.ts (and possibly statics) change.
 *   2. Run `npm run tally:tiers` to read the new actual counts.
 *   3. Update `scripts/ci/golden/tier-counts.json` to match.
 *   4. Stage both files in the same commit so review sees the link.
 *
 * Exits 0 on a clean pass, 1 on any drift.
 *
 * Usage:
 *   npx tsx scripts/ci/check-tally-golden.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  resolveAll,
  countByBucket,
  type Bucket,
} from "../lib/tier-resolution.js";

const GOLDEN_PATH = join(
  process.cwd(),
  "scripts",
  "ci",
  "golden",
  "tier-counts.json",
);

interface GoldenCounts {
  T1a: number;
  T1b: number;
  T1c: number;
  T2: number;
  T3: number;
  total: number;
}

const goldenRaw = JSON.parse(readFileSync(GOLDEN_PATH, "utf-8")) as Partial<GoldenCounts> & {
  $comment?: string;
};

const REQUIRED_KEYS: (keyof GoldenCounts)[] = [
  "T1a",
  "T1b",
  "T1c",
  "T2",
  "T3",
  "total",
];
for (const k of REQUIRED_KEYS) {
  if (typeof goldenRaw[k] !== "number") {
    console.error(
      `golden file ${GOLDEN_PATH} missing or non-numeric key "${k}" — verify the file is well-formed.`,
    );
    process.exit(2);
  }
}
const golden = goldenRaw as GoldenCounts;

const { resolved, unresolved } = resolveAll();
if (unresolved.length) {
  console.error("Cannot proceed: REGIONS table contains unresolved entries:");
  for (const u of unresolved) console.error(`  - ${u.id}: ${u.reason}`);
  process.exit(2);
}

const counts = countByBucket(resolved);
const actual: GoldenCounts = {
  ...counts,
  total: resolved.length,
};

const failures: string[] = [];
for (const k of REQUIRED_KEYS) {
  if (actual[k] !== golden[k]) {
    failures.push(
      `${k}: golden=${golden[k]}, actual=${actual[k]} (Δ ${actual[k] - golden[k]})`,
    );
  }
}

console.log(
  `Tally-golden: comparing actual ${actual.total} regions against golden ${golden.total} regions.`,
);
console.log(
  `  Buckets — golden: T1a=${golden.T1a} T1b=${golden.T1b} T1c=${golden.T1c} T2=${golden.T2} T3=${golden.T3}`,
);
console.log(
  `  Buckets — actual: T1a=${actual.T1a} T1b=${actual.T1b} T1c=${actual.T1c} T2=${actual.T2} T3=${actual.T3}`,
);

if (failures.length === 0) {
  console.log("Tally matches golden.");
  process.exit(0);
}

console.error(`\n${failures.length} bucket-count drift(s):\n`);
for (const f of failures) console.error(`  ${f}`);
console.error(
  `\nIf the drift is intentional, run \`npm run tally:tiers\` and update scripts/ci/golden/tier-counts.json in the same commit.`,
);
process.exit(1);
