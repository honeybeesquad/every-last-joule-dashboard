#!/usr/bin/env tsx
/**
 * CI gate: assert that the per-region validation docs under
 * `docs/validation/` are in sync with the canonical REGIONS table:
 *
 *   1. Every region in REGIONS has a `docs/validation/<id>.md`.
 *   2. Every `docs/validation/<id>.md` (other than README and the
 *      template) corresponds to a region in REGIONS or to an explicit
 *      legacy-aggregate allow-list entry.
 *   3. Each per-region MD's `- **Tier:** <value>` line matches the
 *      canonical `Region.tier` value.
 *
 * Catches the class of regression where someone adds a region without
 * regenerating the docs (downstream readers see the dashboard surface
 * a region with no validation page) or changes a region's tier in
 * regions.ts without re-running `python3 scripts/validation/build_region_docs.py`
 * (the docs and the dashboard then disagree about provenance).
 *
 * Exits 0 on a clean pass, 1 on any drift.
 *
 * Usage:
 *   npx tsx scripts/ci/check-docs-drift.ts
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

import { REGIONS } from "../../src/lib/regions.js";

const DOCS_DIR = join(process.cwd(), "docs", "validation");

/**
 * Files in `docs/validation/` that are NOT per-region pages. The README
 * is the index; `_template` is the seed file for new regions; the
 * legacy-aggregate ids match the same allow-list in
 * `scripts/ci/check-tier-coherence.ts` so a reader who finds an
 * `iso-ne.md` or `nyiso.md` page sees the same explanation pattern.
 */
const NON_REGION_DOCS = new Set<string>([
  "README",
  "_template",
  // Legacy aggregate docs preserved alongside the split sub-region docs;
  // see KNOWN_AGGREGATE_IDS in scripts/ci/check-tier-coherence.ts for
  // the snapshot-side mirror of this set.
  "iso-ne",
  "nyiso",
  // Pre-rename historical docs preserved for inbound link continuity.
  // Each was the original parent of a per-state / per-utility split.
  "india-north",   // → split into india-rajasthan + others (India W1, 2026-05-02)
  "india-south",   // → replaced by india-tamil-nadu + india-karnataka (India W2)
  "india-west",    // → replaced by india-gujarat (India W2)
  "italy-south",   // → replaced by italy-sicily (B4 Option B, 2026-04-25)
  "japan",         // → renamed japan-kyushu, then split into 10 utilities (Japan W1)
]);

if (!existsSync(DOCS_DIR)) {
  console.error(`docs dir not found at ${DOCS_DIR}`);
  process.exit(2);
}

const failures: string[] = [];

// --- 1. Every region has a doc. -----------------------------------------
for (const r of REGIONS) {
  const path = join(DOCS_DIR, `${r.id}.md`);
  if (!existsSync(path)) {
    failures.push(
      `region "${r.id}" has no docs/validation/${r.id}.md — run \`python3 scripts/validation/build_region_docs.py\` to regenerate`,
    );
  }
}

// --- 2. Every doc corresponds to a known region or allow-listed name. ---
const knownIds = new Set(REGIONS.map((r) => r.id));
const allDocs = readdirSync(DOCS_DIR)
  .filter((f) => f.endsWith(".md"))
  .map((f) => f.replace(/\.md$/, ""));
for (const docId of allDocs) {
  if (NON_REGION_DOCS.has(docId)) continue;
  if (!knownIds.has(docId)) {
    failures.push(
      `docs/validation/${docId}.md has no matching region in REGIONS — either add to src/lib/regions.ts, delete the doc, or (if intentional) add to NON_REGION_DOCS in this script`,
    );
  }
}

// --- 3. Tier line matches canonical. ------------------------------------
// Format: `- **Tier:** <value>` — case-sensitive, exact match required.
// Allow flare/static/live/live-domestic-anchored/live-neighbour-anchored.
const TIER_LINE_RE = /^- \*\*Tier:\*\* (.+)$/m;
for (const r of REGIONS) {
  const path = join(DOCS_DIR, `${r.id}.md`);
  if (!existsSync(path)) continue; // already reported
  const text = readFileSync(path, "utf-8");
  const match = text.match(TIER_LINE_RE);
  if (!match) {
    failures.push(
      `docs/validation/${r.id}.md: missing \`- **Tier:** ...\` header line — regenerate via build_region_docs.py`,
    );
    continue;
  }
  const docTier = match[1].trim();
  if (docTier !== r.tier) {
    failures.push(
      `docs/validation/${r.id}.md: Tier="${docTier}" but canonical Region.tier="${r.tier}" — regenerate via build_region_docs.py`,
    );
  }
}

console.log(
  `Docs-drift: checked ${REGIONS.length} regions against ${allDocs.length} docs in ${DOCS_DIR}.`,
);

if (failures.length === 0) {
  console.log("All per-region validation docs match canonical regions.ts.");
  process.exit(0);
}

console.error(`\n${failures.length} docs-drift failure(s):\n`);
for (const f of failures) console.error(`  ${f}`);
process.exit(1);
