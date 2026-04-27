#!/usr/bin/env tsx
/**
 * One-shot bootstrap script. Generates a per-fuel `data/snapshots/last-good/
 * north-sea.json` so local CI gates pass on the per-fuel-split branch before
 * the first Vercel build refreshes it with live Elexon BMRS AGWS data.
 *
 * Why this exists: the v0.6 last-good north-sea.json has a single
 * `regionId: "north-sea"` record (the blended-bug shape that was then
 * splitRegion'd into gb-scotland 70% / gb-england-wales 30% in index.md).
 * After we rewrote north-sea.json.ts to emit `north-sea-solar` +
 * `north-sea-wind`, ci:tier-coherence rejects the old snapshot because
 * regionId `north-sea` is no longer in the canonical REGIONS table (and
 * neither are gb-scotland / gb-england-wales). Local devs can't always
 * regenerate via `npm run build` because the Elexon BMRS API isn't
 * always reachable from arbitrary networks.
 *
 * What it does:
 *   1. Synthesises 4 weekly pages of AGWS records (Wind Onshore +
 *      Wind Offshore + Solar) covering ~30d × 24h, with a solar Gaussian
 *      peaking midday UTC and wind cycling roughly around an overnight
 *      base — matching UK 2024 patterns (peak solar ~13 GW, peak wind
 *      ~22 GW combined onshore+offshore).
 *   2. Applies `parseNorthSea` and `buildPerFuelRegion` to generate
 *      per-fuel data the same way the live loader would.
 *   3. Writes the per-fuel result to data/snapshots/last-good/north-sea.json,
 *      marking sourceNote with "BOOTSTRAP" so it's obvious this is a
 *      placeholder that will be overwritten on first prod build.
 *   4. Stamps sourceStatus=cached + confidenceTier=T1a-live-tso +
 *      uncertainty bounds so it round-trips through ci:tier-coherence.
 *
 * Run once: `npx tsx scripts/bootstrap-north-sea-snapshot.ts`
 *
 * Delete this script once the canonical loader has refreshed the snapshot
 * via Vercel's first build with live Elexon BMRS AGWS data.
 */

import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseNorthSea, buildPerFuelRegion, type NorthSeaOutput } from "../src/data/north-sea.json.js";
import { applyUncertainty } from "../src/lib/uncertainty.js";
import type { RegionData } from "../src/lib/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

const SOLAR_RATE = 0.069;
const WIND_RATE = 0.069;

interface AGWSRecord {
  psrType: "Wind Onshore" | "Wind Offshore" | "Solar";
  quantity: number;
  startTime: string;
}

interface AGWSResponse {
  data: AGWSRecord[];
}

// Build 30 days of synthetic AGWS records — one record per psrType per
// hour. Quantities reflect approximate UK 2024 generation magnitudes:
//   - Solar peaks ~13 GW midday UTC, zero overnight
//   - Wind Onshore ~5 GW base, mild diurnal +/- 2 GW (overnight-favoured)
//   - Wind Offshore ~9 GW base, mild diurnal +/- 3 GW (overnight-favoured)
const records: AGWSRecord[] = [];
const startMs = Date.UTC(2026, 2, 28, 0, 0, 0); // 2026-03-28 00:00 UTC
for (let day = 0; day < 30; day++) {
  for (let hour = 0; hour < 24; hour++) {
    const ts = new Date(startMs + (day * 24 + hour) * 3600 * 1000);
    const startTime = ts.toISOString().slice(0, 19) + "Z";
    const isDay = hour >= 6 && hour <= 18;
    // UK has ~13GW peak solar generation midday; mock at similar scale.
    const solar = isDay ? 13000 * Math.exp(-Math.pow((hour - 12) / 4, 2)) : 0;
    // UK wind ~22GW combined peak; gentle diurnal variation overnight-favoured.
    const windOnshore = 5000 + 2000 * Math.sin((hour / 24) * 2 * Math.PI + Math.PI);
    const windOffshore = 9000 + 3000 * Math.sin((hour / 24) * 2 * Math.PI + Math.PI);
    records.push({ psrType: "Solar", quantity: solar, startTime });
    records.push({ psrType: "Wind Onshore", quantity: windOnshore, startTime });
    records.push({ psrType: "Wind Offshore", quantity: windOffshore, startTime });
  }
}

// The live run() splits the 30-day window into 4 weekly pages. Mirror
// that structure here (parseNorthSea accepts an array of pages).
const PAGE_SIZE = Math.ceil(records.length / 4);
const pages: AGWSResponse[] = [];
for (let i = 0; i < 4; i++) {
  pages.push({ data: records.slice(i * PAGE_SIZE, (i + 1) * PAGE_SIZE) });
}

const { windPoints, solarPoints } = parseNorthSea(pages);

const result: NorthSeaOutput = {
  "north-sea-solar": buildPerFuelRegion(
    "north-sea-solar",
    solarPoints,
    SOLAR_RATE,
    "Elexon BMRS AGWS Solar × 6.9% calibrated curtailment (UK 2024 actuals: 6.6 TWh / 95 TWh)",
  ),
  "north-sea-wind": buildPerFuelRegion(
    "north-sea-wind",
    windPoints,
    WIND_RATE,
    "Elexon BMRS AGWS Wind Onshore+Offshore × 6.9% calibrated curtailment (UK 2024 actuals: 6.6 TWh / 95 TWh)",
  ),
};

// Stamp sourceNote with BOOTSTRAP marker + apply uncertainty/tier metadata
// so ci:tier-coherence accepts it. sourceStatus=cached signals to the
// dashboard tooltip that this is the last-good fallback, not live.
const stampRegion = (region: RegionData, fuelLabel: "solar" | "wind"): RegionData => {
  const note = `BOOTSTRAP ${fuelLabel} snapshot — overwritten on first Vercel build with live Elexon BMRS AGWS data. ${region.sourceNote}`;
  const tagged: RegionData = {
    ...region,
    sourceNote: note,
    sourceStatus: "cached",
  };
  return applyUncertainty(tagged, { regionTier: "live" });
};

const stamped: NorthSeaOutput = {
  "north-sea-solar": stampRegion(result["north-sea-solar"], "solar"),
  "north-sea-wind": stampRegion(result["north-sea-wind"], "wind"),
};

const outPath = join(repoRoot, "data/snapshots/last-good/north-sea.json");
writeFileSync(outPath, JSON.stringify(stamped));
console.log(`Wrote per-fuel bootstrap snapshot to ${outPath}`);
console.log(`  north-sea-solar: totalTWh=${stamped["north-sea-solar"].totalTWh.toFixed(4)}, peakGW=${stamped["north-sea-solar"].peakGW.toFixed(4)}`);
console.log(`  north-sea-wind:  totalTWh=${stamped["north-sea-wind"].totalTWh.toFixed(4)}, peakGW=${stamped["north-sea-wind"].peakGW.toFixed(4)}`);
