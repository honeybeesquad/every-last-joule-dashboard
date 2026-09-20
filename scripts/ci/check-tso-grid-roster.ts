#!/usr/bin/env tsx
/**
 * Living TSO-grid roster must stay in sync with REGIONS + the extra operator
 * overlay. Region ids named on a row must exist. live-tso / relay-tso is a
 * collect claim, not a waste T1a promotion.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { REGIONS } from "../../src/lib/regions.js";
import {
  buildTsoGridRoster,
  rosterToCsv,
  TSO_GRID_ROSTER_COLUMNS,
} from "../../src/lib/tso-grid-roster.js";

const CSV_PATH = join(process.cwd(), "data", "coverage-audit", "tso-grid-roster.csv");
const known = new Set(REGIONS.map((r) => r.id));
const failures: string[] = [];

const expected = rosterToCsv(buildTsoGridRoster());
const actual = readFileSync(CSV_PATH, "utf8");
if (actual !== expected) {
  failures.push(
    `${CSV_PATH} is stale — run \`npx tsx scripts/build-tso-grid-roster.ts\` and commit the CSV with the roster source.`,
  );
}

const header = actual.trim().split("\n")[0]?.split(",") ?? [];
for (const col of TSO_GRID_ROSTER_COLUMNS) {
  if (!header.includes(col)) failures.push(`roster CSV missing column ${col}`);
}

for (const row of buildTsoGridRoster()) {
  if (!row.regionIds) continue;
  for (const id of row.regionIds.split(";")) {
    if (id && !known.has(id)) {
      failures.push(`roster names unknown region id "${id}" (operator ${row.operator})`);
    }
  }
}

const collectClaims = buildTsoGridRoster().filter(
  (r) => r.collectStatus === "live-tso" || r.collectStatus === "relay-tso",
);
if (collectClaims.length < 50) {
  failures.push(`expected many live-tso/relay-tso rows, found ${collectClaims.length}`);
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`tso-grid-roster ok: ${buildTsoGridRoster().length} rows, ${collectClaims.length} collect claims`);
