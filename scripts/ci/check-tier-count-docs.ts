#!/usr/bin/env tsx
/**
 * CI gate: assert that the per-tier region counts stated in prose across the
 * methodology corpus match the locked golden tier counts in
 * `scripts/ci/golden/tier-counts.json`.
 *
 * Covers the four documents listed in `GATED_DOCS`
 * (scripts/lib/tier-count-docs.ts). `src/methodology.md` is deliberately not
 * among them — `ci:methodology-counts` owns that page's §2.1 header format.
 *
 * Why this exists — PRs #979, #980 and #982 corrected, by hand, five documents
 * whose tier conditions and per-tier counts had drifted from the dataset for
 * roughly three months. #981 gated the first of them. This gate is the same
 * catch for the rest, so the drift class closes instead of recurring one
 * document at a time.
 *
 * What it checks, per document:
 *
 *   1. **Roster lines** — any line naming all five buckets with a count
 *      (`T1a 160, T1b 26, T1c 1, T2 23, T3 249 — total 459`). Every bucket is
 *      checked against the golden, the `total N` is checked against the golden
 *      total, and the five are checked against the stated total so a line
 *      cannot contradict itself.
 *   2. **Bucket claims** — lines the author tagged `<!-- tier-counts:T1a -->`,
 *      opting a prose count into the gate regardless of phrasing.
 *   3. **Shape** — the exact number of rosters, bucket claims and
 *      `<!-- tier-counts:ignore -->` lines expected in each document. This is
 *      the "cannot pass by matching nothing" contract: a reworded claim drops
 *      the count and fails, rather than silently leaving the gate reading an
 *      empty set.
 *
 * Pinned content — `dataset/README.md`'s v1.3.2 deposit figures,
 * `uncertainty.md`'s retained 2026-04-26 snapshot, `dataset/CHANGELOG.md`'s
 * release entries, `docs/paper/*`'s 384-region vintage — is exempt by design.
 * The first two carry `<!-- tier-counts:ignore -->` where they would otherwise
 * parse; the last two are not gated at all. Rewriting any of them to match HEAD
 * would falsify a published record, which is the opposite of what this gate is
 * for.
 *
 * This gate reads the golden file, not `regions.ts`, so a tier move fails
 * `ci:tally-golden` first and lands here only once the golden is deliberately
 * updated — keeping one audit trail rather than two competing ones.
 *
 * Update procedure when the population legitimately changes:
 *   1. Land the regions.ts + golden change per check-tally-golden.ts's procedure.
 *   2. Update the roster lines and tagged bucket claims in the documents below.
 *   3. Stage both in the same commit so review sees the prose and the data move together.
 *
 * Exits 0 on a clean pass, 1 on any count drift or shape change, 2 if a
 * document is missing or a marker is unusable.
 *
 * Usage:
 *   npx tsx scripts/ci/check-tier-count-docs.ts
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import {
  checkDoc,
  checkGoldenSelfConsistent,
  parseDoc,
  GATED_DOCS,
  BUCKET_KEYS,
  TierCountFormatError,
  type GoldenCounts,
} from "../lib/tier-count-docs.js";

const GOLDEN_PATH = join(
  process.cwd(),
  "scripts",
  "ci",
  "golden",
  "tier-counts.json",
);

const goldenRaw = JSON.parse(
  readFileSync(GOLDEN_PATH, "utf-8"),
) as Partial<GoldenCounts> & { $comment?: string };

for (const key of [...BUCKET_KEYS, "total"] as const) {
  if (typeof goldenRaw[key] !== "number") {
    console.error(
      `golden file ${GOLDEN_PATH} missing or non-numeric key "${key}" — verify the file is well-formed.`,
    );
    process.exit(2);
  }
}
const golden = goldenRaw as GoldenCounts;

const failures: string[] = [...checkGoldenSelfConsistent(golden)];
let rosterCount = 0;
let claimCount = 0;
let ignoredCount = 0;

for (const spec of GATED_DOCS) {
  const path = join(process.cwd(), spec.path);
  if (!existsSync(path)) {
    console.error(
      `Cannot proceed: ${spec.path} is listed in GATED_DOCS but does not exist. ` +
        `If it was renamed or retired, update GATED_DOCS in scripts/lib/tier-count-docs.ts — ` +
        `dropping it silently would remove a gated document without review.`,
    );
    process.exit(2);
  }

  const markdown = readFileSync(path, "utf-8");
  try {
    failures.push(...checkDoc(spec, markdown, golden));
    const parsed = parseDoc(markdown);
    rosterCount += parsed.rosters.length;
    claimCount += parsed.bucketClaims.length;
    ignoredCount += parsed.ignored.length;
  } catch (err) {
    if (err instanceof TierCountFormatError) {
      console.error(`Cannot proceed: ${spec.path}: ${err.message}`);
      process.exit(2);
    }
    throw err;
  }
}

console.log(
  `Tier-count docs: checked ${rosterCount} roster line(s) and ${claimCount} tagged bucket claim(s) across ${GATED_DOCS.length} document(s) against ${GOLDEN_PATH.replace(`${process.cwd()}/`, "")}.`,
);
console.log(
  `  Golden  — T1a=${golden.T1a} T1b=${golden.T1b} T1c=${golden.T1c} T2=${golden.T2} T3=${golden.T3} total=${golden.total}`,
);
console.log(
  `  Exempt  — ${ignoredCount} line(s) tagged \`<!-- tier-counts:ignore -->\` (pinned or historical; see each document).`,
);

if (failures.length === 0) {
  console.log("All gated documents agree with the golden tier counts.");
  process.exit(0);
}

console.error(`\n${failures.length} tier-count failure(s):\n`);
for (const f of failures) console.error(`  ${f}`);
console.error(
  `\nIf the region population changed on purpose, update these documents to match \`npm run tally:tiers\` in the same commit as the golden file. ` +
    `Never "fix" a figure that is pinned to a published release or Zenodo deposit — tag that line \`<!-- tier-counts:ignore -->\` instead.`,
);
process.exit(1);
