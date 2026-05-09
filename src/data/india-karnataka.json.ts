import { pathToFileURL, fileURLToPath } from "url";
import { dirname, join } from "path";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalSolarRegion } from "../lib/typical-profiles.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import { readStateSldcCurtailment } from "../lib/india-gen-re.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "india-karnataka";
const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_SLDC_PATH = join(__dirname, "../../data/historical/india-karnataka-sldc-curtailed-daily.csv");

async function run(): Promise<RegionData> {
  const sldc = readStateSldcCurtailment(CSV_SLDC_PATH, 90);
  if (sldc !== null) {
    const curtailedTWh = sldc.solarCurtailedTWh + sldc.windCurtailedTWh;
    const base = buildTypicalSolarRegion(
      REGION_ID,
      6.5,
      curtailedTWh,
      `KSLDC (Karnataka State Load Despatch Centre) direct curtailment — ${sldc.nRows}-day CSV, ` +
      `trailing-90-day solar ${sldc.solarCurtailedTWh.toFixed(2)} TWh + wind ${sldc.windCurtailedTWh.toFixed(2)} TWh curtailed. ` +
      `Latest date: ${sldc.latestDate}. Hourly shape is synthetic.`,
      new Date().getFullYear().toString(),
    );
    return { ...base, regionTier: "live" as const, sourceProvenance: "verified" };
  }

  const base = buildTypicalSolarRegion(
    REGION_ID,
    6.5,
    0.5,
    `No KSLDC curtailment CSV yet; T3-modelled fallback calibrated to POSOCO South Region RE curtailment 2024 ` +
    `(~0.5 TWh/yr Karnataka solar curtailment; Pavagada Solar Park + Bidar solar + growing wind). ` +
    `Will be promoted to T1a-live-tso when the KSLDC fetcher accumulates ≥30 daily rows.`,
    "2024",
  );
  return applyUncertainty(base, { regionTier: "static", profileKind: "solar" });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback(REGION_ID, () => run(), { regionTier: "static" })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("india-karnataka loader failed", err);
      process.exit(1);
    });
}

export const buildIndiaKarnatakaData = () => run();
