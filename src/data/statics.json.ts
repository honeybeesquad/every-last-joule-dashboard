import type { RegionData } from "../lib/types.js";
import {
  solarProfile,
  hydroSeasonalProfile,
  seasonalScaleFactor,
  HYDRO_SEASONAL_SHARES,
} from "../lib/typical-profiles.js";
import { pathToFileURL } from "url";

type ProfileKind = "flat" | "solar" | "hydro-seasonal";

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
  xinjiang: { annualTWh: 15, kind: "solar", localSolarPeakUTC: 6.33, source: "S&P 'Rising Curtailment in China' 2024 (typical-shape solar bump centred on local noon UTC 06:20)", reportDate: "2024" },
  iceland: { annualTWh: 5.3, kind: "hydro-seasonal", seasonalSharesKey: "iceland", source: "Orkustofnun - Icelandic National Energy Authority (glacial-melt + snowmelt, peaks May-Aug)", reportDate: "2024" },
  // Ukraine: ENTSO-E Ukrenergo returns empty A75 data post-2022 synchronisation.
  // Solar-dominant fallback at 1.2 TWh/yr; Ukrainian renewables are ~60% solar
  // (southern steppes: Nikopol, Zaporizhzhia, Kherson), ~40% wind (southern coast).
  // Anchor sourced from Ember Ukraine 2024 report (pre-war capacity adjusted for
  // infrastructure damage, 1.1-1.4 TWh/yr curtailment plausible).
  ukraine: { annualTWh: 1.2, kind: "solar", localSolarPeakUTC: 9, source: "Ember Ukraine 2024 (ENTSO-E Ukrenergo data absent post-war; solar-dominant typical shape at 60/40 solar/wind, peaking ~UTC 09)", reportDate: "2024" },
  permian: { annualTWh: 44, kind: "flat", source: "World Bank GGFR 2024 (~12 bcm/yr × 3.7 TWh-e/bcm, flat 24/7 by nature)", reportDate: "2024" },
  "w-siberia": { annualTWh: 92, kind: "flat", source: "World Bank GGFR 2024 (~25 bcm/yr × 3.7 TWh-e/bcm, flat 24/7)", reportDate: "2024" },
  "s-iraq": { annualTWh: 63, kind: "flat", source: "World Bank GGFR 2024 (~17 bcm/yr × 3.7 TWh-e/bcm, flat 24/7)", reportDate: "2024" },
  "e-saudi": { annualTWh: 37, kind: "flat", source: "World Bank GGFR 2024 (~10 bcm/yr × 3.7 TWh-e/bcm, flat 24/7)", reportDate: "2024" },
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
};

/** Pure builder: spec in, RegionData out. Exported for tests. */
export function buildStaticRegion(id: string, spec: StaticSpec, now: Date = new Date()): RegionData {
  let profile: number[];
  let scaledTotalTWh = spec.annualTWh * (30 / 365);
  let sourceNote = spec.source;

  if (spec.kind === "solar" && spec.localSolarPeakUTC != null) {
    profile = solarProfile(spec.localSolarPeakUTC, spec.annualTWh);
  } else if (spec.kind === "hydro-seasonal" && spec.seasonalSharesKey) {
    const shares = HYDRO_SEASONAL_SHARES[spec.seasonalSharesKey];
    profile = hydroSeasonalProfile(spec.annualTWh, shares, now);
    const factor = seasonalScaleFactor(shares, now);
    scaledTotalTWh = spec.annualTWh * (30 / 365) * factor;
    sourceNote = `${spec.source} — current 30-day seasonal factor ${factor.toFixed(2)}×`;
  } else {
    const flatGW = (spec.annualTWh * 1000) / 8760;
    profile = Array(24).fill(flatGW);
  }
  return {
    regionId: id,
    profile,
    latestProfile: null,
    totalTWh: scaledTotalTWh,
    peakGW: Math.max(...profile),
    lastUpdated: spec.reportDate,
    sourceNote,
  };
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
