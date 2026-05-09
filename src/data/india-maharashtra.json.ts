import { pathToFileURL, fileURLToPath } from "url";
import { dirname, join } from "path";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalMixedRegion } from "../lib/typical-profiles.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import { readStateCsvTotal, computeCurtailedEnergy, CURTAILMENT_RATES } from "../lib/india-gen-re.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "india-maharashtra";
const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = join(__dirname, "../../data/historical/india-maharashtra-gen-daily.csv");
const CURTAILMENT = CURTAILMENT_RATES[REGION_ID];

async function run(): Promise<RegionData> {
  const csv = readStateCsvTotal(CSV_PATH, 365);

  if (csv !== null) {
    const combinedTWh = csv.solarTWh + csv.windTWh;
    const curtailedTWh = computeCurtailedEnergy(combinedTWh, CURTAILMENT.rate);
    const solarShare = combinedTWh > 0 ? csv.solarTWh / combinedTWh : 0.55;
    const windShare  = combinedTWh > 0 ? csv.windTWh  / combinedTWh : 0.45;
    const base = buildTypicalMixedRegion(
      REGION_ID,
      curtailedTWh,
      { solar: solarShare, wind: windShare },
      `CEA gen-re.cea.gov.in daily Excel, State-Wise sheet (${csv.nRows}-day CSV; trailing-365-day solar ${csv.solarTWh.toFixed(2)} TWh + wind ${csv.windTWh.toFixed(2)} TWh). ` +
      `Annual curtailed energy = CEA generation × Ember India 2024 rate ${(CURTAILMENT.rate * 100).toFixed(0)}% / (1 − rate) = ${curtailedTWh.toFixed(2)} TWh. ` +
      `Hourly shape is synthetic. Only the generation denominator is from a primary official source.`,
      new Date().getFullYear().toString(),
      7,
      15,
    );
    return { ...base, sourceProvenance: "official-lead" };
  }

  // No CSV yet — T3 modelled fallback
  const base = buildTypicalMixedRegion(
    REGION_ID,
    0.3,
    { solar: 0.55, wind: 0.45 },
    `No CEA CSV present; T3-modelled fallback calibrated to POSOCO Western Region 2024 (~0.3 TWh/yr mixed solar+wind curtailment, Solapur + Satara/Dhule corridor).`,
    "2024",
    7,
    15,
  );
  return applyUncertainty(base, { regionTier: "static", profileKind: "mixed" });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback(REGION_ID, () => run(), { regionTier: "static" })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("india-maharashtra loader failed", err);
      process.exit(1);
    });
}

export const buildIndiaMaharashtraData = () => run();
