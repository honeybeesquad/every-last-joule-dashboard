#!/usr/bin/env tsx
/**
 * CI gate: assert that the region counts stated in `src/methodology.md` prose
 * match the locked golden tier counts in `scripts/ci/golden/tier-counts.json`:
 *
 *   1. §2.1's five `**T{1a,1b,1c,2,3}-<name> (N regions, ...)` headers against
 *      the golden per-bucket counts.
 *   2. Every `N regions` total claim outside §2.1 and §8 — today the Abstract's
 *      "across 459 regions" and §5's "Coverage is 459 regions" — against the
 *      golden total.
 *
 * Why this exists — PR #979: §2.1's five sub-tier counts summed to 377 against an
 * actual 459 and had been wrong for roughly three months (T1a/T1b since 2026-06-16,
 * T2 since 2026-05-10, T3 since 2026-05-12). Nothing caught it. `ci:tally-golden`
 * compares the golden file to `src/lib/regions.ts` and `ci:docs-drift` compares the
 * per-region validation docs to `regions.ts` — neither reads methodology prose, so
 * the public-facing page could drift from the dataset indefinitely. This gate is
 * that catch. It closes the loop: golden ↔ regions.ts is `ci:tally-golden`'s job,
 * golden ↔ methodology prose is this one's.
 *
 * This gate reads the golden file, not `regions.ts`, so a tier move fails
 * `ci:tally-golden` first and lands here only once the golden is deliberately
 * updated — keeping one audit trail rather than two competing ones.
 *
 * Update procedure when the population legitimately changes:
 *   1. Land the regions.ts + golden change per check-tally-golden.ts's procedure.
 *   2. Update §2.1's five headers and the total claims in src/methodology.md.
 *   3. Stage both in the same commit so review sees the page and the data move together.
 *
 * Exits 0 on a clean pass, 1 on any count drift, 2 if the document structure
 * changed such that the check cannot run.
 *
 * Usage:
 *   npx tsx scripts/ci/check-methodology-counts.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  checkMethodologyCounts,
  parseSubTierCounts,
  parseTotalClaims,
  MethodologyFormatError,
  SUB_TIER_KEYS,
  type GoldenCounts,
} from "../lib/methodology-counts.js";

const GOLDEN_PATH = join(
  process.cwd(),
  "scripts",
  "ci",
  "golden",
  "tier-counts.json",
);
const METHODOLOGY_PATH = join(process.cwd(), "src", "methodology.md");

const goldenRaw = JSON.parse(
  readFileSync(GOLDEN_PATH, "utf-8"),
) as Partial<GoldenCounts> & { $comment?: string };

const REQUIRED_KEYS = [...SUB_TIER_KEYS, "total"] as const;
for (const key of REQUIRED_KEYS) {
  if (typeof goldenRaw[key] !== "number") {
    console.error(
      `golden file ${GOLDEN_PATH} missing or non-numeric key "${key}" — verify the file is well-formed.`,
    );
    process.exit(2);
  }
}
const golden = goldenRaw as GoldenCounts;

const markdown = readFileSync(METHODOLOGY_PATH, "utf-8");

let failures: string[];
try {
  failures = checkMethodologyCounts(markdown, golden);
} catch (err) {
  if (err instanceof MethodologyFormatError) {
    console.error(`Cannot proceed: ${err.message}`);
    process.exit(2);
  }
  throw err;
}

const subTierClaims = parseSubTierCounts(markdown);
const totalClaims = parseTotalClaims(markdown);

console.log(
  `Methodology-counts: checked ${subTierClaims.length} sub-tier header(s) and ${totalClaims.length} total claim(s) in src/methodology.md against ${GOLDEN_PATH.replace(`${process.cwd()}/`, "")}.`,
);
console.log(
  `  Golden  — T1a=${golden.T1a} T1b=${golden.T1b} T1c=${golden.T1c} T2=${golden.T2} T3=${golden.T3} total=${golden.total}`,
);
console.log(
  `  Stated  — ${subTierClaims.map((c) => `${c.key}=${c.stated}`).join(" ")} total=${[...new Set(totalClaims.map((t) => t.stated))].join("/") || "none"}`,
);

if (failures.length === 0) {
  console.log("Methodology prose matches the golden tier counts.");
  process.exit(0);
}

console.error(`\n${failures.length} methodology-count failure(s):\n`);
for (const f of failures) console.error(`  ${f}`);
console.error(
  `\nIf the region population changed on purpose, update src/methodology.md to match \`npm run tally:tiers\` in the same commit as the golden file.`,
);
process.exit(1);
