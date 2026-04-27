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
import { pathToFileURL } from "url";

/**
 * StaticSpec profile kinds. Drives both the diurnal-profile builder selected in
 * `buildStaticRegion` and the confidence-tier routing in `applyUncertainty`:
 *   "flat"           → T2-annual-calibrated (24/7 base load, e.g. flare or
 *                      load-shed annual anchor with no hourly signature)
 *   "solar"          → T3-modelled (Gaussian peak around `localSolarPeakUTC`)
 *   "wind"           → T3-modelled (gentle diurnal bias, peak around
 *                      `localSolarPeakUTC` per the windProfile shape)
 *   "mixed"          → T3-modelled (flat 24/7 shape but ±40% T3 envelope —
 *                      used where the underlying anchor is genuinely
 *                      indeterminate-fuel-mix, e.g. composite operator
 *                      annuals or offshore flare anchors lifted onto a
 *                      country grid)
 *   "hydro-seasonal" → T3-modelled (monthly shares × flat diurnal)
 */
type ProfileKind = "flat" | "solar" | "wind" | "mixed" | "hydro-seasonal";

interface StaticSpec {
  annualTWh: number;
  source: string;
  reportDate: string;
  /** Profile shape. "flat" for flare (24/7 by nature); "solar" for regions whose
   *  curtailment correlates with local solar noon (Xinjiang); "hydro-seasonal"
   *  for hydro regions with monsoon / snowmelt peaks (Sichuan, Iceland). */
  kind?: ProfileKind;
  /** UTC hour of local solar noon, for "solar" kind. */
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
// - Flare regions stay flat because flare IS genuinely 24/7 base load.
//   The flat profile is methodologically correct, not a data gap.
const STATIC_REGIONS: Record<string, StaticSpec> = {
  sichuan: { annualTWh: 30, kind: "hydro-seasonal", seasonalSharesKey: "sichuan", source: "Ember China Electricity Review 2025 (Yangtze basin monsoon hydro spill, peaks Jul-Aug, ~zero Nov-Apr)", reportDate: "2025-Q1" },
  // NEA 2024 renewable monitoring evaluation: Xinjiang wind utilisation 93.4%,
  // PV utilisation 92.2%; Huaon/NBS 2024 generation by fuel gives wind
  // 70.79 TWh and PV 38.037 TWh, implying ~8.2 TWh curtailed.
  xinjiang: { annualTWh: 8.2, kind: "solar", localSolarPeakUTC: 6.33, source: "NEA 2024 renewable monitoring evaluation + Huaon/NBS generation by fuel (Xinjiang wind/PV curtailment ~8.2 TWh; solar-shaped fallback centred on local noon UTC 06:20)", reportDate: "2024" },
  iceland: { annualTWh: 5.3, kind: "hydro-seasonal", seasonalSharesKey: "iceland", source: "Orkustofnun - Icelandic National Energy Authority (glacial-melt + snowmelt, peaks May-Aug)", reportDate: "2024" },
  // Ukraine: ENTSO-E Ukrenergo returns empty A75 data post-2022 synchronisation.
  // Solar-dominant fallback at 1.2 TWh/yr; Ukrainian renewables are ~60% solar
  // (southern steppes: Nikopol, Zaporizhzhia, Kherson), ~40% wind (southern coast).
  // Anchor sourced from Ember Ukraine 2024 report (pre-war capacity adjusted for
  // infrastructure damage, 1.1-1.4 TWh/yr curtailment plausible).
  ukraine: { annualTWh: 1.2, kind: "solar", localSolarPeakUTC: 9, source: "Ember Ukraine 2024 (ENTSO-E Ukrenergo data absent post-war; solar-dominant typical shape at 60/40 solar/wind, peaking ~UTC 09)", reportDate: "2024" },
  // World Bank/GFMR 2025 individual flare-location dataset, 2024 rows,
  // Permian bbox 28.5-34.5N, 106.5-100.0W: 5.575 bcm × 3.6925 TWh_e/bcm.
  // Retrieved 2026-04-24:
  // https://www.worldbank.org/en/programs/gasflaringreduction/global-flaring-data
  permian: { annualTWh: 20.6, kind: "flat", source: "World Bank GGFR 2025 individual flare sites, 2024 Permian bbox 5.575 bcm × 3.6925 TWh-e/bcm (flat 24/7)", reportDate: "2025-07" },
  // World Bank/GFMR 2025 individual flare-location dataset, 2024 rows,
  // West Siberia bbox 55.0-67.5N, 60.0-85.0E: 11.479 bcm × 3.6925 TWh_e/bcm.
  // Retrieved 2026-04-24:
  // https://www.worldbank.org/en/programs/gasflaringreduction/global-flaring-data
  "w-siberia": { annualTWh: 42.4, kind: "flat", source: "World Bank GGFR 2025 individual flare sites, 2024 West Siberia bbox 11.479 bcm × 3.6925 TWh-e/bcm (flat 24/7)", reportDate: "2025-07" },
  // World Bank/GFMR 2025 individual flare-location dataset, 2024 rows,
  // South Iraq bbox 29.0-33.5N, 43.0-49.5E: 14.233 bcm × 3.6925
  // TWh_e/bcm = 52.6 TWh_e; retain prior 63 TWh_e because it is within
  // the documented +/-20% audit band against the earlier ~17 bcm basis.
  // Retrieved 2026-04-24:
  // https://www.worldbank.org/en/programs/gasflaringreduction/global-flaring-data
  "s-iraq": { annualTWh: 63, kind: "flat", source: "World Bank GGFR 2025 individual flare sites, 2024 South Iraq bbox 14.233 bcm cross-check; retained prior 63 TWh-e within +/-20% audit band (flat 24/7)", reportDate: "2025-07" },
  // World Bank/GFMR 2025 individual flare-location dataset, 2024 rows,
  // East Saudi bbox 24.0-29.0N, 47.0-51.5E: 2.203 bcm × 3.6925 TWh_e/bcm.
  // Retrieved 2026-04-24:
  // https://www.worldbank.org/en/programs/gasflaringreduction/global-flaring-data
  "e-saudi": { annualTWh: 8.1, kind: "flat", source: "World Bank GGFR 2025 individual flare sites, 2024 East Saudi bbox 2.203 bcm × 3.6925 TWh-e/bcm (flat 24/7)", reportDate: "2025-07" },
  // v0.6 — Codex global-coverage-audit 2026-04-24. Hawaiian Electric's
  // RSWG metric separates curtailment by island; totals not yet extracted
  // from the public workbook, so TWh anchors here are conservative
  // provisional values tuned to island size + 2024 renewable share.
  // Hawaii sun noon is ~22:30-23:00 UTC (HST = UTC-10, local noon 12:00).
  "hawaii-oahu":   { annualTWh: 0.08, kind: "solar", localSolarPeakUTC: 22.5, source: "Hawaiian Electric RSWG 2024 (Oahu ~30% renewables; provisional annual anchor pending workbook extraction)", reportDate: "2024" },
  "hawaii-maui":   { annualTWh: 0.04, kind: "solar", localSolarPeakUTC: 22.5, source: "Hawaiian Electric RSWG 2024 (Maui island system; provisional annual anchor)", reportDate: "2024" },
  "hawaii-island": { annualTWh: 0.05, kind: "solar", localSolarPeakUTC: 22.5, source: "Hawaiian Electric RSWG 2024 (Hawaii Island 58.7% renewable share, highest in HECO system)", reportDate: "2024" },
  // Austria — APG acknowledges renewable curtailment in 2024 but no public
  // annual TWh. Provisional 0.5 TWh/yr tuned to APG's redispatch narrative;
  // upgrade path is an ENTSO-E A75 extraction pass.
  austria: { annualTWh: 0.5, kind: "flat", source: "APG Strombilanz 2024 + ENTSO-E redispatch narrative (provisional 0.5 TWh/yr; ENTSO-E A75 extraction pending)", reportDate: "2024" },
  // Russia Murmansk — SO UPS published monthly dispatch-limit events for
  // Kola Peninsula wind plants in 2024 (84 MW Sep, 77 MW Nov). Annual
  // energy not tabulated; estimated ~0.07 TWh/yr assuming ~80 MW limit
  // × several hundred hours across multiple months.
  "russia-murmansk-wind": { annualTWh: 0.07, kind: "flat", source: "SO UPS 2024 monthly DPM VIE reports (Kola Peninsula wind limits, est. ~0.07 TWh/yr from 84 MW Sep / 77 MW Nov limit events)", reportDate: "2024" },
  // Phase-2.7 Pattern-D Latin-America bulk-add (2026-04-27).
  // Sixteen Caribbean + Central American + small South American grids tagged
  // `recommended_action: introduce-as-T3` in the audit at
  // `data/coverage-audit/2026-04-26-latin-america.csv`. Each row carries a
  // sub-1 TWh anchor sourced from IRENA Country Statistics 2024, Ember 2024,
  // GGFR 2024-25, or named operator annual reports. Profile shape defaults
  // to `solar` for the tropical solar-build-out grids, with explicit
  // exceptions for hydro-dominated rows (Costa Rica, Ecuador), the Cuba
  // post-Hurricane-Ian mixed anchor, and the offshore-flare anchors lifted
  // onto Trinidad & Tobago / Guyana / Suriname grids (modelled as flat 24/7
  // base load via `kind: "mixed"` to keep the ±40% T3 envelope).
  // Timezone mapping for `localSolarPeakUTC`:
  //   AST (UTC−4, Caribbean+Bolivia) → 16.0
  //   EST (UTC−5, Cuba/Jamaica/Panama/Ecuador) → 17.0
  //   CST (UTC−6, Central America)  → 18.0
  //   BRT/SRT/GFT (UTC−3) → 15.0
  guatemala: { annualTWh: 0.4, kind: "solar", localSolarPeakUTC: 18.0, source: "IRENA Renewable Energy Statistics 2024 (Guatemala VRE share) + AMM Plan Operativo 2024 (provisional 0.4 TWh/yr; AMM publishes Resultados de la Operacion as PDF, no hourly feed; Pattern-D static)", reportDate: "2024" },
  "el-salvador": { annualTWh: 0.2, kind: "solar", localSolarPeakUTC: 18.0, source: "IRENA Renewable Energy Statistics 2024 (El Salvador VRE share; provisional 0.2 TWh/yr; UT publishes daily operation reports as PDF only; Pattern-D static)", reportDate: "2024" },
  nicaragua: { annualTWh: 0.1, kind: "solar", localSolarPeakUTC: 18.0, source: "IRENA Nicaragua VRE statistics 2024 (provisional 0.1 TWh/yr; CNDC/ENATREL publish weekly bulletins as PDF; geothermal+wind ~25% of mix; Pattern-D static)", reportDate: "2024" },
  "costa-rica": { annualTWh: 0.3, kind: "mixed", source: "IRENA Costa Rica 2024 (98% renewable; hydro spill documented but not anchored to hourly feed; CENCE inside ICE publishes server-rendered IBM WebSphere portal; provisional 0.3 TWh/yr Pattern-D static, hydro-dominant flat profile)", reportDate: "2024" },
  panama: { annualTWh: 0.2, kind: "solar", localSolarPeakUTC: 17.0, source: "Secretaria Nacional de Energia 2024 (solar+wind ~10% of mix; ETESA/CND publish Informe de Operacion daily as PDF; provisional 0.2 TWh/yr Pattern-D static)", reportDate: "2024" },
  "guatemala-siepac": { annualTWh: 0.1, kind: "solar", localSolarPeakUTC: 18.0, source: "IRENA Central America Interconnect 2024 (SIEPAC corridor; EOR Ente Operador Regional publishes monthly Informe de Operacion Regional as PDF; provisional 0.1 TWh/yr Pattern-D static for the regional interconnect)", reportDate: "2024" },
  cuba: { annualTWh: 0.1, kind: "mixed", source: "Cuba UNE 2022-24 grid restoration + Ember Cuba Electricity Review 2024 (provisional 0.1 TWh/yr reflects post-Hurricane-Ian grid stress, not normal operation; mixed-fuel flat profile; Pattern-D static — do not over-claim a steady-state anchor)", reportDate: "2024" },
  "dominican-republic": { annualTWh: 0.5, kind: "solar", localSolarPeakUTC: 16.0, source: "IRENA Dominican Republic 2024 + OC (Organismo Coordinador del SENI) Reportes de Operacion 2024 (wind+solar ~10% of generation; some curtailment reported in PDF reports; provisional 0.5 TWh/yr Pattern-D static)", reportDate: "2024" },
  jamaica: { annualTWh: 0.2, kind: "solar", localSolarPeakUTC: 17.0, source: "Office of Utilities Regulation Jamaica Annual Report 2024 (Wigton wind + Content solar; JPS vertically integrated; provisional 0.2 TWh/yr Pattern-D static)", reportDate: "2024" },
  "trinidad-tobago": { annualTWh: 0.3, kind: "mixed", source: "GGFR 2024 Trinidad offshore flares ~1 BCM (anchor is upstream offshore flare lifted onto T&TEC grid for coverage; power side has minimal VRE; flat 24/7 profile with mixed-fuel flag; provisional 0.3 TWh/yr-electrical-equivalent Pattern-D static)", reportDate: "2024" },
  barbados: { annualTWh: 0.05, kind: "solar", localSolarPeakUTC: 16.0, source: "IRENA Barbados Renewables 2024 (rooftop PV penetration; BLPC investor-owned via Emera; FRCS Caribbean reports occasional inverter trips; provisional 0.05 TWh/yr Pattern-D static at inclusion threshold)", reportDate: "2024" },
  bolivia: { annualTWh: 0.1, kind: "solar", localSolarPeakUTC: 16.0, source: "IRENA Bolivia 2024 (hydro+gas dominated grid; solar+wind ~3% of mix; CNDC publishes Informe Mensual de Operacion as PDF; provisional 0.1 TWh/yr Pattern-D static for solar curtailment subset)", reportDate: "2024" },
  ecuador: { annualTWh: 0.05, kind: "mixed", source: "IRENA Ecuador 2024 (hydro-dominated grid; CENACE Ecuador publishes Informe Anual + monthly Informe de Operacion as PDF; provisional 0.05 TWh/yr Pattern-D static at inclusion threshold; hydro-dominant flat profile)", reportDate: "2024" },
  guyana: { annualTWh: 0.2, kind: "mixed", source: "GGFR 2024 Guyana Stabroek block flaring offshore (Liza FPSO upstream; not on grid; lifted onto GPL coverage for completeness; flat 24/7 profile; provisional 0.2 TWh/yr-electrical-equivalent Pattern-D static)", reportDate: "2024" },
  suriname: { annualTWh: 0.05, kind: "mixed", source: "GGFR 2024 Suriname Block 58 offshore flaring forecast (upstream off-grid; lifted onto EBS coverage for completeness; flat 24/7 profile; provisional 0.05 TWh/yr-electrical-equivalent Pattern-D static at inclusion threshold)", reportDate: "2024" },
  "french-guiana": { annualTWh: 0.05, kind: "solar", localSolarPeakUTC: 15.0, source: "EDF SEI Bilan Previsionnel Guyane 2024 (small grid; below normal inclusion threshold; included for completeness as the only South-American French overseas territory; ENTSO-E does not cover French overseas, EDF SEI alone; provisional 0.05 TWh/yr Pattern-D static)", reportDate: "2024" },
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
    // the mild day/night swing in `windProfile`.
    profile = windProfile(spec.localSolarPeakUTC, spec.annualTWh);
  } else if (spec.kind === "hydro-seasonal" && spec.seasonalSharesKey) {
    const shares = HYDRO_SEASONAL_SHARES[spec.seasonalSharesKey];
    profile = hydroSeasonalProfile(spec.annualTWh, shares, now);
    const factor = seasonalScaleFactor(shares, now);
    scaledTotalTWh = spec.annualTWh * (30 / 365) * factor;
    sourceNote = `${spec.source} — current 30-day seasonal factor ${factor.toFixed(2)}×`;
  } else {
    // "flat" (T2) and "mixed" (T3) both emit a flat 24/7 profile here. The
    // shape is identical; the tier-routing distinction lives in the
    // `profileKind` passed to `applyUncertainty` below ("flat" → T2, "mixed"
    // → T3 because we explicitly acknowledge the shape is modelled-flat
    // rather than physically-flat-flare).
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
  // S2 uncertainty: tier derived from static-region kind.
  //   "flat"                                    → T2-annual-calibrated (flare or flat-base static, ±20%)
  //   "solar"/"wind"/"mixed"/"hydro-seasonal"   → T3-modelled (typical shape or modelled-flat scaled to annual, ±40%)
  // No backfill variance is available for statics, so the tier-default fraction applies.
  const profileKind = spec.kind ?? "flat";
  return applyUncertainty(
    base,
    { regionTier: "static", profileKind },
  );
}

/** Build the entire static-region map. */
export function buildAllStatics(): Record<string, RegionData> {
  const out: Record<string, RegionData> = {};
  for (const [id, spec] of Object.entries(STATIC_REGIONS)) {
    out[id] = buildStaticRegion(id, spec);
  }
  return out;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const data = buildAllStatics();
  process.stdout.write(JSON.stringify(data));
}
