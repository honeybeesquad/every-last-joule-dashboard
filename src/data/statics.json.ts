import type { RegionData } from "../lib/types.js";
import {
  solarProfile,
  windProfile,
  hydroSeasonalProfile,
  seasonalScaleFactor,
  HYDRO_SEASONAL_SHARES,
} from "../lib/typical-profiles.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import { coerceLastSuccessAt } from "../lib/freshness.js";
import { REGIONS } from "../lib/regions.js";
import { stampRegionSourceProvenance } from "../lib/source-provenance.js";
import { pathToFileURL } from "url";

/**
 * StaticSpec profile kinds. Drives the diurnal-profile builder selected in
 * `buildStaticRegion`. Tier routing is determined by the region's canonical
 * `tier` field in regions.ts (anchored → T2, estimated → T3).
 */
type ProfileKind = "solar" | "wind" | "hydro" | "mixed" | "hydro-seasonal";

interface StaticSpec {
  annualTWh: number;
  source: string;
  reportDate: string;
  /** Profile shape. Drives both the diurnal-shape generator and (for the
   *  uncertainty engine) the confidenceTier landing — see `applyUncertainty`
   *  in `src/lib/uncertainty.ts::deriveTier` for the static→tier rules.
   *
   *   "solar"           cos-shape centred on local noon. Requires
   *                     `localSolarPeakUTC`. Routes to T3-modelled (±40%).
   *   "wind"            weak diurnal shape (overnight bias). Requires
   *                     `localSolarPeakUTC` to set the trough/peak phase.
   *                     Routes to T3-modelled (±40%).
   *   "hydro"           flat 24/7 profile (hydro is monthly-seasonal, not
   *                     hourly) but routes to T3-modelled (±40%) because
   *                     the choice of "flat-as-typical" is itself a
   *                     modelling assumption when no curated seasonal-share
   *                     array is available for the basin.
   *   "mixed"           flat 24/7 profile when fuel mix is genuinely
   *                     indeterminate; `buildTypicalMixedRegion` is reserved
   *                     for the fuel-share-known case. Routes to T3-modelled
   *                     (±40%).
   *   "hydro-seasonal"  monthly share array × flat diurnal. Requires
   *                     `seasonalSharesKey`. Routes to T3-modelled (±40%).
   */
  kind?: ProfileKind;
  /** UTC hour of local solar noon, for "solar" or "wind" kind. */
  localSolarPeakUTC?: number;
  /** Key into HYDRO_SEASONAL_SHARES for "hydro-seasonal" kind. */
  seasonalSharesKey?: keyof typeof HYDRO_SEASONAL_SHARES;
}

// Values sourced from research/energy_arithmetic.md in the book project.
// See docs/data-source-log.md for per-source notes.
// Flare volumes converted from bcm/yr to electrical-equivalent TWh/yr at
// 35% generation efficiency (matches Crusoe-style reciprocating engines):
//   1 bcm natural gas ≈ 10.55 TWh thermal × 0.35 ≈ 3.7 TWh electrical-equiv
//
// Shape choice per region:
// - Hydro and geothermal (Sichuan, Iceland) stay flat - their waste is
//   monthly-seasonal (wet-season reservoir spill) rather than diurnal.
// - Solar curtailment regions without a public hourly feed (Xinjiang) use a
//   typical-shape profile centred on local solar noon, scaled to the
//   published annual total. See docs/known-limitations.md for labelling.
//   The flat profile is methodologically correct, not a data gap.
const STATIC_REGIONS: Record<string, StaticSpec> = {
  sichuan: { annualTWh: 30, kind: "hydro-seasonal", seasonalSharesKey: "sichuan", source: "Ember China Electricity Review 2025 (Yangtze basin monsoon hydro spill, peaks Jul-Aug, ~zero Nov-Apr)", reportDate: "2025-Q1" },
  // xinjiang moved to src/data/xinjiang.json.ts (fuel-split: wind + solar, 2026-06-16)
  // china-hebei moved to src/data/china-hebei.json.ts (fuel-split: wind + solar, 2026-06-16)
  // china-heilongjiang moved to src/data/china-heilongjiang.json.ts (fuel-split: wind + solar, 2026-06-16)
  // china-jilin moved to src/data/china-jilin.json.ts (fuel-split: wind + solar, 2026-06-16)
  iceland: { annualTWh: 5.3, kind: "hydro-seasonal", seasonalSharesKey: "iceland", source: "Orkustofnun - Icelandic National Energy Authority (glacial-melt + snowmelt, peaks May-Aug)", reportDate: "2024" },
  // norway-no5 reverted live→estimated 2026-06-07: Statnett does not publish
  // per-zone A75 data for the NO5 bidding zone (all psrTypes return code 999
  // going back 12+ months). 0.11 TWh/yr from existing synthetic snapshot
  // (2.5% rate × NO1-scaled profile); Iceland seasonal shares are the best
  // available Nordic spring-snowmelt proxy.
  "norway-no5": { annualTWh: 0.11, kind: "hydro-seasonal", seasonalSharesKey: "iceland", source: "Statnett/NVE 2024 (NO5 Bergen/West reservoir hydro; spring-spill curtailment only; ENTSO-E A75 not submitted for this bidding zone; 0.11 TWh/yr anchored to existing synthetic profile; Iceland hydro-seasonal shares as Nordic snowmelt proxy)", reportDate: "2024" },
  // Colombia: promoted to T1b-CSV loader (src/data/colombia.json.ts).
  // The loader reads the committed daily XM API CSV (Britta relay) and
  // computes a trailing-365-day annualised TWh figure. Removed from statics
  // 2026-04-30; the entry in regionData in index.md takes precedence via
  // object spread order (explicit `colombia` key before `...statics`).
  // colombia: SUPERSEDED BY LOADER — do not add back here.
  // Ukraine: ENTSO-E Ukrenergo returns empty A75 data post-2022 synchronisation.
  // Solar-dominant fallback at 1.2 TWh/yr; Ukrainian renewables are ~60% solar
  // (southern steppes: Nikopol, Zaporizhzhia, Kherson), ~40% wind (southern coast).
  // Anchor sourced from Ember Ukraine 2024 report (pre-war capacity adjusted for
  // infrastructure damage, 1.1-1.4 TWh/yr curtailment plausible).
  ukraine: { annualTWh: 0.7, kind: "solar", localSolarPeakUTC: 9, source: "Ember Ukraine 2024 (ENTSO-E Ukrenergo data absent post-war; solar 60% of ~1.2 TWh/yr total curtailment → 0.7 TWh/yr; wind in ukraine-wind region)", reportDate: "2024" },
};

/** Pure builder: spec in, RegionData out. Exported for tests. */
export function buildStaticRegion(id: string, spec: StaticSpec, now: Date = new Date()): RegionData {
  let profile: number[];
  let scaledTotalTWh = spec.annualTWh * (30 / 365);
  let sourceNote = spec.source;

  if (spec.kind === "solar" && spec.localSolarPeakUTC != null) {
    profile = solarProfile(spec.localSolarPeakUTC, spec.annualTWh);
  } else if (spec.kind === "wind" && spec.localSolarPeakUTC != null) {
    // Reuse `localSolarPeakUTC` as the diurnal phase anchor for the wind shape.
    // The windProfile baseline is 0.65 + 0.35×phase, so the difference between
    // peak and trough is small; the field is named `localSolarPeakUTC` for
    // historical consistency with the solar-only shape but here it parameterises
    // the mild day/night swing in `windProfile`. Routes to T3 because the
    // chosen overnight-bias is modelled.
    profile = windProfile(spec.localSolarPeakUTC, spec.annualTWh);
  } else if (spec.kind === "hydro-seasonal" && spec.seasonalSharesKey) {
    const shares = HYDRO_SEASONAL_SHARES[spec.seasonalSharesKey];
    profile = hydroSeasonalProfile(spec.annualTWh, shares, now);
    const factor = seasonalScaleFactor(shares, now);
    scaledTotalTWh = spec.annualTWh * (30 / 365) * factor;
    sourceNote = `${spec.source} — current 30-day seasonal factor ${factor.toFixed(2)}×`;
  } else {
    // "flat", "hydro" and "mixed" all emit a flat 24/7 profile here. The tier
    // is determined by the region's canonical tier in regions.ts (anchored →
    // T2, estimated → T3), not the profile shape.
    const flatGW = (spec.annualTWh * 1000) / 8760;
    profile = Array(24).fill(flatGW);
  }
  const base: RegionData = {
    regionId: id,
    profile,
    latestProfile: null,
    totalTWh: scaledTotalTWh,
    peakGW: Math.max(...profile),
    lastUpdated: spec.reportDate,
    lastSuccessAt: coerceLastSuccessAt(spec.reportDate),
    sourceNote,
  };
  const region = REGIONS.find((r) => r.id === id);
  const regionTier = region?.tier ?? "estimated";
  const profileKind: "flat" | "solar" | "wind" | "mixed" | "hydro-seasonal" =
    spec.kind === "hydro" ? "mixed" : (spec.kind ?? "flat");
  return stampRegionSourceProvenance(
    applyUncertainty(
      base,
      { regionTier, profileKind },
    ),
  );
}

const CANONICAL_REGION_IDS = new Set(REGIONS.map((region) => region.id));

interface BuildAllStaticsOptions {
  /** Include non-canonical audit candidates for research checks, not dashboard output. */
  includeCandidates?: boolean;
}

/** Build the static-region map emitted to the dashboard by default. */
export function buildAllStatics(options: BuildAllStaticsOptions = {}): Record<string, RegionData> {
  const out: Record<string, RegionData> = {};
  for (const [id, spec] of Object.entries(STATIC_REGIONS)) {
    if (!options.includeCandidates && !CANONICAL_REGION_IDS.has(id)) continue;
    out[id] = buildStaticRegion(id, spec);
  }
  return out;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const data = buildAllStatics();
  process.stdout.write(JSON.stringify(data));
}
