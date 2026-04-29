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
import { pathToFileURL } from "url";

/**
 * StaticSpec profile kinds. Drives both the diurnal-profile builder selected in
 * `buildStaticRegion` and the confidence-tier routing in `applyUncertainty`:
 *   "flat"           → T2-annual-calibrated (24/7 base load, e.g. flare or
 *                      load-shed annual anchor with no hourly signature)
 *   "solar"          → T3-modelled (Gaussian peak around `localSolarPeakUTC`)
 *   "wind"           → T3-modelled (gentle diurnal bias, peak around
 *                      `localSolarPeakUTC` per the windProfile shape)
 *   "hydro"          → T3-modelled (flat 24/7 profile because hydro spill is
 *                      monthly-seasonal, not hourly; collapses to "mixed"
 *                      inside `applyUncertainty` since the deriveTier enum
 *                      doesn't distinguish them — both produce a flat shape
 *                      under a ±40% T3 envelope)
 *   "mixed"          → T3-modelled (flat 24/7 shape but ±40% T3 envelope —
 *                      used where the underlying anchor is genuinely
 *                      indeterminate-fuel-mix, e.g. composite operator
 *                      annuals or offshore flare anchors lifted onto a
 *                      country grid)
 *   "hydro-seasonal" → T3-modelled (monthly shares × flat diurnal)
 */
type ProfileKind = "flat" | "solar" | "wind" | "hydro" | "mixed" | "hydro-seasonal";

interface StaticSpec {
  annualTWh: number;
  source: string;
  reportDate: string;
  /** Profile shape. Drives both the diurnal-shape generator and (for the
   *  uncertainty engine) the confidenceTier landing — see `applyUncertainty`
   *  in `src/lib/uncertainty.ts::deriveTier` for the static→tier rules.
   *
   *   "flat"            24/7 base load. Used for flare regions and grid-
   *                     bottleneck statics with no diurnal signature. Routes
   *                     to T2-annual-calibrated (±20%).
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
  jamaica: { annualTWh: 0.2, kind: "solar", localSolarPeakUTC: 17.0, source: "Office of Utilities Regulation Jamaica Annual Report 2024 (Wigton wind + Content solar; JPS vertically integrated; provisional 0.2 TWh/yr Pattern-D static)", reportDate: "2024" },
  "trinidad-tobago": { annualTWh: 0.3, kind: "mixed", source: "GGFR 2024 Trinidad offshore flares ~1 BCM (anchor is upstream offshore flare lifted onto T&TEC grid for coverage; power side has minimal VRE; flat 24/7 profile with mixed-fuel flag; provisional 0.3 TWh/yr-electrical-equivalent Pattern-D static)", reportDate: "2024" },
  barbados: { annualTWh: 0.05, kind: "solar", localSolarPeakUTC: 16.0, source: "IRENA Barbados Renewables 2024 (rooftop PV penetration; BLPC investor-owned via Emera; FRCS Caribbean reports occasional inverter trips; provisional 0.05 TWh/yr Pattern-D static at inclusion threshold)", reportDate: "2024" },
  bolivia: { annualTWh: 0.1, kind: "solar", localSolarPeakUTC: 16.0, source: "IRENA Bolivia 2024 (hydro+gas dominated grid; solar+wind ~3% of mix; CNDC publishes Informe Mensual de Operacion as PDF; provisional 0.1 TWh/yr Pattern-D static for solar curtailment subset)", reportDate: "2024" },
  ecuador: { annualTWh: 0.05, kind: "mixed", source: "IRENA Ecuador 2024 (hydro-dominated grid; CENACE Ecuador publishes Informe Anual + monthly Informe de Operacion as PDF; provisional 0.05 TWh/yr Pattern-D static at inclusion threshold; hydro-dominant flat profile)", reportDate: "2024" },
  guyana: { annualTWh: 0.2, kind: "mixed", source: "GGFR 2024 Guyana Stabroek block flaring offshore (Liza FPSO upstream; not on grid; lifted onto GPL coverage for completeness; flat 24/7 profile; provisional 0.2 TWh/yr-electrical-equivalent Pattern-D static)", reportDate: "2024" },
  suriname: { annualTWh: 0.05, kind: "mixed", source: "GGFR 2024 Suriname Block 58 offshore flaring forecast (upstream off-grid; lifted onto EBS coverage for completeness; flat 24/7 profile; provisional 0.05 TWh/yr-electrical-equivalent Pattern-D static at inclusion threshold)", reportDate: "2024" },
  "french-guiana": { annualTWh: 0.05, kind: "solar", localSolarPeakUTC: 15.0, source: "EDF SEI Bilan Previsionnel Guyane 2024 (small grid; below normal inclusion threshold; included for completeness as the only South-American French overseas territory; ENTSO-E does not cover French overseas, EDF SEI alone; provisional 0.05 TWh/yr Pattern-D static)", reportDate: "2024" },
  // Phase-2.7 Pattern-D — Africa bulk-add (2026-04-27).
  // Source: data/coverage-audit/2026-04-26-africa.csv `introduce-as-T3` subset.
  // 32 audit rows; 6 sub-0.05 TWh rows skipped (Burundi 0.01, Gambia 0.02,
  // Lesotho 0.02, Liberia 0.02, Seychelles 0.01, Sierra Leone 0.02). Net 26
  // landed; aggregate ~11.7 TWh anchor.
  // Anchors: IRENA Country Statistics 2024, Ember country reports, GGFR
  // Niger Delta (Nigeria flare component). All ±40% T3-modelled (or T3 via
  // flat-as-typical for hydro/mixed) per the Pattern-D dispatch §3.
  // Timezones for `localSolarPeakUTC`: UTC+1 (CET/WAT) → 11.0; UTC+2 (CAT/SAST) → 10.0;
  // UTC+0 (GMT) → 12.0; UTC+3 (EAT) → 9.0; UTC+4 (MUT) → 8.0; UTC-1 (CVT) → 13.0.
  algeria: { annualTWh: 0.4, kind: "solar", localSolarPeakUTC: 11.0, source: "IRENA Country Statistics 2024 (Algeria SONELGAZ/OS; small wind+PV ~1.5 GW; no public dispatch data)", reportDate: "2024" },
  angola: { annualTWh: 0.2, kind: "solar", localSolarPeakUTC: 11.0, source: "IRENA Angola 2024 (RNT transmission; nascent solar; no operator-published curtailment)", reportDate: "2024" },
  benin: { annualTWh: 0.05, kind: "solar", localSolarPeakUTC: 11.0, source: "IRENA Benin 2024 (SBEE; imports ~80% via WAPP; minimal domestic VRE)", reportDate: "2024" },
  botswana: { annualTWh: 0.05, kind: "solar", localSolarPeakUTC: 10.0, source: "IRENA Botswana 2024 (BPC; SAPP member; small Mmadinare PV)", reportDate: "2024" },
  "burkina-faso": { annualTWh: 0.1, kind: "solar", localSolarPeakUTC: 12.0, source: "IRENA Burkina Faso 2024 (SONABEL; Zagtouli + Nagreongo PV ~70 MW)", reportDate: "2024" },
  "cabo-verde": { annualTWh: 0.05, kind: "mixed", source: "IRENA Cabo Verde 2024 (ELECTRA; island system 9 separate grids; high VRE share with no published curtailment metric)", reportDate: "2024" },
  cameroon: { annualTWh: 0.1, kind: "hydro", source: "IRENA Cameroon 2024 (ENEO/SONATREL; mostly hydro; no dispatch portal)", reportDate: "2024" },
  "congo-drc": { annualTWh: 0.5, kind: "hydro", source: "IRENA DRC 2024 (SNEL; Inga hydro complex ~2.5 GW; SAPP member)", reportDate: "2024" },
  "cote-divoire": { annualTWh: 0.1, kind: "mixed", source: "IRENA Cote d'Ivoire 2024 (CIE; major WAPP exporter; thermal+hydro+growing PV)", reportDate: "2024" },
  eswatini: { annualTWh: 0.05, kind: "mixed", source: "IRENA Eswatini 2024 (EEC; SAPP member; biomass+hydro+Eskom imports)", reportDate: "2024" },
  gabon: { annualTWh: 0.05, kind: "hydro", source: "IRENA Gabon 2024 (SEEG; hydro+gas; oil-flaring relevant via GGFR)", reportDate: "2024" },
  ghana: { annualTWh: 0.2, kind: "hydro", source: "Ember Ghana 2024 (GRIDCo TSO; Akosombo hydro + emerging PV)", reportDate: "2024" },
  madagascar: { annualTWh: 0.05, kind: "hydro", source: "IRENA Madagascar 2024 (JIRAMA; hydro+thermal; small isolated grids)", reportDate: "2024" },
  malawi: { annualTWh: 0.05, kind: "hydro", source: "IRENA Malawi 2024 (ESCOM/EGENCO; Shire hydro cascade + Salima PV 60 MW; SAPP member)", reportDate: "2024" },
  mauritania: { annualTWh: 0.1, kind: "wind", localSolarPeakUTC: 12.0, source: "IRENA Mauritania 2024 (SOMELEC; Boulenouar wind 100 MW + Sheikh Zayed PV; OMVS member)", reportDate: "2024" },
  mauritius: { annualTWh: 0.05, kind: "mixed", source: "IRENA Mauritius 2024 (CEB; bagasse+coal+oil with growing PV; island grid)", reportDate: "2024" },
  mozambique: { annualTWh: 0.3, kind: "hydro", source: "IRENA Mozambique 2024 (EDM; Cahora Bassa hydro exports to Eskom via SAPP; growing solar)", reportDate: "2024" },
  // Nigeria — composite phenomenon: chronic frequency-instability load-shed
  // (Ember 2024) + Niger Delta gas flaring (~7 TWh-eq/yr per GGFR 2024-25).
  // Treated as `kind: "mixed"` with a flat 24/7 profile per the Pattern-D
  // dispatch brief; lat/lon at 9.0°N 8.5°E (country centroid) as specified.
  nigeria: { annualTWh: 7.0, kind: "mixed", source: "Ember Nigeria 2024 + GGFR Niger Delta flaring 2024-25 (TCN as TSO; chronic frequency-instability load-shed + ~7 TWh-eq/yr Niger Delta gas flare composite; flat 24/7 profile)", reportDate: "2024" },
  rwanda: { annualTWh: 0.05, kind: "mixed", source: "IRENA Rwanda 2024 (REG/EUCL; methane-from-Lake-Kivu + hydro+solar)", reportDate: "2024" },
  senegal: { annualTWh: 0.3, kind: "mixed", source: "IRENA Senegal 2024 (SENELEC; Taiba N'Diaye 158 MW wind + PV; OMVS/OMVG member)", reportDate: "2024" },
  tanzania: { annualTWh: 0.5, kind: "hydro", source: "IRENA Tanzania 2024 + Julius Nyerere HPP commissioning (TANESCO; JNHPP 2.1 GW commissioning 2024-25; gas+hydro)", reportDate: "2024" },
  togo: { annualTWh: 0.05, kind: "solar", localSolarPeakUTC: 12.0, source: "IRENA Togo 2024 (CEET; imports via WAPP; Blitta PV 50 MW)", reportDate: "2024" },
  tunisia: { annualTWh: 0.4, kind: "mixed", source: "IRENA Tunisia 2024 + STEG Annual Report (gas-dominated; growing wind Bizerte + PV; ELMED HVDC to Italy planned)", reportDate: "2024" },
  uganda: { annualTWh: 0.2, kind: "hydro", source: "ERA Annual Performance 2024 (UETCL TSO + UEDCL distribution; Karuma+Isimba hydro)", reportDate: "2024" },
  zambia: { annualTWh: 0.5, kind: "hydro", source: "Ember Zambia 2024 + Kariba drought (ZESCO; hydro-dependent Kariba+Kafue; severe 2024-25 drought load-shedding; SAPP member)", reportDate: "2024" },
  zimbabwe: { annualTWh: 0.3, kind: "hydro", source: "Ember Zimbabwe 2024 + Kariba South (ZPC generation, ZETDC T+D; Kariba South hydro+coal; SAPP member)", reportDate: "2024" },
  // PR #bulk-coverage (2026-04-28): 68 countries added to close global gap.
  // --- AMERICAS (7 new) ---
  bahamas: { annualTWh: 0.01, kind: "solar", localSolarPeakUTC: 12.5, source: "IRENA Bahamas 2024 (BPL; solar+oil; island grids)", reportDate: "2024" },
  belize: { annualTWh: 0.02, kind: "hydro", source: "IRENA Belize 2024 (BEL); Herrera hydroelectric + Belize oil + solar", reportDate: "2024" },
  colombia: { annualTWh: 0.8, kind: "hydro", source: "IRENA Colombia 2024 (XM/TSO); hydro ~70 percent; solar growing; SILEC member)", reportDate: "2024" },
  dominica: { annualTWh: 0.01, kind: "solar", localSolarPeakUTC: 12.0, source: "IRENA Dominica 2024 (DOMLEC; hydro+solar+geothermal)", reportDate: "2024" },
  grenada: { annualTWh: 0.01, kind: "solar", localSolarPeakUTC: 12.0, source: "GRENLEC solar+oil; IRENA Grenada 2024", reportDate: "2024" },
  haiti: { annualTWh: 0.05, kind: "solar", localSolarPeakUTC: 12.0, source: "IRENA Haiti 2024 (EDH); severe load-shed; solar+hydro; small grid)", reportDate: "2024" },
  venezuela: { annualTWh: 0.5, kind: "hydro", source: "IRENA Venezuela 2024 (CORPOELEC); hydro ~60 percent + thermal + solar; grid distress)", reportDate: "2024" },
  // --- EUROPE (9 new) ---
  andorra: { annualTWh: 0.01, kind: "hydro", source: "IRENA Andorra 2024 (FEDA); hydro+pumped storage; small high-altitude grid)", reportDate: "2024" },
  liechtenstein: { annualTWh: 0.01, kind: "hydro", source: "IRENA Liechtenstein 2024 (LFV); Alpine hydro+pumped storage; import-dependent)", reportDate: "2024" },
  malta: { annualTWh: 0.03, kind: "solar", localSolarPeakUTC: 8.0, source: "IRENA Malta 2024 (ENEMalta); gas+solar; EU island state)", reportDate: "2024" },
  moldova: { annualTWh: 0.05, kind: "solar", localSolarPeakUTC: 9.0, source: "IRENA Moldova 2024 (Moldelectrica); solar+gas; ENTSO-E continental sync 2022)", reportDate: "2024" },
  // Reverted from ENTSO-E live T1a (2026-04-28): no verifiable A75 published
  // curtailment rate found for these 6 TSOs. Returned to T3 static pending
  // actual calibration data from HOPS (croatia), SEPS (slovakia), ELES
  // (slovenia), Litgrid (lithuania), AST (latvia), ERE (albania).
  croatia: { annualTWh: 0.1, kind: "solar", localSolarPeakUTC: 9.0, source: "IRENA Croatia 2024 (HOPS); solar+wind+hydro; HOPS publishes monthly wind PDF reports, not machine-readable A75; ENTSO-E A75 verification pending)", reportDate: "2024" },
  slovakia: { annualTWh: 0.1, kind: "solar", localSolarPeakUTC: 8.0, source: "IRENA Slovakia 2024 (SEPS); solar+wind; SEPS dashboard has generation data but no published curtailment rate; ENTSO-E A75 verification pending)", reportDate: "2024" },
  slovenia: { annualTWh: 0.05, kind: "solar", localSolarPeakUTC: 8.0, source: "IRENA Slovenia 2024 (ELES); solar+hydro+wind; ELES publishes generation data but no published curtailment rate; ENTSO-E A75 verification pending)", reportDate: "2024" },
  lithuania: { annualTWh: 0.2, kind: "wind", localSolarPeakUTC: 9.0, source: "IRENA Lithuania 2024 (ESO); solar+wind; BRELL ring member; ENTSO-E A75 verification pending)", reportDate: "2024" },
  latvia: { annualTWh: 0.1, kind: "hydro", source: "IRENA Latvia 2024 (AST); Augstkaigo + Ventspils nafta + solar; BRELL; ENTSO-E A75 verification pending)", reportDate: "2024" },
  albania: { annualTWh: 0.05, kind: "mixed", source: "IRENA Albania 2024 (ERE); OSCE member since 2017; hydro-dominant; ENTSO-E A75 verification pending; no public hourly feed identified)", reportDate: "2024" },
  // --- MIDDLE EAST / CENTRAL ASIA (16 new) ---
  afghanistan: { annualTWh: 0.1, kind: "solar", localSolarPeakUTC: 4.5, source: "IRENA Afghanistan 2024 (DABS); solar+hydro+wind; diesel backup; small grid)", reportDate: "2024" },
  armenia: { annualTWh: 0.1, kind: "solar", localSolarPeakUTC: 4.0, source: "IRENA Armenia 2024 (TSO); Metsamor nuclear + hydro + solar; WREM)", reportDate: "2024" },
  azerbaijan: { annualTWh: 0.2, kind: "solar", localSolarPeakUTC: 4.0, source: "IRENA Azerbaijan 2024 (AZERENERGY); oil+gas+solar; growing RE)", reportDate: "2024" },
  bahrain: { annualTWh: 0.05, kind: "solar", localSolarPeakUTC: 3.0, source: "IRENA Bahrain 2024 (EWA); gas+solar; small high-Temperature grid)", reportDate: "2024" },
  georgia: { annualTWh: 0.2, kind: "hydro", source: "IRENA Georgia 2024 (GSE); hydro+solar+wind; ENTSO-E synchronisation ongoing)", reportDate: "2024" },
  jordan: { annualTWh: 0.5, kind: "solar", localSolarPeakUTC: 3.0, source: "IRENA Jordan 2024 (NEPCO); solar+wind+gas; high VRE penetration)", reportDate: "2024" },
  kuwait: { annualTWh: 0.1, kind: "solar", localSolarPeakUTC: 3.0, source: "IRENA Kuwait 2024 (MEW); gas+solar; growing solar)", reportDate: "2024" },
  kyrgyzstan: { annualTWh: 0.1, kind: "hydro", source: "IRENA Kyrgyzstan 2024 (NEK); hydro+solar; CASA-1000 candidate)", reportDate: "2024" },
  lebanon: { annualTWh: 0.05, kind: "solar", localSolarPeakUTC: 3.0, source: "IRENA Lebanon 2024 (EDL); severe crisis; diesel+solar+hydro; small grid)", reportDate: "2024" },
  palestine: { annualTWh: 0.02, kind: "solar", localSolarPeakUTC: 3.0, source: "IRENA Palestine 2024 (PEC); Israel-interconnected; solar+wind)", reportDate: "2024" },
  syria: { annualTWh: 0.1, kind: "solar", localSolarPeakUTC: 3.0, source: "IRENA Syria 2024 (PEO); solar+oil+diesel; war-affected)", reportDate: "2024" },
  tajikistan: { annualTWh: 0.1, kind: "hydro", source: "IRENA Tajikistan 2024 (Barki Tojik); hydro+solar; CASA-1000)", reportDate: "2024" },
  turkmenistan: { annualTWh: 0.1, kind: "solar", localSolarPeakUTC: 4.5, source: "IRENA Turkmenistan 2024 (TDS); gas+solar; isolated grid)", reportDate: "2024" },
  uzbekistan: { annualTWh: 0.2, kind: "solar", localSolarPeakUTC: 5.0, source: "IRENA Uzbekistan 2024 (UzbekEnergo); hydro+solar+gas; solar program)", reportDate: "2024" },
  yemen: { annualTWh: 0.1, kind: "solar", localSolarPeakUTC: 3.0, source: "IRENA Yemen 2024 (PC); solar+diesel; war-affected small grid)", reportDate: "2024" },
  qatar: { annualTWh: 0.05, kind: "solar", localSolarPeakUTC: 3.0, source: "IRENA Qatar 2024 (Kahramaa); gas+solar; small high-T solar program)", reportDate: "2024" },
  // --- SOUTH ASIA (3 new) ---
  srilanka: { annualTWh: 0.1, kind: "solar", localSolarPeakUTC: 5.5, source: "CEB Sri Lanka 450 MW solar + hydro + wind; IRENA Sri Lanka 2024", reportDate: "2024" },
  nepal: { annualTWh: 0.2, kind: "hydro", source: "IRENA Nepal 2024 (NEA); hydro-dominant ~95 percent; solar growing; Himalayan", reportDate: "2024" },
  bhutan: { annualTWh: 0.1, kind: "hydro", source: "IRENA Bhutan 2024 (DHI/BPC); hydro-dominant; export to India; large projects)", reportDate: "2024" },
  // --- EAST ASIA / PACIFIC (10 new) ---
  brunei: { annualTWh: 0.01, kind: "solar", localSolarPeakUTC: 8.0, source: "IRENA Brunei 2024 (AEDED); gas+solar; small high-income grid)", reportDate: "2024" },
  cambodia: { annualTWh: 0.2, kind: "solar", localSolarPeakUTC: 7.0, source: "IRENA Cambodia 2024 (EDC); hydro+solar+coal; rapid solar growth)", reportDate: "2024" },
  myanmar: { annualTWh: 0.2, kind: "solar", localSolarPeakUTC: 6.5, source: "IRENA Myanmar 2024 (MEPE); hydro+solar+gas; war-affected grid)", reportDate: "2024" },
  singapore: { annualTWh: 0.1, kind: "solar", localSolarPeakUTC: 8.0, source: "IRENA Singapore 2024 (EMA); gas+solar+pipeline floating solar)", reportDate: "2024" },
  png: { annualTWh: 0.1, kind: "hydro", source: "IRENA PNG 2024 (PNG-Power); hydro+solar+diesel; island grid)", reportDate: "2024" },
  fiji: { annualTWh: 0.02, kind: "hydro", source: "IRENA Fiji 2024 (EFL); hydro+solar+diesel; Pacific island)", reportDate: "2024" },
  kiribati: { annualTWh: 0.005, kind: "solar", localSolarPeakUTC: 12.0, source: "IRENA Kiribati 2024 (UTT); solar+diesel; atoll islands)", reportDate: "2024" },
  vanuatu: { annualTWh: 0.01, kind: "solar", localSolarPeakUTC: 11.0, source: "IRENA Vanuatu 2024 (UNELCO); solar+hydro+diesel; Pacific islands)", reportDate: "2024" },
  tonga: { annualTWh: 0.005, kind: "solar", localSolarPeakUTC: 12.5, source: "IRENA Tonga 2024 (TPL); solar+diesel+pumped hydro; Pacific island)", reportDate: "2024" },
  // --- AFRICA (23 new) ---
  burundi: { annualTWh: 0.05, kind: "hydro", source: "IRENA Burundi 2024 (REGIDECO); hydro+thermal; small grid; NELS", reportDate: "2024" },
  "central-african-republic": { annualTWh: 0.02, kind: "solar", localSolarPeakUTC: 7.0, source: "IRENA CAR 2024 (ENERCA); hydro+solar+diesel; post-conflict small grid)", reportDate: "2024" },
  chad: { annualTWh: 0.02, kind: "solar", localSolarPeakUTC: 7.0, source: "IRENA Chad 2024 (STEE); solar+diesel+gas; isolated grid)", reportDate: "2024" },
  comoros: { annualTWh: 0.01, kind: "solar", localSolarPeakUTC: 9.0, source: "IRENA Comoros 2024 (MAMWE); solar+diesel; island grid)", reportDate: "2024" },
  "congo-republic": { annualTWh: 0.1, kind: "hydro", source: "IRENA Congo Rep. 2024 (MCPT); hydro+solar; SAPP member", reportDate: "2024" },
  djibouti: { annualTWh: 0.02, kind: "solar", localSolarPeakUTC: 9.0, source: "IRENA Djibouti 2024 (EDD); solar+diesel; small grid; Gulf)", reportDate: "2024" },
  eritrea: { annualTWh: 0.01, kind: "solar", localSolarPeakUTC: 9.0, source: "IRENA Eritrea 2024 (EWA); solar+diesel; isolated grid)", reportDate: "2024" },
  gambia: { annualTWh: 0.02, kind: "solar", localSolarPeakUTC: 12.0, source: "IRENA Gambia 2024 (NAWEC); solar+diesel; small West African grid)", reportDate: "2024" },
  guinea: { annualTWh: 0.1, kind: "hydro", source: "IRENA Guinea 2024 (EDG); hydro+solar; large Fomi hydro project)", reportDate: "2024" },
  "guinea-bissau": { annualTWh: 0.02, kind: "solar", localSolarPeakUTC: 12.0, source: "IRENA Guinea-Bissau 2024 (EGB); solar+diesel; small W African grid)", reportDate: "2024" },
  "equatorial-guinea": { annualTWh: 0.05, kind: "solar", localSolarPeakUTC: 7.0, source: "IRENA Equatorial Guinea 2024 (SONERG); gas+solar+diesel; small grid)", reportDate: "2024" },
  liberia: { annualTWh: 0.05, kind: "solar", localSolarPeakUTC: 12.0, source: "IRENA Liberia 2024 (LEC); hydro+solar+diesel; WAPP member)", reportDate: "2024" },
  libya: { annualTWh: 0.2, kind: "solar", localSolarPeakUTC: 8.0, source: "IRENA Libya 2024 (GECOL); solar+gas+diesel; war-affected grid)", reportDate: "2024" },
  mali: { annualTWh: 0.1, kind: "solar", localSolarPeakUTC: 12.0, source: "IRENA Mali 2024 (EDM); solar+hydro+gas; WAPP member)", reportDate: "2024" },
  niger: { annualTWh: 0.05, kind: "solar", localSolarPeakUTC: 13.0, source: "IRENA Niger 2024 (NIGELEC); solar+diesel; small Sahelian grid)", reportDate: "2024" },
  "sierra-leone": { annualTWh: 0.02, kind: "hydro", source: "IRENA Sierra Leone 2024 (EDSA); hydro+solar+diesel; WAPP", reportDate: "2024" },
  somalia: { annualTWh: 0.05, kind: "solar", localSolarPeakUTC: 9.0, source: "IRENA Somalia 2024; solar+diesel; fragmented grid; conflict", reportDate: "2024" },
  "south-sudan": { annualTWh: 0.05, kind: "solar", localSolarPeakUTC: 9.0, source: "IRENA South Sudan 2024 (MEM); solar+diesel; war-affected grid)", reportDate: "2024" },
  sudan: { annualTWh: 0.2, kind: "solar", localSolarPeakUTC: 8.0, source: "IRENA Sudan 2024 (NEC); hydro+solar+gas; large grid)", reportDate: "2024" },
  seychelles: { annualTWh: 0.01, kind: "solar", localSolarPeakUTC: 8.0, source: "IRENA Seychelles 2024 (PUC); solar+diesel+pumped hydro; island)", reportDate: "2024" },
  "north-korea": { annualTWh: 0.1, kind: "solar", localSolarPeakUTC: 8.5, source: "IRENA North Korea 2024 (KEPA); isolated grid; no public data; Pattern-D T3 static", reportDate: "2024" },
  laos: { annualTWh: 0.2, kind: "hydro", source: "IRENA Laos 2024 (EDL); hydro+solar; export-oriented grid", reportDate: "2024" },
  "east-timor": { annualTWh: 0.02, kind: "solar", localSolarPeakUTC: 8.0, source: "IRENA Timor-Leste 2024 (EDTL); solar+diesel; small island grid", reportDate: "2024" },
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
    // "flat" (T2), "hydro" (T3) and "mixed" (T3) all emit a flat 24/7 profile
    // here. The shape is identical; the tier-routing distinction lives in the
    // `profileKind` passed to `applyUncertainty` below ("flat" → T2,
    // "hydro"/"mixed" → T3 because we explicitly acknowledge the shape is
    // modelled-flat rather than physically-flat-flare). The "hydro" kind
    // collapses to "mixed" inside applyUncertainty since the deriveTier enum
    // doesn't distinguish them.
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
  //   "flat"                              → T2-annual-calibrated (flare or flat-base static, ±20%)
  //   "solar"/"wind"/"mixed"/"hydro"/     → T3-modelled (typical shape or
  //   "hydro-seasonal"                       modelled-flat scaled to annual, ±40%)
  // No backfill variance is available for statics, so the tier-default fraction applies.
  // The `deriveTier` enum doesn't currently distinguish "hydro" from "mixed"
  // (both are flat-with-T3-envelope); collapse here so the uncertainty engine
  // doesn't need a parallel kind axis. The provenance of the choice is
  // surfaced in `regions.ts` Region.kind and the `sourceNote` text.
  const profileKind: "flat" | "solar" | "wind" | "mixed" | "hydro-seasonal" =
    spec.kind === "hydro" ? "mixed" : (spec.kind ?? "flat");
  return applyUncertainty(
    base,
    { regionTier: "static", profileKind },
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
