#!/usr/bin/env tsx
/**
 * CI stub: count validation docs that cite a bad-conversion check.
 *
 * This is the baseline-metric stub for the bad-conversions checklist
 * documented at docs/methodology/tier-classification-guide.md#bad-conversions-you-must-reject.
 *
 * Behaviour:
 *   - Scans every Markdown file under docs/validation/.
 *   - For each doc, detects whether it explicitly cites the checklist by
 *     matching the literal markers "Bad-conversions check", "bad-conversion",
 *     or "Decision question:" (case-insensitive). Any one match counts as a
 *     citation.
 *   - Writes a tally JSON to data/coverage-audit/bad-conversion-citations.json
 *     with per-doc citation flags and aggregate counts.
 *   - Always exits 0. This is a baseline-metric pass, not an enforcement
 *     gate. A follow-up PR will ramp this up to a real gate once the
 *     validation-doc sweep populates citations across the corpus.
 *
 * Usage:
 *   npx tsx scripts/ci/check-validation-doc-bad-conversions.ts
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, basename } from "node:path";

const VALIDATION_DIR = join(process.cwd(), "docs", "validation");
const OUTPUT_PATH = join(process.cwd(), "data", "coverage-audit", "bad-conversion-citations.json");

const CITATION_PATTERNS: RegExp[] = [
  /bad[\s-]conversions?\s+check/i,
  /\bbad[\s-]conversion\b/i,
  /\bdecision\s+question:/i,
];

interface DocResult {
  file: string;
  cited: boolean;
  matchedPatterns: string[];
}

function scan(): DocResult[] {
  const entries = readdirSync(VALIDATION_DIR, { withFileTypes: true });
  const results: DocResult[] = [];

  for (const e of entries) {
    if (!e.isFile()) continue;
    if (!e.name.endsWith(".md")) continue;
    if (e.name === "_template.md") continue;
    if (e.name === "README.md") continue;

    const path = join(VALIDATION_DIR, e.name);
    const content = readFileSync(path, "utf-8");
    const matched: string[] = [];
    for (const pat of CITATION_PATTERNS) {
      if (pat.test(content)) matched.push(pat.source);
    }
    results.push({
      file: basename(e.name),
      cited: matched.length > 0,
      matchedPatterns: matched,
    });
  }

  results.sort((a, b) => a.file.localeCompare(b.file));
  return results;
}

function main(): void {
  const docs = scan();
  const total = docs.length;
  const cited = docs.filter((d) => d.cited).length;
  const pctCited = total === 0 ? 0 : (cited / total) * 100;

  // No `generatedAt` field — output is committed and must be idempotent
  // across CI runs. Run this script locally before committing if you've
  // edited validation docs.
  const summary = {
    totalValidationDocs: total,
    docsCitingBadConversionCheck: cited,
    docsNotCiting: total - cited,
    pctCited: Number(pctCited.toFixed(2)),
    perDocCitations: docs,
  };

  mkdirSync(join(process.cwd(), "data", "coverage-audit"), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(summary, null, 2) + "\n", "utf-8");

  console.log(
    `bad-conversion citations: ${cited} of ${total} validation docs cite the checklist (${pctCited.toFixed(1)}%).`,
  );
  console.log(`  Wrote tally to ${OUTPUT_PATH}`);
  // Always exit 0. Baseline-metric pass; not an enforcement gate yet.
  process.exit(0);
}

main();
