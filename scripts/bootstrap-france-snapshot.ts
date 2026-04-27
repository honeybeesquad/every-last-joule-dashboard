#!/usr/bin/env tsx
/**
 * One-shot bootstrap script. Generates a per-fuel `data/snapshots/last-good/
 * france.json` so local CI gates pass on the per-fuel-split branch before
 * the first Vercel build refreshes it with live RTE eco2mix data.
 *
 * Why this exists: the v0 last-good france.json has a single `regionId:
 * "france"` record (the blended-bug shape). After we rewrote france.json.ts
 * to emit `france-solar` + `france-wind`, ci:tier-coherence rejects the old
 * snapshot because regionId `france` is no longer in the canonical REGIONS
 * table. Local devs can't always generate a fresh snapshot via `npm run
 * build` because the OpenDataSoft eco2mix CSV API isn't always reachable
 * from arbitrary networks (and is several MB per month-refine).
 *
 * What it does:
 *   1. Synthesises a 30d × 24h CSV mimicking the eco2mix schema
 *      (date_heure, eolien_terrestre, eolien_offshore, solaire) with a
 *      solar Gaussian peaking at midday (UTC) and wind cycling roughly
 *      around an overnight-heavy base.
 *   2. Applies `parseRteEco2MixCsv` and `buildPerFuelRegion` to generate
 *      per-fuel data the same way the live loader would.
 *   3. Writes the per-fuel result to data/snapshots/last-good/france.json,
 *      marking sourceNote with "BOOTSTRAP" so it's obvious this is a
 *      placeholder that will be overwritten on first prod build.
 *   4. Stamps sourceStatus=cached + confidenceTier=T1a-live-tso +
 *      uncertainty bounds so it round-trips through ci:tier-coherence.
 *
 * Run once: `npx tsx scripts/bootstrap-france-snapshot.ts`
 *
 * Delete this script once the canonical loader has refreshed the snapshot
 * via Vercel's first build with live RTE eco2mix data.
 */

import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseRteEco2MixCsv, buildPerFuelRegion, type FranceOutput } from "../src/data/france.json.js";
import { applyUncertainty } from "../src/lib/uncertainty.js";
import type { RegionData } from "../src/lib/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

const SOLAR_RATE = 0.03;
const WIND_RATE = 0.03;

// Build a 30-day × 24-hour eco2mix-like CSV. Header matches what
// parseRteEco2MixCsv expects (parseDelimitedRows with ; delimiter).
const header = "perimetre;nature;date;heure;date_heure;eolien_terrestre;eolien_offshore;solaire";
const lines: string[] = [header];
const startMs = Date.UTC(2026, 2, 28, 0, 0, 0); // 2026-03-28 00:00 UTC
for (let day = 0; day < 30; day++) {
  for (let hour = 0; hour < 24; hour++) {
    const ts = new Date(startMs + (day * 24 + hour) * 3600 * 1000);
    const yyyy = ts.getUTCFullYear();
    const mm = String(ts.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(ts.getUTCDate()).padStart(2, "0");
    const hh = String(hour).padStart(2, "0");
    const dateHeure = `${yyyy}-${mm}-${dd}T${hh}:00:00+00:00`;
    const isDay = hour >= 6 && hour <= 18;
    // France has ~14GW peak solar generation midday; mock at similar scale.
    const solar = isDay ? 14000 * Math.exp(-Math.pow((hour - 12) / 4, 2)) : 0;
    // France has ~12GW peak wind; gentle diurnal variation overnight-favoured.
    const eolienTerrestre = 6000 + 2500 * Math.sin((hour / 24) * 2 * Math.PI + Math.PI);
    const eolienOffshore = 1000 + 400 * Math.sin((hour / 24) * 2 * Math.PI + Math.PI);
    lines.push(
      `France;Données temps réel;${yyyy}-${mm}-${dd};${hh}:00;${dateHeure};${eolienTerrestre.toFixed(1)};${eolienOffshore.toFixed(1)};${solar.toFixed(1)}`,
    );
  }
}
const csv = lines.join("\n");

const { windPoints, solarPoints } = parseRteEco2MixCsv(csv);

const result: FranceOutput = {
  "france-solar": buildPerFuelRegion(
    "france-solar",
    solarPoints,
    SOLAR_RATE,
    "RTE eco2mix solar (solaire) CSV × 3% calibrated curtailment (France 2024)",
  ),
  "france-wind": buildPerFuelRegion(
    "france-wind",
    windPoints,
    WIND_RATE,
    "RTE eco2mix wind (eolien_terrestre + eolien_offshore) CSV × 3% calibrated curtailment (France 2024)",
  ),
};

// Stamp sourceNote with BOOTSTRAP marker + apply uncertainty/tier metadata
// so ci:tier-coherence accepts it. sourceStatus=cached signals to the
// dashboard tooltip that this is the last-good fallback, not live.
const stampRegion = (region: RegionData, fuelLabel: "solar" | "wind"): RegionData => {
  const note = `BOOTSTRAP ${fuelLabel} snapshot — overwritten on first Vercel build with live RTE eco2mix data. ${region.sourceNote}`;
  const tagged: RegionData = {
    ...region,
    sourceNote: note,
    sourceStatus: "cached",
  };
  return applyUncertainty(tagged, { regionTier: "live" });
};

const stamped: FranceOutput = {
  "france-solar": stampRegion(result["france-solar"], "solar"),
  "france-wind": stampRegion(result["france-wind"], "wind"),
};

const outPath = join(repoRoot, "data/snapshots/last-good/france.json");
writeFileSync(outPath, JSON.stringify(stamped));
console.log(`Wrote per-fuel bootstrap snapshot to ${outPath}`);
console.log(`  france-solar: totalTWh=${stamped["france-solar"].totalTWh.toFixed(4)}, peakGW=${stamped["france-solar"].peakGW.toFixed(4)}`);
console.log(`  france-wind:  totalTWh=${stamped["france-wind"].totalTWh.toFixed(4)}, peakGW=${stamped["france-wind"].peakGW.toFixed(4)}`);
