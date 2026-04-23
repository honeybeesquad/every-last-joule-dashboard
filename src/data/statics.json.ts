import type { RegionData } from "../lib/types.js";
import { solarProfile } from "../lib/typical-profiles.js";
import { pathToFileURL } from "url";

type ProfileKind = "flat" | "solar";

interface StaticSpec {
  annualTWh: number;
  source: string;
  reportDate: string;
  /** Profile shape. "flat" for hydro/geothermal/flare (monthly-seasonal or 24/7 by
   *  nature); "solar" for regions whose curtailment correlates with local solar
   *  noon but who have no public hourly feed (Xinjiang). */
  kind?: ProfileKind;
  /** UTC hour of local solar noon, for "solar" kind. Xinjiang sits at ~85°E so
   *  local solar noon is UTC 12 - 85/15 ≈ UTC 06:20. */
  localSolarPeakUTC?: number;
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
  sichuan: { annualTWh: 30, kind: "flat", source: "Ember China Electricity Review 2025 (monsoon hydro spill, near-flat baseline)", reportDate: "2025-Q1" },
  xinjiang: { annualTWh: 15, kind: "solar", localSolarPeakUTC: 6.33, source: "S&P 'Rising Curtailment in China' 2024 (typical-shape solar bump centred on local noon UTC 06:20)", reportDate: "2024" },
  iceland: { annualTWh: 5.3, kind: "flat", source: "Orkustofnun - Icelandic National Energy Authority (hydro/geothermal, near-flat)", reportDate: "2024" },
  permian: { annualTWh: 44, kind: "flat", source: "World Bank GGFR 2024 (~12 bcm/yr × 3.7 TWh-e/bcm, flat 24/7 by nature)", reportDate: "2024" },
  "w-siberia": { annualTWh: 92, kind: "flat", source: "World Bank GGFR 2024 (~25 bcm/yr × 3.7 TWh-e/bcm, flat 24/7)", reportDate: "2024" },
  "s-iraq": { annualTWh: 63, kind: "flat", source: "World Bank GGFR 2024 (~17 bcm/yr × 3.7 TWh-e/bcm, flat 24/7)", reportDate: "2024" },
  "e-saudi": { annualTWh: 37, kind: "flat", source: "World Bank GGFR 2024 (~10 bcm/yr × 3.7 TWh-e/bcm, flat 24/7)", reportDate: "2024" },
};

/** Pure builder: spec in, RegionData out. Exported for tests. */
export function buildStaticRegion(id: string, spec: StaticSpec): RegionData {
  let profile: number[];
  if (spec.kind === "solar" && spec.localSolarPeakUTC != null) {
    profile = solarProfile(spec.localSolarPeakUTC, spec.annualTWh);
  } else {
    const flatGW = (spec.annualTWh * 1000) / 8760;
    profile = Array(24).fill(flatGW);
  }
  return {
    regionId: id,
    profile,
    latestProfile: null,
    totalTWh: spec.annualTWh * (30 / 365),
    peakGW: Math.max(...profile),
    lastUpdated: spec.reportDate,
    sourceNote: spec.source,
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
