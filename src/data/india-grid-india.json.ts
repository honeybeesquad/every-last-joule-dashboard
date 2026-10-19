/**
 * Grid-India national TSO row — CEA gen-re daily state sheets already in-repo.
 *
 * This is generation, not SLDC instruction energy. Waste unpublished.
 * Coverage: 17 named dashboard state CEA sheets plus east and rest residuals.
 * Not a substitute for those SLDC subgrids. abed is not an India PoP.
 */

import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { withFallback } from "../lib/resilient.js";
import { solarProfile } from "../lib/typical-profiles.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import type { RegionData } from "../lib/types.js";
import { readStateCsvTotal } from "../lib/india-gen-re.js";

const REGION_ID = "india-grid-india";
const IST_NOON_UTC = 6.5;
const CSV_FILES = [
  "india-gujarat-gen-daily.csv",
  "india-rajasthan-gen-daily.csv",
  "india-andhra-pradesh-gen-daily.csv",
  "india-tamil-nadu-gen-daily.csv",
  "india-maharashtra-gen-daily.csv",
  "india-karnataka-gen-daily.csv",
  "india-madhya-pradesh-gen-daily.csv",
  "india-telangana-gen-daily.csv",
  "india-uttar-pradesh-gen-daily.csv",
  "india-punjab-gen-daily.csv",
  "india-odisha-gen-daily.csv",
  "india-chhattisgarh-gen-daily.csv",
  "india-kerala-gen-daily.csv",
  "india-haryana-gen-daily.csv",
  "india-assam-gen-daily.csv",
  "india-himachal-pradesh-gen-daily.csv",
  "india-uttarakhand-gen-daily.csv",
  "india-east-gen-daily.csv",
  "india-rest-gen-daily.csv",
] as const;

const __dirname = dirname(fileURLToPath(import.meta.url));
const HIST = join(__dirname, "../../data/historical");

export function buildIndiaGridIndiaFromCsvs(csvDir = HIST): RegionData {
  let solarTWh = 0;
  let windTWh = 0;
  let nFiles = 0;
  for (const file of CSV_FILES) {
    const tot = readStateCsvTotal(join(csvDir, file), 30);
    if (!tot) continue;
    solarTWh += tot.solarTWh;
    windTWh += tot.windTWh;
    nFiles += 1;
  }
  if (nFiles < 3 || !(solarTWh > 0)) {
    throw new Error(`Grid-India CEA CSVs missing or empty (files=${nFiles}, solarTWh=${solarTWh})`);
  }
  const vreTWh30d = solarTWh + windTWh;
  const annualTWh = (vreTWh30d * 365) / 30;
  const generationProfile = solarProfile(IST_NOON_UTC, annualTWh);
  const lastUpdated = new Date().toISOString();
  const note =
    `CEA gen-re daily Excel (in-repo state sheets: ${nFiles} of ${CSV_FILES.length}; ` +
    `trailing-30-day solar ${solarTWh.toFixed(3)} TWh + wind ${windTWh.toFixed(3)} TWh). ` +
    `Generation collected; waste unpublished until hourly instruction energy exists. ` +
    `Partial national coverage — not a substitute for SLDC subgrids. Not T1a.`;
  const base: RegionData = {
    regionId: REGION_ID,
    profile: Array(24).fill(0),
    latestProfile: null,
    totalTWh: 0,
    peakGW: 0,
    lastUpdated,
    lastSuccessAt: lastUpdated,
    sourceNote: note,
    sourceStatus: "cached",
    sourceProvenance: "official-lead",
    wasteStatus: "unpublished",
    generationProfile,
    generationTotalTWh: vreTWh30d,
  };
  return applyUncertainty(base, { regionTier: "estimated", profileKind: "solar" });
}

async function run(): Promise<RegionData> {
  return buildIndiaGridIndiaFromCsvs();
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback(REGION_ID, () => run(), { regionTier: "estimated" as const })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("india-grid-india loader failed", err);
      process.exit(1);
    });
}

export const buildIndiaGridIndiaData = () => run();
