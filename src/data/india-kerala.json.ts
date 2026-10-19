import { pathToFileURL, fileURLToPath } from "url";
import { dirname, join } from "path";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalMixedRegion } from "../lib/typical-profiles.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import { readStateCsvTotal, readStateSldcCurtailment, computeCurtailedEnergy, CURTAILMENT_RATES } from "../lib/india-gen-re.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "india-kerala";
const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = join(__dirname, "../../data/historical/india-kerala-gen-daily.csv");
const CSV_SLDC_PATH = join(__dirname, "../../data/historical/india-kerala-sldc-curtailed-daily.csv");
const CURTAILMENT = CURTAILMENT_RATES[REGION_ID];

async function run(): Promise<RegionData> {
  const sldc = readStateSldcCurtailment(CSV_SLDC_PATH, 90);
  if (sldc !== null) {
    const rawWindowTWh = sldc.solarCurtailedTWh + sldc.windCurtailedTWh;
    const annualizedTWh = rawWindowTWh * 365 / sldc.windowDays;
    const solarShare = rawWindowTWh > 0 ? sldc.solarCurtailedTWh / rawWindowTWh : 0.78;
    const windShare  = rawWindowTWh > 0 ? sldc.windCurtailedTWh  / rawWindowTWh : 0.22;
    const base = buildTypicalMixedRegion(
      REGION_ID,
      annualizedTWh,
      { solar: solarShare, wind: windShare },
      `KSEBL (Kerala SLDC) direct curtailment — ${sldc.nRows}-day CSV, ` +
      `trailing-90-day solar ${sldc.solarCurtailedTWh.toFixed(3)} TWh + wind ${sldc.windCurtailedTWh.toFixed(3)} TWh curtailed; ` +
      `annualised to ${annualizedTWh.toFixed(3)} TWh/yr (× 365 / ${sldc.nRows} rows). ` +
      `Latest date: ${sldc.latestDate}. Hourly shape is synthetic.`,
      new Date().getFullYear().toString(),
      7,
      15,
    );
    return { ...base, confidenceTier: "T1a-live-tso" as const, sourceProvenance: "verified" };
  }

  const csv = readStateCsvTotal(CSV_PATH, 365);

  if (csv !== null) {
    const combinedTWh = csv.solarTWh + csv.windTWh;
    const curtailedTWh = computeCurtailedEnergy(combinedTWh, CURTAILMENT.rate);
    const solarShare = combinedTWh > 0 ? csv.solarTWh / combinedTWh : 0.78;
    const windShare  = combinedTWh > 0 ? csv.windTWh  / combinedTWh : 0.22;
    const base = buildTypicalMixedRegion(
      REGION_ID,
      curtailedTWh,
      { solar: solarShare, wind: windShare },
      `CEA gen-re.cea.gov.in daily Excel, State-Wise sheet (${csv.nRows}-day CSV; trailing-365-day solar ${csv.solarTWh.toFixed(3)} TWh + wind ${csv.windTWh.toFixed(3)} TWh). ` +
      `Annual curtailed energy = CEA generation × Ember India 2024 rate ${(CURTAILMENT.rate * 100).toFixed(0)}% / (1 − rate) = ${curtailedTWh.toFixed(3)} TWh. ` +
      `Hourly shape is synthetic. Only the generation denominator is from a primary official source.`,
      new Date().getFullYear().toString(),
      7,
      15,
    );
    return { ...base, sourceProvenance: "official-lead" };
  }

  const base = buildTypicalMixedRegion(
    REGION_ID,
    0.006,
    { solar: 0.78, wind: 0.22 },
    `No CEA CSV present; T3-modelled fallback calibrated to Ember India 2024 (~0.006 TWh/yr mixed solar+wind curtailment, Kerala). ` +
    `Will be promoted to T1a-live-tso when an SLDC energy series exists.`,
    "2024",
    7,
    15,
  );
  return applyUncertainty(base, { regionTier: "estimated", profileKind: "mixed" });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback(REGION_ID, () => run(), { regionTier: "estimated" })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("india-kerala loader failed", err);
      process.exit(1);
    });
}

export const buildIndiaKeralaData = () => run();
