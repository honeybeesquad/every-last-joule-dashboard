#!/usr/bin/env tsx
/**
 * DARI paper — Stage 2: Bitcoin × curtailment overlay computation.
 *
 * Produces docs/dari/stage2-figures.json with inputs for F1, F4, F6, F7.
 *
 * Data sources:
 *   - Live regions: data/snapshots/last-good/*.json (totalTWh × 365/30)
 *   - Static regions: src/data/statics.json.ts (annualTWh direct)
 *   - Tier mapping:   scripts/lib/tier-resolution.ts (bucket per region)
 *   - Prices:         data/static-prices.csv (USD/MWh, pre-converted)
 *   - Bitcoin TWh:    WooCharts 197.6 TWh/yr (primary, 2024-07-27)
 *   - Bitcoin TWh:    CBECI 133.5 TWh/yr (cross-check, cbeci.json snapshot)
 *   - Bitcoin intensity: 249.5 g CO₂e/kWh (WooCharts 2024-07-27)
 *   - Global grid avg:   473 g CO₂e/kWh (Ember Global Electricity Review 2025)
 */

import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { resolveAll } from "../lib/tier-resolution.js";
import { buildAllStatics } from "../../src/data/statics.json.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");

// ── 1. Tier-resolved region list ──────────────────────────────────────────────

const { resolved } = resolveAll();

// ── 2. Load all snapshots (30-day totalTWh) ───────────────────────────────────

const SNAP_DIR = join(ROOT, "data", "snapshots", "last-good");

function loadSnapshotDir(): Map<string, number> {
  const map = new Map<string, number>();
  for (const file of readdirSync(SNAP_DIR) as string[]) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = readFileSync(join(SNAP_DIR, file), "utf8");
      const data = JSON.parse(raw);
      if (typeof data === "object" && data !== null) {
        if ("totalTWh" in data && "regionId" in data) {
          // Single-region file
          map.set(data.regionId as string, data.totalTWh as number);
        } else {
          // Multi-region file: each key is a region block
          for (const [, block] of Object.entries(data)) {
            const b = block as Record<string, unknown>;
            if (
              b &&
              typeof b === "object" &&
              "regionId" in b &&
              "totalTWh" in b
            ) {
              map.set(b.regionId as string, b.totalTWh as number);
            }
          }
        }
      }
    } catch {
      // skip malformed snapshots
    }
  }
  return map;
}

const snapshots30d = loadSnapshotDir();

// ── 3. Build statics (totalTWh = annualTWh × 30/365) ─────────────────────────

const staticsBuilt = buildAllStatics();

// annualTWh from statics: reverse the 30/365 scaling
function staticAnnualTWh(id: string): number | undefined {
  const s = staticsBuilt[id];
  if (!s) return undefined;
  // totalTWh = annualTWh * (30/365); reverse
  return (s.totalTWh as number) * (365 / 30);
}

// ── 4. Compute per-region annualTWh ───────────────────────────────────────────

type BucketTotals = Record<string, number>;

const bucketTotals: BucketTotals = {
  T1a: 0,
  T1b: 0,
  T1c: 0,
  T2: 0,
  "T2-flare": 0,
  T3: 0,
};

const regionDetails: Array<{
  id: string;
  name: string;
  bucket: string;
  annualTWh: number;
  source: "snapshot" | "static";
}> = [];

for (const r of resolved) {
  let annualTWh = 0;
  let source: "snapshot" | "static" = "snapshot";

  // Prefer live snapshot (annualise from 30-day window)
  const snap = snapshots30d.get(r.id);
  if (snap !== undefined) {
    annualTWh = snap * (365 / 30);
    source = "snapshot";
  } else {
    // Fall back to statics
    const sa = staticAnnualTWh(r.id);
    if (sa !== undefined) {
      annualTWh = sa;
      source = "static";
    }
  }

  bucketTotals[r.bucket] = (bucketTotals[r.bucket] ?? 0) + annualTWh;
  regionDetails.push({ id: r.id, name: r.name, bucket: r.bucket, annualTWh, source });
}

// Sort by annualTWh desc for top-N lists
regionDetails.sort((a, b) => b.annualTWh - a.annualTWh);

// ── 5. Bitcoin constants ───────────────────────────────────────────────────────

const BITCOIN_TWH_WOOCHARTS = 197.6; // WooCharts gross, 2024-07-27
const BITCOIN_TWH_CBECI = 133.5;     // CBECI annualised, from cbeci.json 2026-05-04
const BITCOIN_INTENSITY_G_PER_KWH = 249.5; // WooCharts network-level, 2024-07-27
const GLOBAL_GRID_INTENSITY_G_PER_KWH = 473; // Ember Global Electricity Review 2025
const RENEWABLE_CURTAILMENT_INTENSITY_G_PER_KWH = 0; // zero-carbon (curtailed RE)
// Flare gas: CH4→CO2 via combustion; net ~40 g CO2e/kWh vs ~1000 g if vented as methane
const FLARE_INTENSITY_G_PER_KWH = 40;

// ── 6. F1: Hero stat ──────────────────────────────────────────────────────────

const t1Verified = bucketTotals.T1a + bucketTotals.T1b + bucketTotals.T1c;
const t2Flare = bucketTotals["T2-flare"];
const t2NonFlare = bucketTotals.T2;
const t3Modelled = bucketTotals.T3;

const verifiedEnvelope = t1Verified + t2Flare;          // conservative: verified + flare
const fullEnvelope = verifiedEnvelope + t2NonFlare;      // + T2 non-flare calibrated
const totalModelled = fullEnvelope + t3Modelled;        // + T3 (all modelled)

const f1WooCharts = {
  bitcoin_twh: BITCOIN_TWH_WOOCHARTS,
  verified_curtailment_twh: t1Verified,
  flare_twh: t2Flare,
  verified_plus_flare_twh: verifiedEnvelope,
  pct_of_bitcoin_verified_only: (t1Verified / BITCOIN_TWH_WOOCHARTS) * 100,
  pct_of_bitcoin_verified_plus_flare: (verifiedEnvelope / BITCOIN_TWH_WOOCHARTS) * 100,
  pct_of_bitcoin_full_envelope: (fullEnvelope / BITCOIN_TWH_WOOCHARTS) * 100,
  pct_of_bitcoin_all_modelled: (totalModelled / BITCOIN_TWH_WOOCHARTS) * 100,
};

const f1CBECI = {
  bitcoin_twh: BITCOIN_TWH_CBECI,
  pct_of_bitcoin_verified_plus_flare: (verifiedEnvelope / BITCOIN_TWH_CBECI) * 100,
  pct_of_bitcoin_all_modelled: (totalModelled / BITCOIN_TWH_CBECI) * 100,
};

// ── 7. F4: Bitcoin vs total wasted energy ─────────────────────────────────────

const f4 = {
  bitcoin_twh_woocharts: BITCOIN_TWH_WOOCHARTS,
  bitcoin_twh_cbeci: BITCOIN_TWH_CBECI,
  t1a_twh: bucketTotals.T1a,
  t1b_twh: bucketTotals.T1b,
  t1c_twh: bucketTotals.T1c,
  t2_flare_twh: bucketTotals["T2-flare"],
  t2_non_flare_twh: bucketTotals.T2,
  t3_modelled_twh: bucketTotals.T3,
  verified_curtailment_twh: t1Verified,
  verified_plus_flare_twh: verifiedEnvelope,
  total_all_tiers_twh: totalModelled,
};

// ── 8. F6: Generator revenue foregone ─────────────────────────────────────────

// Load prices CSV
const pricesCsv = readFileSync(join(ROOT, "data", "static-prices.csv"), "utf8");
const priceLines = pricesCsv.trim().split("\n").slice(1); // skip header
const prices = new Map<string, number>();
for (const line of priceLines) {
  const cols = line.split(",");
  const id = cols[0]?.trim();
  const price = parseFloat(cols[1]?.trim() ?? "NaN");
  if (id && !isNaN(price)) prices.set(id, price);
}

// Revenue = price_USD_per_MWh × annual_TWh × 1_000_000 (convert TWh → MWh, then × 1e-6 for $M)
//         = price × annual_TWh × 1000 ($thousands)  → / 1000 → $M

const revenueByRegion: Array<{
  id: string;
  name: string;
  bucket: string;
  annualTWh: number;
  priceUSDperMWh: number;
  revenueUSDmillion: number;
}> = [];

for (const r of regionDetails) {
  const price = prices.get(r.id);
  if (price === undefined || r.annualTWh === 0) continue;
  // revenue in USD millions: price ($/MWh) × TWh × 1e6 MWh/TWh × 1e-6 ($M/$)
  const revenueUSDmillion = price * r.annualTWh;
  revenueByRegion.push({
    id: r.id,
    name: r.name,
    bucket: r.bucket,
    annualTWh: r.annualTWh,
    priceUSDperMWh: price,
    revenueUSDmillion,
  });
}
revenueByRegion.sort((a, b) => b.revenueUSDmillion - a.revenueUSDmillion);

const totalRevenueUSDmillion = revenueByRegion.reduce(
  (s, r) => s + r.revenueUSDmillion, 0
);

const f6 = {
  total_revenue_foregone_usd_billion: totalRevenueUSDmillion / 1000,
  top15: revenueByRegion.slice(0, 15),
  all_priced_regions: revenueByRegion.length,
};

// ── 9. F7: Carbon counterfactual ─────────────────────────────────────────────

// Bitcoin actual annual emissions (Mt CO₂e)
const bitcoinActualMtCO2e =
  (BITCOIN_TWH_WOOCHARTS * 1e9) * // kWh
  (BITCOIN_INTENSITY_G_PER_KWH / 1e6); // g CO₂e/kWh → t CO₂e

// Curtailment-fed scenario: serve 'verifiedEnvelope' TWh at near-zero intensity,
// remaining Bitcoin demand at global grid average
const curtailmentFed_TWh = verifiedEnvelope;
const remainingGrid_TWh = Math.max(0, BITCOIN_TWH_WOOCHARTS - curtailmentFed_TWh);

const t1SolarWind_TWh = t1Verified;  // curtailed RE at 0 g/kWh
const flareGas_TWh = t2Flare;        // flare gas at 40 g/kWh

const curtailmentScenarioMtCO2e =
  (t1SolarWind_TWh * 1e9 * RENEWABLE_CURTAILMENT_INTENSITY_G_PER_KWH / 1e6) +
  (flareGas_TWh * 1e9 * FLARE_INTENSITY_G_PER_KWH / 1e6) +
  (remainingGrid_TWh * 1e9 * GLOBAL_GRID_INTENSITY_G_PER_KWH / 1e6);

// All-curtailment (theoretical: Bitcoin runs 100% on verified curtailment+flare,
// with RE at 0 g/kWh and flare at 40 g/kWh; only valid if envelope ≥ Bitcoin TWh)
const allCurtailmentMtCO2e =
  (t1SolarWind_TWh * 1e9 * RENEWABLE_CURTAILMENT_INTENSITY_G_PER_KWH / 1e6) +
  (Math.min(t2Flare, BITCOIN_TWH_WOOCHARTS - t1Verified) * 1e9 *
    FLARE_INTENSITY_G_PER_KWH / 1e6);

const f7 = {
  bitcoin_actual_MtCO2e: bitcoinActualMtCO2e / 1e6,    // g → Mt
  bitcoin_actual_intensity_gCO2_per_kWh: BITCOIN_INTENSITY_G_PER_KWH,
  global_grid_average_gCO2_per_kWh: GLOBAL_GRID_INTENSITY_G_PER_KWH,
  curtailment_fed_scenario: {
    description: "Bitcoin demand met by verified curtailment+flare first, then global grid",
    curtailment_twh: curtailmentFed_TWh,
    remaining_grid_twh: remainingGrid_TWh,
    total_MtCO2e: curtailmentScenarioMtCO2e / 1e6,
    pct_reduction_vs_actual:
      ((bitcoinActualMtCO2e - curtailmentScenarioMtCO2e) / bitcoinActualMtCO2e) * 100,
  },
  all_curtailment_scenario: {
    description: "Bitcoin entirely from verified curtailed RE + flare gas (capped at Bitcoin TWh)",
    total_MtCO2e: allCurtailmentMtCO2e / 1e6,
    pct_reduction_vs_actual:
      ((bitcoinActualMtCO2e - allCurtailmentMtCO2e) / bitcoinActualMtCO2e) * 100,
  },
};

// ── 10. Top-20 regions by wasted energy (F3 / F4 input) ──────────────────────

const top20Regions = regionDetails
  .filter(r => r.annualTWh > 0)
  .slice(0, 20)
  .map(r => ({ id: r.id, name: r.name, bucket: r.bucket, annualTWh: r.annualTWh }));

// ── 11. Assemble output ───────────────────────────────────────────────────────

const output = {
  generated: new Date().toISOString(),
  methodology: {
    live_regions_source: "data/snapshots/last-good/*.json — 30-day totalTWh × (365/30) to annualise",
    static_regions_source: "src/data/statics.json.ts — annualTWh direct",
    bitcoin_primary_source: "WooCharts ESG tracker — 197.6 TWh/yr, 2024-07-27 data point",
    bitcoin_crosscheck_source: "CBECI cbeci.json snapshot — 133.5 TWh/yr, 2026-05-04",
    emissions_intensity_source: "WooCharts — 249.5 g CO₂e/kWh network-level, 2024-07-27",
    global_grid_source: "Ember Global Electricity Review 2025 — 473 g CO₂e/kWh",
    flare_intensity_note: "40 g CO₂e/kWh (CH4→CO2 via combustion; vs ~1000 g if vented as methane)",
  },
  bucket_totals_annual_twh: {
    T1a_live_tso: bucketTotals.T1a,
    T1b_live_domestic: bucketTotals.T1b,
    T1c_live_neighbour: bucketTotals.T1c,
    T1_all_verified: t1Verified,
    T2_annual_calibrated: t2NonFlare,
    T2_flare: t2Flare,
    T3_modelled: t3Modelled,
    verified_plus_flare: verifiedEnvelope,
    full_envelope_excl_T3: fullEnvelope,
    grand_total_all_tiers: totalModelled,
  },
  F1_hero_stat: {
    woocharts_primary: f1WooCharts,
    cbeci_crosscheck: f1CBECI,
  },
  F4_bitcoin_vs_wasted: f4,
  F6_revenue_foregone: f6,
  F7_carbon_counterfactual: f7,
  F3_top20_regions: top20Regions,
};

// ── 12. Write output ──────────────────────────────────────────────────────────

const OUT_DIR = join(ROOT, "docs", "dari");
mkdirSync(OUT_DIR, { recursive: true });
const OUT_PATH = join(OUT_DIR, "stage2-figures.json");
writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));
console.log(`Written: ${OUT_PATH}`);
console.log(`\n=== KEY RESULTS ===`);
console.log(`Bitcoin annual TWh (WooCharts): ${BITCOIN_TWH_WOOCHARTS} TWh`);
console.log(`Bitcoin annual TWh (CBECI):     ${BITCOIN_TWH_CBECI} TWh`);
console.log(`\nWasted energy by tier:`);
console.log(`  T1a verified curtailment: ${bucketTotals.T1a.toFixed(1)} TWh/yr`);
console.log(`  T1b verified curtailment: ${bucketTotals.T1b.toFixed(1)} TWh/yr`);
console.log(`  T1c verified curtailment: ${bucketTotals.T1c.toFixed(1)} TWh/yr`);
console.log(`  T2 non-flare calibrated:  ${t2NonFlare.toFixed(1)} TWh/yr`);
console.log(`  T2-flare:                 ${t2Flare.toFixed(1)} TWh/yr`);
console.log(`  T3 modelled:              ${t3Modelled.toFixed(1)} TWh/yr`);
console.log(`  VERIFIED + FLARE total:   ${verifiedEnvelope.toFixed(1)} TWh/yr`);
console.log(`  ALL TIERS total:          ${totalModelled.toFixed(1)} TWh/yr`);
console.log(`\nF1 Hero stat (WooCharts):`);
console.log(`  T1 verified only:          ${f1WooCharts.pct_of_bitcoin_verified_only.toFixed(1)}% of Bitcoin`);
console.log(`  T1 verified + T2-flare:   ${f1WooCharts.pct_of_bitcoin_verified_plus_flare.toFixed(1)}% of Bitcoin`);
console.log(`  Full envelope (+ T2):     ${f1WooCharts.pct_of_bitcoin_full_envelope.toFixed(1)}% of Bitcoin`);
console.log(`  All tiers (+ T3):         ${f1WooCharts.pct_of_bitcoin_all_modelled.toFixed(1)}% of Bitcoin`);
console.log(`\nF6 Revenue foregone: $${(totalRevenueUSDmillion / 1000).toFixed(1)}B/yr (${revenueByRegion.length} priced regions)`);
console.log(`\nF7 Carbon:`);
console.log(`  Bitcoin actual: ${(f7.bitcoin_actual_MtCO2e).toFixed(1)} Mt CO₂e/yr`);
console.log(`  Curtailment-fed scenario: ${f7.curtailment_fed_scenario.total_MtCO2e.toFixed(1)} Mt CO₂e/yr`);
console.log(`  Reduction: ${f7.curtailment_fed_scenario.pct_reduction_vs_actual.toFixed(1)}%`);
