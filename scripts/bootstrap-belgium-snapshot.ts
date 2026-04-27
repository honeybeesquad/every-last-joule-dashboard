#!/usr/bin/env tsx
/**
 * One-shot bootstrap script. Generates a per-fuel `data/snapshots/last-good/
 * belgium.json` so local CI gates pass on the per-fuel-split branch before
 * the first Vercel build refreshes it with live Elia data.
 *
 * Why this exists: the v0 last-good belgium.json has a single `regionId:
 * "belgium"` record (the blended-bug shape). After we rewrote belgium.json.ts
 * to emit `belgium-solar` + `belgium-wind`, ci:tier-coherence rejects the old
 * snapshot because regionId `belgium` is no longer in the canonical REGIONS
 * table. Local devs can't generate a fresh snapshot via `npm run build`
 * because Elia data isn't always available locally (or requires specific setup).
 * So this bootstrap:
 *
 *   1. Uses mock wind and solar CSV data (similar to the test suite).
 *   2. Applies `parseEliaCsv` and `buildPerFuelRegion` to generate per-fuel data.
 *   3. Writes the per-fuel result to data/snapshots/last-good/belgium.json,
 *      marking sourceNote with "BOOTSTRAP" so it's obvious this is a
 *      placeholder that will be overwritten on first prod build.
 *   4. Stamps sourceStatus=cached + confidenceTier=T1a-live-tso +
 *      uncertainty bounds so it round-trips through ci:tier-coherence.
 *
 * Run once: `npx tsx scripts/bootstrap-belgium-snapshot.ts`
 *
 * Delete this script once the canonical loader has refreshed the snapshot
 * via Vercel's first build with live Elia data (a follow-up PR after merge).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEliaCsv, buildPerFuelRegion, BelgiumOutput } from "../src/data/belgium.json.js";
import { applyUncertainty } from "../src/lib/uncertainty.js";
import type { RegionData } from "../src/lib/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

// Mock CSV data for solar (values representing daytime generation)
const MOCK_SOLAR_CSV = `datetime;realtime;mostrecentforecast
2026-04-26T00:00:00.000Z;0;0
2026-04-26T01:00:00.000Z;0;0
2026-04-26T02:00:00.000Z;0;0
2026-04-26T03:00:00.000Z;0;0
2026-04-26T04:00:00.000Z;100;100
2026-04-26T05:00:00.000Z;500;500
2026-04-26T06:00:00.000Z;1000;1000
2026-04-26T07:00:00.000Z;1500;1500
2026-04-26T08:00:00.000Z;2000;2000
2026-04-26T09:00:00.000Z;2500;2500
2026-04-26T10:00:00.000Z;2800;2800
2026-04-26T11:00:00.000Z;3000;3000
2026-04-26T12:00:00.000Z;2900;2900
2026-04-26T13:00:00.000Z;2500;2500
2026-04-26T14:00:00.000Z;2000;2000
2026-04-26T15:00:00.000Z;1500;1500
2026-04-26T16:00:00.000Z;1000;1000
2026-04-26T17:00:00.000Z;500;500
2026-04-26T18:00:00.000Z;100;100
2026-04-26T19:00:00.000Z;0;0
2026-04-26T20:00:00.000Z;0;0
2026-04-26T21:00:00.000Z;0;0
2026-04-26T22:00:00.000Z;0;0
2026-04-26T23:00:00.000Z;0;0
`;

// Mock CSV data for wind (values representing consistent generation, including overnight)
const MOCK_WIND_CSV = `datetime;realtime;mostrecentforecast
2026-04-26T00:00:00.000Z;800;800
2026-04-26T01:00:00.000Z;850;850
2026-04-26T02:00:00.000Z;900;900
2026-04-26T03:00:00.000Z;920;920
2026-04-26T04:00:00.000Z;900;900
2026-04-26T05:00:00.000Z;880;880
2026-04-26T06:00:00.000Z;850;850
2026-04-26T07:00:00.000Z;800;800
2026-04-26T08:00:00.000Z;750;750
2026-04-26T09:00:00.000Z;700;700
2026-04-26T10:00:00.000Z;650;650
2026-04-26T11:00:00.000Z;600;600
2026-04-26T12:00:00.000Z;550;550
2026-04-26T13:00:00.000Z;500;500
2026-04-26T14:00:00.000Z;450;450
2026-04-26T15:00:00.000Z;400;400
2026-04-26T16:00:00.000Z;350;350
2026-04-26T17:00:00.000Z;300;300
2026-04-26T18:00:00.000Z;350;350
2026-04-26T19:00:00.000Z;400;400
2026-04-26T20:00:00.000Z;500;500
2026-04-26T21:00:00.000Z;600;600
2026-04-26T22:00:00.000Z;700;700
2026-04-26T23:00:00.000Z;750;750
`;

const SOLAR_RATE = 0.02;
const WIND_RATE = 0.02;

const windPoints = parseEliaCsv(MOCK_WIND_CSV);
const solarPoints = parseEliaCsv(MOCK_SOLAR_CSV);

const result: BelgiumOutput = {
  "belgium-solar": buildPerFuelRegion(
    "belgium-solar",
    solarPoints,
    SOLAR_RATE,
    "Elia solar realtime CSV × 2% calibrated curtailment (Belgium 2024)",
  ),
  "belgium-wind": buildPerFuelRegion(
    "belgium-wind",
    windPoints,
    WIND_RATE,
    "Elia wind realtime CSV × 2% calibrated curtailment (Belgium 2024)",
  ),
};

// Stamp sourceNote with BOOTSTRAP marker + apply uncertainty/tier metadata
// so ci:tier-coherence accepts it. sourceStatus=cached signals to the
// dashboard tooltip that this is the last-good fallback, not live.
const stampRegion = (region: RegionData, fuelLabel: "solar" | "wind"): RegionData => {
  const note = `BOOTSTRAP ${fuelLabel} snapshot — overwritten on first Vercel build with live Elia data. ${region.sourceNote}`;
  const tagged: RegionData = {
    ...region,
    sourceNote: note,
    sourceStatus: "cached",
  };
  return applyUncertainty(tagged, { regionTier: "live" });
};

const stamped: BelgiumOutput = {
  "belgium-solar": stampRegion(result["belgium-solar"], "solar"),
  "belgium-wind": stampRegion(result["belgium-wind"], "wind"),
};

const outPath = join(repoRoot, "data/snapshots/last-good/belgium.json");
writeFileSync(outPath, JSON.stringify(stamped));
console.log(`Wrote per-fuel bootstrap snapshot to ${outPath}`);
console.log(`  belgium-solar: totalTWh=${stamped["belgium-solar"].totalTWh.toFixed(4)}, peakGW=${stamped["belgium-solar"].peakGW.toFixed(4)}`);
console.log(`  belgium-wind:  totalTWh=${stamped["belgium-wind"].totalTWh.toFixed(4)}, peakGW=${stamped["belgium-wind"].peakGW.toFixed(4)}`);
