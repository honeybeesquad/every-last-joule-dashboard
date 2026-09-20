#!/usr/bin/env tsx
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildTsoGridRoster, rosterToCsv } from "../src/lib/tso-grid-roster.js";

const out = join(process.cwd(), "data", "coverage-audit", "tso-grid-roster.csv");
mkdirSync(join(process.cwd(), "data", "coverage-audit"), { recursive: true });
writeFileSync(out, rosterToCsv(buildTsoGridRoster()), "utf8");
console.log(`wrote ${out} (${buildTsoGridRoster().length} rows)`);
