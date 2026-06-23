import { pathToFileURL, fileURLToPath } from "url";
import { dirname, join } from "path";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalSolarRegion } from "../lib/typical-profiles.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import { readStateCsvTotal, readStateSldcCurtailment, computeCurtailedEnergy, CURTAILMENT_RATES } from "../lib/india-gen-re.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "india-rajasthan";
const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = join(__dirname, "../../data/historical/india-rajasthan-gen-daily.csv");
const CSV_SLDC_PATH = join(__dirname, "../../data/historical/india-rajasthan-sldc-curtailed-daily.csv");
const CURTAILMENT = CURTAILMENT_RATES[REGION_ID];

async function run(): Promise<RegionData> {
  const sldc = readStateSldcCurtailment(CSV_SLDC_PATH, 90);
  if (sldc !== null) {
    const rawWindowTWh = sldc.solarCurtailedTWh + sldc.windCurtailedTWh;
    const annualizedTWh = rawWindowTWh * 365 / sldc.nRows;
    const base = buildTypicalSolarRegion(
      REGION_ID,
      6.5,
      annualizedTWh,
      `RSLDC (Rajasthan State Load Despatch Centre) direct curtailment — ${sldc.nRows}-day CSV, ` +
      `trailing-90-day solar ${sldc.solarCurtailedTWh.toFixed(2)} TWh + wind ${sldc.windCurtailedTWh.toFixed(2)} TWh curtailed; ` +
      `annualised to ${annualizedTWh.toFixed(2)} TWh/yr (× 365 / ${sldc.nRows} rows). ` +
      `Latest date: ${sldc.latestDate}. Hourly shape is synthetic.`,
      new Date().getFullYear().toString(),
    );
    return { ...base, confidenceTier: "T1a-live-tso" as const, sourceProvenance: "verified" };
  }

  const csv = readStateCsvTotal(CSV_PATH, 365);

  if (csv !== null) {
    const curtailedTWh = computeCurtailedEnergy(csv.solarTWh, CURTAILMENT.rate);
    const base = buildTypicalSolarRegion(
      REGION_ID,
      6.5,
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
    6.5,
    3.5,
    `No CEA CSV present; T3-modelled fallback calibrated to Ember India 2025 (~3.5 TWh/yr solar curtailment, Rajasthan transmission bottlenecks).`,
    "2025",
  );
  return applyUncertainty(base, { regionTier: "estimated", profileKind: "solar" });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback(REGION_ID, () => run(), { regionTier: "estimated" })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("india-rajasthan loader failed", err);
      process.exit(1);
    });
}

export const buildIndiaRajasthanData = () => run();
