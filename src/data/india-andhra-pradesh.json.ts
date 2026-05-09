import { pathToFileURL, fileURLToPath } from "url";
import { dirname, join } from "path";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalSolarRegion } from "../lib/typical-profiles.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import { readStateCsvTotal, readStateSldcCurtailment, computeCurtailedEnergy, CURTAILMENT_RATES } from "../lib/india-gen-re.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "india-andhra-pradesh";
const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = join(__dirname, "../../data/historical/india-andhra-pradesh-gen-daily.csv");
const CSV_SLDC_PATH = join(__dirname, "../../data/historical/india-andhra-pradesh-sldc-curtailed-daily.csv");
const CURTAILMENT = CURTAILMENT_RATES[REGION_ID];

async function run(): Promise<RegionData> {
  const sldc = readStateSldcCurtailment(CSV_SLDC_PATH, 90);
  if (sldc !== null) {
    const curtailedTWh = sldc.solarCurtailedTWh + sldc.windCurtailedTWh;
    const base = buildTypicalSolarRegion(
      REGION_ID,
      7,
      curtailedTWh,
      `APSLDC (Andhra Pradesh State Load Despatch Centre) direct curtailment — ${sldc.nRows}-day CSV, ` +
      `trailing-90-day solar ${sldc.solarCurtailedTWh.toFixed(2)} TWh + wind ${sldc.windCurtailedTWh.toFixed(2)} TWh curtailed. ` +
      `Latest date: ${sldc.latestDate}. Hourly shape is synthetic.`,
      new Date().getFullYear().toString(),
    );
    return { ...base, regionTier: "live" as const, sourceProvenance: "verified" };
  }

  const csv = readStateCsvTotal(CSV_PATH, 365);

  if (csv !== null) {
    const curtailedTWh = computeCurtailedEnergy(csv.solarTWh, CURTAILMENT.rate);
    const base = buildTypicalSolarRegion(
      REGION_ID,
      7,
      curtailedTWh,
      `CEA gen-re.cea.gov.in daily Excel, State-Wise sheet (${csv.nRows}-day CSV; trailing-365-day solar ${csv.solarTWh.toFixed(2)} TWh). ` +
      `Annual curtailed energy = CEA generation × Ember India 2024 rate ${(CURTAILMENT.rate * 100).toFixed(0)}% / (1 − rate) = ${curtailedTWh.toFixed(2)} TWh. ` +
      `Hourly shape is synthetic. Only the generation denominator is from a primary official source.`,
      new Date().getFullYear().toString(),
    );
    return { ...base, sourceProvenance: "official-lead" };
  }

  // No CSV yet — T3 modelled fallback
  const base = buildTypicalSolarRegion(
    REGION_ID,
    7,
    0.4,
    `No CEA CSV present; T3-modelled fallback calibrated to POSOCO Southern Region 2024 (~0.4 TWh/yr solar curtailment, Anantapur + Kadapa solar parks).`,
    "2024",
  );
  return applyUncertainty(base, { regionTier: "static", profileKind: "solar" });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback(REGION_ID, () => run(), { regionTier: "static" })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("india-andhra-pradesh loader failed", err);
      process.exit(1);
    });
}

export const buildIndiaAndhraPradeshData = () => run();
