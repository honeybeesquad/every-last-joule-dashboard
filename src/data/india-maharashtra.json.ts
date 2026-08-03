import { pathToFileURL, fileURLToPath } from "url";
import { dirname, join } from "path";
import { withFallback } from "../lib/resilient.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import { readStateSldcCurtailment } from "../lib/india-gen-re.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "india-maharashtra";
const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_SLDC_PATH = join(__dirname, "../../data/historical/india-maharashtra-sldc-curtailed-daily.csv");

async function run(): Promise<RegionData> {
  // Annualise across the ENTIRE published record, not a trailing 90 days.
  // MSLDC curtailment is sporadic — single months range from 0.000 to 12.040
  // GWh — so a 90-day window annualises to wildly different answers depending
  // on which months it happens to span. The full record is also what the T2
  // definition asks for: a measured annual total, not a live window.
  const sldc = readStateSldcCurtailment(CSV_SLDC_PATH, Number.MAX_SAFE_INTEGER);
  if (sldc !== null) {
    const recordTWh = sldc.solarCurtailedTWh + sldc.windCurtailedTWh;
    const annualizedTWh = recordTWh * 365 / sldc.windowDays;
    // Flat 24/7 profile: MSLDC publishes daily energy with no intraday
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
      lastUpdated: sldc.latestDate,
      lastSuccessAt: new Date(sldc.latestDate).toISOString(),
      sourceNote:
        `MSLDC (Maharashtra State Load Despatch Centre) Monthly Curtailment Reports — MEASURED ` +
        `daily wind+solar curtailment with operator cause codes, parsed from the published ` +
        `mr10_MMYYYY.pdf series. ${sldc.windowDays} published days: solar ` +
        `${(sldc.solarCurtailedTWh * 1000).toFixed(2)} GWh + wind ` +
        `${(sldc.windCurtailedTWh * 1000).toFixed(2)} GWh, annualised to ` +
        `${(annualizedTWh * 1000).toFixed(1)} GWh/yr. Latest published day: ${sldc.latestDate}. ` +
        `NOT a live feed — reports publish monthly, lag 1–2 months and skip months entirely ` +
        `(2025-03, 2025-12, 2026-01 and 2026-07 were unpublished as at 2026-08-03), so the ` +
        `annualisation spans the published subset rather than a complete year. Flat 24/7 ` +
        `profile: the source gives daily energy only, so no intraday shape is claimed.`,
      fuelShare: recordTWh > 0
        ? { solar: sldc.solarCurtailedTWh / recordTWh, wind: sldc.windCurtailedTWh / recordTWh }
        : { solar: 1, wind: 0 },
    };
    return applyUncertainty(base, { regionTier: "anchored", profileKind: "flat" });
  }

  // No measured branch available. Both former fallbacks — CEA generation x an
  // Ember rate, and a POSOCO-calibrated typical shape — emit a T3-modelled
  // profile, which would contradict this region's canonical `anchored` (T2)
  // tier in regions.ts and trip ci:tier-coherence. Since the MSLDC curtailment
  // CSV is committed, this is unreachable in practice; throwing degrades to the
  // last-good T2 snapshot instead of silently reverting to a modelled estimate
  // that overstated measured curtailment by ~46x.
  throw new Error(
    "india-maharashtra: MSLDC curtailment CSV missing — refusing to emit a T3-modelled " +
    "profile under the region's canonical anchored (T2) tier. " +
    "Regenerate with scripts/fetch-msldc-curtailment.py.",
  );
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  // `lastSuccessAt` will be stamped "now" by withFallback's stampLive (it runs
  // after tagLive, so a loader cannot override it). That is the repo-wide
  // meaning of the field — when the loader last succeeded — and is accurate:
  // the CSV was read successfully. The DATA date is carried by `lastUpdated`
  // (newest published MSLDC day), which is the field to read when judging how
  // current this region's numbers are. They can legitimately differ by 1–2
  // months because MSLDC publishes monthly and in arrears.
  withFallback(REGION_ID, () => run(), { regionTier: "anchored" })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("india-maharashtra loader failed", err);
      process.exit(1);
    });
}

export const buildIndiaMaharashtraData = () => run();
