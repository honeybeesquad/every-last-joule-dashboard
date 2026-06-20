#!/usr/bin/env tsx
/**
 * CI gate: no stdout-writing `console.*` calls in Observable data loaders.
 *
 * Why this exists — PR #259 (production outage, 2026-06-20): an Observable
 * Framework data loader (`src/data/*.json.ts`) emits its JSON by writing to
 * stdout. A stray `console.log()` in `src/data/ontario-per-plant.json.ts`
 * prepended a log line to that stream, so `data/ontario-per-plant.json` became
 * invalid JSON. The dashboard's `Promise.all(FileAttachment().json())` then
 * threw a site-wide SyntaxError and froze production on the loading screen.
 * Nothing caught it before deploy. This gate is that catch.
 *
 * Diagnostics in a loader MUST go to stderr (`console.warn` / `console.error`).
 * The sibling loader `src/data/aemo-per-plant.json.ts` shows the correct
 * pattern. This check is AST-based (see scripts/lib/loader-stdout-scan.ts), not
 * a grep, because the *fixed* Ontario loader documents the gotcha in a comment
 * containing the substring "console.log(" — a grep would fail the very file
 * that fixed the bug.
 *
 * Exits 0 on a clean pass, 1 if any loader writes to stdout via console.
 *
 * Usage:
 *   npx tsx scripts/ci/check-loader-stdout-safety.ts
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { scanForStdoutConsoleWrites } from "../lib/loader-stdout-scan.js";

const DATA_DIR = join(process.cwd(), "src", "data");

const loaderFiles = readdirSync(DATA_DIR)
  .filter((f) => f.endsWith(".json.ts"))
  .sort();

const failures: string[] = [];
for (const file of loaderFiles) {
  const findings = scanForStdoutConsoleWrites(
    readFileSync(join(DATA_DIR, file), "utf-8"),
    file,
  );
  for (const f of findings) {
    failures.push(`  src/data/${file}:${f.line}:${f.column}  console.${f.method}(`);
  }
}

console.log(
  `Loader stdout-safety: scanned ${loaderFiles.length} data loader(s) in src/data/.`,
);

if (failures.length === 0) {
  console.log("No stdout-writing console.* calls found — loaders are safe.");
  process.exit(0);
}

console.error(
  `\n${failures.length} stdout-writing console call(s) found in data loader(s):\n`,
);
for (const f of failures) console.error(f);
console.error(
  [
    "",
    "A data loader's stdout IS the emitted JSON data file (loaders end with",
    "`process.stdout.write(JSON.stringify(...))`). Any console.log/info/debug/…",
    "writes to that same stream and corrupts the JSON — this took production",
    "down in PR #259. Send diagnostics to stderr instead: use console.warn or",
    "console.error (see the correct pattern in src/data/aemo-per-plant.json.ts).",
  ].join("\n"),
);
process.exit(1);
