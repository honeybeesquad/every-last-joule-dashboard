#!/usr/bin/env tsx
/**
 * One-shot bootstrap script. Generates a per-fuel `data/snapshots/last-good/
 * caiso.json` so local CI gates pass on the per-fuel-split branch before
 * the first Vercel build refreshes it with live EIA data.
 *
 * Why this exists: the v0 last-good caiso.json has a single `regionId:
 * "caiso"` record (the blended-bug shape). After we rewrote caiso.json.ts
 * to emit `caiso-solar` + `caiso-wind`, ci:tier-coherence rejects the old
 * snapshot because regionId `caiso` is no longer in the canonical REGIONS
 * table. Local devs can't generate a fresh snapshot via `npm run build`
 * because EIA_API_KEY is only set in Vercel env. So this bootstrap:
 *
 *   1. Reads tests/fixtures/caiso-eia-solar.json (real CAISO EIA solar
 *      data) and applies parseCaiso's 4.25% solar rate.
 *   2. Synthesises a flat 1500 MW wind generation series (the same one
 *      used by the test suite — see tests/data/caiso.test.ts).
 *   3. Writes the per-fuel result to data/snapshots/last-good/caiso.json,
 *      marking sourceNote with "BOOTSTRAP" so it's obvious this is a
 *      placeholder that will be overwritten on first prod build.
 *   4. Stamps sourceStatus=cached + confidenceTier=T1a-live-tso +
 *      uncertainty bounds so it round-trips through ci:tier-coherence.
 *
 * Run once: `npx tsx scripts/bootstrap-caiso-snapshot.ts`
 *
 * Delete this script once the canonical loader has refreshed the snapshot
 * via Vercel's first build with EIA_API_KEY (a follow-up PR after merge).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCaiso } from "../src/data/caiso.json.js";
import { applyUncertainty } from "../src/lib/uncertainty.js";
import type { RegionData } from "../src/lib/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

interface EIAResponse {
  response: {
    total: string | number;
    data: Array<{
      period: string;
      respondent: string;
      fueltype: string;
      value: string;
    }>;
  };
}

const solarFixturePath = join(repoRoot, "tests/fixtures/caiso-eia-solar.json");
const solarFixture = JSON.parse(readFileSync(solarFixturePath, "utf8")) as EIAResponse;

// Build a 30-day flat 1500 MWh/hr wind series, end-aligned with the solar
// fixture's last period. The same shape the test suite uses, scaled to
// 30 days so totalTWh30d returns a non-trivial figure.
const solarPeriods = solarFixture.response.data.map((r) => r.period);
const lastPeriod = solarPeriods.at(-1);
if (!lastPeriod) {
  throw new Error("solar fixture has no periods");
}

// Extract every distinct hour from the solar fixture; reuse the same
// timestamp grid for the synthetic wind series so they align.
const distinctPeriods = Array.from(new Set(solarPeriods)).sort();
const windFixture: EIAResponse = {
  response: {
    total: distinctPeriods.length,
    data: distinctPeriods.map((period) => ({
      period,
      respondent: "CISO",
      fueltype: "WND",
      value: "1500", // 1500 MWh/hr — typical CAISO wind generation midpoint
    })),
  },
};

const result = parseCaiso(solarFixture, windFixture);

// Stamp sourceNote with BOOTSTRAP marker + apply uncertainty/tier metadata
// so ci:tier-coherence accepts it. sourceStatus=cached signals to the
// dashboard tooltip that this is the last-good fallback, not live.
const stampRegion = (region: RegionData, fuelLabel: "solar" | "wind"): RegionData => {
  const note = `BOOTSTRAP ${fuelLabel} snapshot — overwritten on first Vercel build with EIA_API_KEY. ${region.sourceNote}`;
  const tagged: RegionData = {
    ...region,
    sourceNote: note,
    sourceStatus: "cached",
  };
  return applyUncertainty(tagged, { regionTier: "live" });
};

const stamped = {
  "caiso-solar": stampRegion(result["caiso-solar"], "solar"),
  "caiso-wind": stampRegion(result["caiso-wind"], "wind"),
};

const outPath = join(repoRoot, "data/snapshots/last-good/caiso.json");
writeFileSync(outPath, JSON.stringify(stamped));
console.log(`Wrote per-fuel bootstrap snapshot to ${outPath}`);
console.log(`  caiso-solar: totalTWh=${stamped["caiso-solar"].totalTWh.toFixed(4)}, peakGW=${stamped["caiso-solar"].peakGW.toFixed(4)}`);
console.log(`  caiso-wind:  totalTWh=${stamped["caiso-wind"].totalTWh.toFixed(4)}, peakGW=${stamped["caiso-wind"].peakGW.toFixed(4)}`);
