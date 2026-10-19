import { pathToFileURL, fileURLToPath } from "url";
import { dirname, join } from "path";
import { withFallback } from "../lib/resilient.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import { readStateSldcCurtailment } from "../lib/india-gen-re.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "india-gujarat";
const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_NLDC_PATH = join(__dirname, "../../data/historical/india-gujarat-nldc-curtailed-daily.csv");

async function run(): Promise<RegionData> {
  // Annualise across the entire published NLDC REMC record, not a trailing
  // 90 days. Daily MU is bursty — Oct 2026 had 4–6 GWh solar days next to
  // zeros — so a short window annualises to wildly different answers.
  // The full record is also what T2 asks for: a measured annual total.
  const nldc = readStateSldcCurtailment(CSV_NLDC_PATH, Number.MAX_SAFE_INTEGER);
  if (nldc !== null) {
    const recordTWh = nldc.solarCurtailedTWh + nldc.windCurtailedTWh;
    const annualizedTWh = recordTWh * 365 / nldc.windowDays;
    // Flat 24/7 profile: NLDC publishes daily energy with no intraday
    // breakdown, so any diurnal shape here would be invented. Flat is the
    // honest "we know the total, not the shape" position and is what routes
    // this region to T2-annual-calibrated.
    const flatGW = (annualizedTWh * 1000) / 8760;
    const base: RegionData = {
      regionId: REGION_ID,
      profile: Array(24).fill(flatGW),
      latestProfile: null,
      totalTWh: annualizedTWh * (30 / 365),
      peakGW: flatGW,
      lastUpdated: nldc.latestDate,
      lastSuccessAt: new Date(nldc.latestDate).toISOString(),
      sourceProvenance: "verified",
      sourceNote:
        `Grid-India NLDC REMC daily VRE reports — MEASURED RE State wind+solar ` +
        `curtailment (MU; 1 MU = 1 GWh) from the first table ("VRE Curtailment ` +
        `Details due to real time system constraints"), parsed from the published ` +
        `DD.MM.YYYY_NLDC_REMC_REPORT series. ${nldc.windowDays} published days: solar ` +
        `${(nldc.solarCurtailedTWh * 1000).toFixed(2)} GWh + wind ` +
        `${(nldc.windCurtailedTWh * 1000).toFixed(2)} GWh, annualised to ` +
        `${(annualizedTWh * 1000).toFixed(1)} GWh/yr. Latest published day: ${nldc.latestDate}. ` +
        `NOT a live feed — daily PDFs in arrears, CDN reachable from India only. ` +
        `Not GSLDC DSM / REC / "certificates blocked" pages (those are not ` +
        `operational curtailment). Emergency TRAS Down table excluded (often MW ` +
        `with 0 MU). Flat 24/7 profile: the source gives daily energy only, so no ` +
        `intraday shape is claimed.`,
      fuelShare: recordTWh > 0
        ? { solar: nldc.solarCurtailedTWh / recordTWh, wind: nldc.windCurtailedTWh / recordTWh }
        : { solar: 1, wind: 0 },
    };
    return applyUncertainty(base, { regionTier: "anchored", profileKind: "flat" });
  }

  throw new Error(
    "india-gujarat: NLDC REMC curtailment CSV missing — refusing to emit a T3-modelled " +
    "profile under the region's canonical anchored (T2) tier. " +
    "Regenerate with scripts/fetch-nldc-remc-vre.py.",
  );
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback(REGION_ID, () => run(), { regionTier: "anchored" })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("india-gujarat loader failed", err);
      process.exit(1);
    });
}

export const buildIndiaGujaratData = () => run();
