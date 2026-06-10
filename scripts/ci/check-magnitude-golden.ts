#!/usr/bin/env tsx
/**
 * CI gate: per-region totalTWh magnitude vs the locked golden baseline in
 * `scripts/ci/golden/magnitude-baseline.json`.
 *
 * Why this exists: the two worst shipped accuracy bugs — Brazil ONS summing
 * the generation CAP as curtailment (fixed eabf8e5, 2–5× state errors) and
 * Hokkaido parsing all-renewables MW as solar 万kW (10× overcount) — were
 * magnitude errors that passed schema validation. Schema checks shape;
 * this gate checks size. Scope is LIVE-tier regions only: that is where
 * parse/unit bugs live, and static T2/T3 anchors are deterministic.
 *
 * Update procedure when drift is intentional (formula fix, new region,
 * genuine upstream regime change):
 *   1. npx tsx scripts/ci/check-magnitude-golden.ts --update
 *   2. Commit the regenerated baseline in the SAME PR as the snapshot
 *      change so review sees the link.
 *
 * Modes:
 *   (none)       compare snapshots vs baseline; exit 1 on drift
 *   --update     rewrite the baseline from current snapshots; exit 0
 *   --self-test  run the comparison logic against synthetic cases
 *
 * Exits 0 clean, 1 on drift, 2 on structural problems (missing baseline).
 */

import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const SNAP_DIR = join(process.cwd(), "data", "snapshots", "last-good");
const GOLDEN_PATH = join(
  process.cwd(),
  "scripts",
  "ci",
  "golden",
  "magnitude-baseline.json",
);

// Mirrors LIVE_TIER_SET in scripts/validate-snapshots.ts.
const LIVE_TIERS = new Set([
  "T1-live-TSO",
  "T1a-live-tso",
  "T1b-live-domestic-anchored",
  "T1c-live-neighbour-anchored",
]);

/**
 * Regions where BOTH baseline and actual sit below this floor are skipped —
 * near-zero territory belongs to the all-zero gate in validate-snapshots.ts,
 * and ratios between two tiny numbers are noise.
 */
const MIN_TWH = 0.01;

/**
 * Drift band. 4× absorbs normal 30-day seasonal swing for live regions
 * while still catching the historical bug magnitudes (5× Piauí, 10×
 * Hokkaido). If a known-volatile region trips this legitimately, the fix
 * is a deliberate --update in the reviewing PR — that friction is the
 * feature.
 */
const FACTOR = 4;

interface SnapshotRecord {
  regionId: string;
  totalTWh: number;
  confidenceTier?: string;
}

function isSnapshotRecord(v: unknown): v is SnapshotRecord {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as SnapshotRecord).regionId === "string" &&
    typeof (v as SnapshotRecord).totalTWh === "number"
  );
}

/** A snapshot file is either one record or a map of records; non-region
 *  siblings (cbeci.json etc.) yield zero records and are naturally skipped. */
function extractRecords(parsed: unknown): SnapshotRecord[] {
  if (isSnapshotRecord(parsed)) return [parsed];
  if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
    return Object.values(parsed).filter(isSnapshotRecord);
  }
  return [];
}

function readActuals(): Record<string, number> {
  const actual: Record<string, number> = {};
  for (const f of readdirSync(SNAP_DIR).filter((f) => f.endsWith(".json"))) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(join(SNAP_DIR, f), "utf-8"));
    } catch {
      continue; // malformed JSON is validate-snapshots' failure to report
    }
    for (const rec of extractRecords(parsed)) {
      if (rec.confidenceTier && LIVE_TIERS.has(rec.confidenceTier)) {
        actual[rec.regionId] = rec.totalTWh;
      }
    }
  }
  return actual;
}

export function compareMagnitudes(
  baseline: Record<string, number>,
  actual: Record<string, number>,
): string[] {
  const failures: string[] = [];
  for (const [id, a] of Object.entries(actual)) {
    const b = baseline[id];
    if (b === undefined) {
      failures.push(
        `${id}: live-tier region not in baseline — run --update and commit the diff in this PR`,
      );
      continue;
    }
    if (a < MIN_TWH && b < MIN_TWH) continue;
    const ref = Math.max(b, MIN_TWH);
    const lo = ref / FACTOR;
    const hi = ref * FACTOR;
    if (a < lo || a > hi) {
      failures.push(
        `${id}: totalTWh=${a.toFixed(4)} outside [${lo.toFixed(4)}, ${hi.toFixed(4)}] ` +
          `(baseline ${b.toFixed(4)}, factor ${FACTOR}) — unit/formula bug, upstream regime ` +
          `change, or intentional fix needing --update`,
      );
    }
  }
  for (const id of Object.keys(baseline)) {
    if (!(id in actual)) {
      failures.push(
        `${id}: in baseline but missing from live-tier snapshots — region removed or ` +
          `demoted; run --update if intentional`,
      );
    }
  }
  return failures;
}

function selfTest(): void {
  const cases: Array<{
    name: string;
    baseline: Record<string, number>;
    actual: Record<string, number>;
    expectFailures: number;
  }> = [
    { name: "10x overcount flagged (Hokkaido class)", baseline: { x: 1 }, actual: { x: 10 }, expectFailures: 1 },
    { name: "5x undercount flagged (Brazil class)", baseline: { x: 1 }, actual: { x: 0.2 }, expectFailures: 1 },
    { name: "1.5x seasonal swing passes", baseline: { x: 1 }, actual: { x: 1.5 }, expectFailures: 0 },
    { name: "exactly 4x boundary passes", baseline: { x: 1 }, actual: { x: 4 }, expectFailures: 0 },
    { name: "both below MIN_TWH skipped", baseline: { x: 0.001 }, actual: { x: 0.004 }, expectFailures: 0 },
    { name: "tiny baseline, material actual flagged", baseline: { x: 0.001 }, actual: { x: 0.5 }, expectFailures: 1 },
    { name: "new region flagged", baseline: {}, actual: { y: 1 }, expectFailures: 1 },
    { name: "removed region flagged", baseline: { z: 1 }, actual: {}, expectFailures: 1 },
  ];
  let failed = 0;
  for (const c of cases) {
    const got = compareMagnitudes(c.baseline, c.actual).length;
    if (got !== c.expectFailures) {
      console.error(`SELF-TEST FAIL: ${c.name} — expected ${c.expectFailures} failure(s), got ${got}`);
      failed++;
    } else {
      console.log(`self-test ok: ${c.name}`);
    }
  }
  if (failed > 0) process.exit(2);
  console.log(`Self-test passed (${cases.length} cases).`);
  process.exit(0);
}

function main(): void {
  const mode = process.argv[2];
  if (mode === "--self-test") return selfTest();

  const actual = readActuals();

  if (mode === "--update") {
    const regions: Record<string, number> = {};
    for (const id of Object.keys(actual).sort()) {
      regions[id] = Math.round(actual[id] * 1e6) / 1e6;
    }
    const out = {
      $comment:
        "Locked per-region totalTWh baseline for LIVE-tier regions. Regenerate with " +
        "`npx tsx scripts/ci/check-magnitude-golden.ts --update` and commit in the same " +
        "PR as the snapshot change. Drift band is factor-4 either way; see script header.",
      regions,
    };
    writeFileSync(GOLDEN_PATH, `${JSON.stringify(out, null, 2)}\n`);
    console.log(`Wrote ${Object.keys(regions).length} live-tier baselines to ${GOLDEN_PATH}`);
    process.exit(0);
  }

  if (!existsSync(GOLDEN_PATH)) {
    console.error(`golden baseline not found at ${GOLDEN_PATH} — run --update once and commit it.`);
    process.exit(2);
  }
  const golden = JSON.parse(readFileSync(GOLDEN_PATH, "utf-8")) as {
    regions?: Record<string, number>;
  };
  if (typeof golden.regions !== "object" || golden.regions === null) {
    console.error(`golden file ${GOLDEN_PATH} missing "regions" map — verify the file is well-formed.`);
    process.exit(2);
  }

  const failures = compareMagnitudes(golden.regions, actual);
  console.log(
    `Magnitude-golden: compared ${Object.keys(actual).length} live-tier regions against ` +
      `${Object.keys(golden.regions).length} baselines (factor ${FACTOR}, floor ${MIN_TWH} TWh).`,
  );
  if (failures.length === 0) {
    console.log("All live-tier magnitudes within band.");
    process.exit(0);
  }
  console.error(`\n${failures.length} magnitude drift(s):\n`);
  for (const f of failures) console.error(`  ${f}`);
  console.error(
    `\nIf the drift is intentional, run \`npx tsx scripts/ci/check-magnitude-golden.ts --update\` ` +
      `and commit the baseline in the same PR.`,
  );
  process.exit(1);
}

main();
