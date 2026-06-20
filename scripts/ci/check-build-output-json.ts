#!/usr/bin/env tsx
/**
 * Build-output gate: every emitted JSON data file must parse.
 *
 * Defence-in-depth companion to the loader-stdout lint
 * (scripts/ci/check-loader-stdout-safety.ts). That gate catches the *cause* —
 * a `console.log` in a data loader — at lint time. This one catches the
 * *symptom* — a corrupt emitted JSON file — at build time, no matter how the
 * corruption arose (PR #259: stray stdout writes froze production because
 * `data/ontario-per-plant.json` no longer parsed).
 *
 * Observable Framework writes data-loader output and other file attachments
 * under `dist/_file/`. After `observable build` we walk that tree and assert
 * every `.json` still parses; a single failure fails the build so a broken
 * `dist/` never deploys.
 *
 * Wired as the `postbuild` npm script, so it runs after every `npm run build`
 * — locally and on Vercel (vercel.json buildCommand: "npm run build").
 *
 * Exits 0 on a clean pass (or when there is no build output to check), 1 if
 * any emitted JSON fails to parse.
 *
 * Usage:
 *   npx tsx scripts/ci/check-build-output-json.ts
 */

import { existsSync } from "node:fs";
import { join, relative } from "node:path";

import { findInvalidJsonFiles } from "../lib/json-output-validate.js";

const DIST = join(process.cwd(), "dist");
const FILE_DIR = join(DIST, "_file");

if (!existsSync(DIST)) {
  console.log(
    `Build-output JSON check: no dist/ at ${DIST} — nothing to validate (did the build run?).`,
  );
  process.exit(0);
}

if (!existsSync(FILE_DIR)) {
  console.log(
    "Build-output JSON check: dist/ has no _file/ directory — no data files emitted, nothing to validate.",
  );
  process.exit(0);
}

const invalid = findInvalidJsonFiles(FILE_DIR);

console.log(
  `Build-output JSON check: validated emitted .json files under ${relative(process.cwd(), FILE_DIR)}/.`,
);

if (invalid.length === 0) {
  console.log("All emitted JSON parses cleanly.");
  process.exit(0);
}

console.error(`\n${invalid.length} emitted JSON file(s) failed to parse:\n`);
for (const f of invalid) {
  console.error(`  ${relative(process.cwd(), f.file)}\n    ${f.error}`);
}
console.error(
  [
    "",
    "A data loader almost certainly wrote non-JSON to stdout (e.g. a stray",
    "console.log — see PR #259, and the lint gate ci:loader-stdout-safety).",
    "A loader's stdout IS its data file; fix the loader so stdout is pure JSON.",
  ].join("\n"),
);
process.exit(1);
