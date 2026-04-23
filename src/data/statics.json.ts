import type { RegionData } from "../lib/types.js";
import { pathToFileURL } from "url";

interface StaticSpec {
  annualTWh: number;
  source: string;
  reportDate: string;
}

// Values sourced from research/energy_arithmetic.md in the book project.
// See docs/data-source-log.md for per-source notes (add entries in a later step).
// Flare volumes converted from bcm/yr to electrical-equivalent TWh/yr at
// 35% generation efficiency (matches Crusoe-style reciprocating engines):
//   1 bcm natural gas ≈ 10.55 TWh thermal × 0.35 ≈ 3.7 TWh electrical-equiv
const STATIC_REGIONS: Record<string, StaticSpec> = {
  sichuan: { annualTWh: 30, source: "Ember China Electricity Review 2025 (monsoon hydro spill)", reportDate: "2025-Q1" },
  xinjiang: { annualTWh: 15, source: "S&P 'Rising Curtailment in China' 2024 (desert PV)", reportDate: "2024" },
  iceland: { annualTWh: 5.3, source: "Orkustofnun - Icelandic National Energy Authority", reportDate: "2024" },
  permian: { annualTWh: 44, source: "World Bank GGFR 2024 (~12 bcm/yr × 3.7 TWh-e/bcm)", reportDate: "2024" },
  "w-siberia": { annualTWh: 92, source: "World Bank GGFR 2024 (~25 bcm/yr × 3.7 TWh-e/bcm)", reportDate: "2024" },
  "s-iraq": { annualTWh: 63, source: "World Bank GGFR 2024 (~17 bcm/yr × 3.7 TWh-e/bcm)", reportDate: "2024" },
  "e-saudi": { annualTWh: 37, source: "World Bank GGFR 2024 (~10 bcm/yr × 3.7 TWh-e/bcm)", reportDate: "2024" },
};

/** Pure builder: spec in, RegionData out. Exported for tests. */
export function buildStaticRegion(id: string, spec: StaticSpec): RegionData {
  const flatGW = (spec.annualTWh * 1000) / 8760;
  return {
    regionId: id,
    profile: Array(24).fill(flatGW),
    totalTWh: spec.annualTWh * (30 / 365),
    peakGW: flatGW,
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
