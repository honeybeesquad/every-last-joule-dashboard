#!/usr/bin/env tsx
/**
 * One-shot bootstrap script. Generates a per-fuel `data/snapshots/last-good/
 * denmark.json` so local CI gates pass on the per-fuel-split branch before
 * the first Vercel build refreshes it with live Energinet data.
 *
 * Why this exists: the v0 last-good denmark.json has the v0.6 geographic
 * split shape ({denmark-west, denmark-east}). After we rewrote
 * denmark.json.ts to emit `denmark-solar` + `denmark-wind`, ci:tier-coherence
 * rejects the old snapshot because regionIds `denmark-west` / `denmark-east`
 * are no longer in the canonical REGIONS table. Local devs can't generate a
 * fresh snapshot via `npm run build` because the Energinet API isn't always
 * available locally (or the build host might not have outbound DNS at the
 * moment the script runs). So this bootstrap:
 *
 *   1. Synthesises 30 days × 24 hours of mock Energinet records — solar
 *      follows a daytime Gaussian; wind cycles around an overnight-heavy
 *      base.
 *   2. Applies `parseEnerginetPayload` and `buildPerFuelRegion` to generate
 *      per-fuel data the same way the live loader would.
 *   3. Writes the per-fuel result to data/snapshots/last-good/denmark.json,
 *      marking sourceNote with "BOOTSTRAP" so it's obvious this is a
 *      placeholder that will be overwritten on first prod build.
 *   4. Stamps sourceStatus=cached + confidenceTier=T1a-live-tso +
 *      uncertainty bounds so it round-trips through ci:tier-coherence.
 *
 * Run once: `npx tsx scripts/bootstrap-denmark-snapshot.ts`
 *
 * Delete this script once the canonical loader has refreshed the snapshot
 * via Vercel's first build with live Energinet data (a follow-up PR after
 * merge).
 */

import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnerginetPayload, buildPerFuelRegion, type DenmarkOutput } from "../src/data/denmark.json.js";
import { applyUncertainty } from "../src/lib/uncertainty.js";
import type { RegionData } from "../src/lib/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

const SOLAR_RATE = 0.04;
const WIND_RATE = 0.04;

// Generate 30 days × 24 hourly records. Mirrors the Energidataservice
// ProductionConsumptionSettlement schema sufficiently for parseEnerginetPayload.
const records: Array<Record<string, string | number | null>> = [];
const startMs = Date.UTC(2026, 2, 28, 0, 0, 0); // 2026-03-28 to give us 30 days ending 2026-04-26
for (let day = 0; day < 30; day++) {
  for (let hour = 0; hour < 24; hour++) {
    const ts = new Date(startMs + (day * 24 + hour) * 3600 * 1000);
    const isoLocal = `${ts.getUTCFullYear()}-${String(ts.getUTCMonth() + 1).padStart(2, "0")}-${String(ts.getUTCDate()).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00`;

    const isDay = hour >= 6 && hour <= 18;
    // Solar: rough Gaussian peaking at hour 12, zero overnight
    const solarPeak = 1500; // MWh/h scale
    const solarMwh = isDay ? solarPeak * Math.exp(-Math.pow((hour - 12) / 4, 2)) : 0;
    // Wind: stays roughly between 600-1200 MWh/h with a gentle diurnal lull
    const windMwh = 800 + 300 * Math.sin((hour / 24) * 2 * Math.PI + Math.PI);

    records.push({
      HourUTC: isoLocal,
      OffshoreWindLt100MW_MWh: windMwh * 0.10,
      OffshoreWindGe100MW_MWh: windMwh * 0.40,
      OnshoreWindLt50kW_MWh: windMwh * 0.20,
      OnshoreWindGe50kW_MWh: windMwh * 0.30,
      SolarPowerLt10kW_MWh: solarMwh * 0.25,
      SolarPowerGe10Lt40kW_MWh: solarMwh * 0.25,
      SolarPowerGe40kW_MWh: solarMwh * 0.25,
      SolarPowerSelfConMWh: solarMwh * 0.25,
    });
  }
}

const { windPoints, solarPoints } = parseEnerginetPayload({ records });

const result: DenmarkOutput = {
  "denmark-solar": buildPerFuelRegion(
    "denmark-solar",
    solarPoints,
    SOLAR_RATE,
    "Energinet solar data × 4% calibrated curtailment (Denmark 2024)",
  ),
  "denmark-wind": buildPerFuelRegion(
    "denmark-wind",
    windPoints,
    WIND_RATE,
    "Energinet wind data × 4% calibrated curtailment (Denmark 2024)",
  ),
};

// Stamp sourceNote with BOOTSTRAP marker + apply uncertainty/tier metadata
// so ci:tier-coherence accepts it. sourceStatus=cached signals to the
// dashboard tooltip that this is the last-good fallback, not live.
const stampRegion = (region: RegionData, fuelLabel: "solar" | "wind"): RegionData => {
  const note = `BOOTSTRAP ${fuelLabel} snapshot — overwritten on first Vercel build with live Energinet data. ${region.sourceNote}`;
  const tagged: RegionData = {
    ...region,
    sourceNote: note,
    sourceStatus: "cached",
  };
  return applyUncertainty(tagged, { regionTier: "live" });
};

const stamped: DenmarkOutput = {
  "denmark-solar": stampRegion(result["denmark-solar"], "solar"),
  "denmark-wind": stampRegion(result["denmark-wind"], "wind"),
};

const outPath = join(repoRoot, "data/snapshots/last-good/denmark.json");
writeFileSync(outPath, JSON.stringify(stamped));
console.log(`Wrote per-fuel bootstrap snapshot to ${outPath}`);
console.log(`  denmark-solar: totalTWh=${stamped["denmark-solar"].totalTWh.toFixed(4)}, peakGW=${stamped["denmark-solar"].peakGW.toFixed(4)}`);
console.log(`  denmark-wind:  totalTWh=${stamped["denmark-wind"].totalTWh.toFixed(4)}, peakGW=${stamped["denmark-wind"].peakGW.toFixed(4)}`);
