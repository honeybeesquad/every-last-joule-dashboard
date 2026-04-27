#!/usr/bin/env tsx
/**
 * One-shot bootstrap script. Generates a per-fuel `data/snapshots/last-good/
 * alberta.json` so local CI gates pass on the per-fuel-split branch before
 * the first Vercel build refreshes it with live AESO CSD data.
 *
 * Why this exists: the v0 last-good alberta.json has a single `regionId:
 * "alberta"` record (the blended-bug shape). After we rewrote
 * alberta.json.ts to emit `alberta-solar` + `alberta-wind`, ci:tier-coherence
 * rejects the old snapshot because regionId `alberta` is no longer in the
 * canonical REGIONS table. Local devs can't always regenerate via
 * `npm run build` because the AESO CSD endpoint is HTTP-only and
 * sometimes blocked from arbitrary networks (and the response body shape
 * changes infrequently but unpredictably).
 *
 * What it does:
 *   1. Reads the committed AESO CSD HTML fixture
 *      (tests/fixtures/alberta-sample.html) — same fixture exercised by
 *      the unit tests, so the bootstrap is reproducible across machines.
 *   2. Calls `parseAesoCurrentReport` and `buildPerFuelRegion` to generate
 *      per-fuel data the same way the live loader would.
 *   3. Writes the per-fuel result to data/snapshots/last-good/alberta.json,
 *      marking sourceNote with "BOOTSTRAP" so it's obvious this is a
 *      placeholder that will be overwritten on first prod build.
 *   4. Stamps sourceStatus=cached + confidenceTier=T1a-live-tso +
 *      uncertainty bounds so it round-trips through ci:tier-coherence.
 *
 * Run once: `npx tsx scripts/bootstrap-alberta-snapshot.ts`
 *
 * Delete this script once the canonical loader has refreshed the snapshot
 * via Vercel's first build with live AESO CSD data.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAesoCurrentReport, buildPerFuelRegion, type AlbertaOutput } from "../src/data/alberta.json.js";
import { applyUncertainty } from "../src/lib/uncertainty.js";
import type { RegionData } from "../src/lib/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

const SOLAR_RATE = 0.05;
const WIND_RATE = 0.05;

const fixturePath = join(repoRoot, "tests/fixtures/alberta-sample.html");
const html = readFileSync(fixturePath, "utf8");
const snapshot = parseAesoCurrentReport(html);
const endIso = new Date("2026-04-26T18:00:00Z").toISOString();

const result: AlbertaOutput = {
  "alberta-solar": buildPerFuelRegion(
    "alberta-solar",
    snapshot.solarMw,
    SOLAR_RATE,
    endIso,
    `AESO Current Supply Demand solar snapshot × 5% calibrated curtailment proxy (snapshot ${snapshot.lastUpdated})`,
  ),
  "alberta-wind": buildPerFuelRegion(
    "alberta-wind",
    snapshot.windMw,
    WIND_RATE,
    endIso,
    `AESO Current Supply Demand wind snapshot × 5% calibrated curtailment proxy (snapshot ${snapshot.lastUpdated})`,
  ),
};

// Stamp sourceNote with BOOTSTRAP marker + apply uncertainty/tier metadata
// so ci:tier-coherence accepts it. sourceStatus=cached signals to the
// dashboard tooltip that this is the last-good fallback, not live.
const stampRegion = (region: RegionData, fuelLabel: "solar" | "wind"): RegionData => {
  const note = `BOOTSTRAP ${fuelLabel} snapshot — overwritten on first Vercel build with live AESO CSD data. ${region.sourceNote}`;
  const tagged: RegionData = {
    ...region,
    sourceNote: note,
    sourceStatus: "cached",
  };
  return applyUncertainty(tagged, { regionTier: "live" });
};

const stamped: AlbertaOutput = {
  "alberta-solar": stampRegion(result["alberta-solar"], "solar"),
  "alberta-wind": stampRegion(result["alberta-wind"], "wind"),
};

const outPath = join(repoRoot, "data/snapshots/last-good/alberta.json");
writeFileSync(outPath, JSON.stringify(stamped));
console.log(`Wrote per-fuel bootstrap snapshot to ${outPath}`);
console.log(`  alberta-solar: totalTWh=${stamped["alberta-solar"].totalTWh.toFixed(4)}, peakGW=${stamped["alberta-solar"].peakGW.toFixed(4)}`);
console.log(`  alberta-wind:  totalTWh=${stamped["alberta-wind"].totalTWh.toFixed(4)}, peakGW=${stamped["alberta-wind"].peakGW.toFixed(4)}`);
