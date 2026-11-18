import { pathToFileURL, fileURLToPath } from "url";
import { dirname, join } from "path";
import { withFallback } from "../lib/resilient.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import { readRrvpnlCurtailmentEvents } from "../lib/india-gen-re.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "india-rajasthan";
const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_RRVPNL_PATH = join(
  __dirname,
  "../../data/historical/india-rajasthan-rrvpnl-curtailed-events.csv",
);

async function run(): Promise<RegionData> {
  // Published-window rate, not a TWh/yr. RRVPNL PDFs are event reports for
  // Jan–May 2026, not a complete daily NIL series, so the denominator is the
  // 151-day report-set calendar span. Do not multiply by 365/151 in the note.
  const events = readRrvpnlCurtailmentEvents(CSV_RRVPNL_PATH);
  if (events === null) {
    throw new Error(
      "india-rajasthan: RRVPNL event CSV missing — refusing to emit a T3-modelled " +
        "CEA×Ember profile under the region's canonical anchored (T2) tier. " +
        "Restore data/historical/india-rajasthan-rrvpnl-curtailed-events.csv.",
    );
  }

  const recordTWh = events.solarCurtailedTWh + events.windCurtailedTWh;
  const twh30 = recordTWh * 30 / events.windowDays;
  // Flat 24/7: events have clock times but they are not a typical-day series.
  // A solar archetype here would make this T3 by the T2-vs-T3 shape test.
  const flatGW = (recordTWh * 1000) / (events.windowDays * 24);
  const base: RegionData = {
    regionId: REGION_ID,
    profile: Array(24).fill(flatGW),
    latestProfile: null,
    totalTWh: twh30,
    peakGW: flatGW,
    lastUpdated: events.latestDate,
    lastSuccessAt: new Date(events.latestDate).toISOString(),
    sourceNote:
      `RRVPNL (Rajasthan SLDC) re-curtailment PDFs — MEASURED Relief-MW × duration ` +
      `event energy. ${recordTWh.toFixed(3)} TWh in the Jan–May 2026 published reports ` +
      `(${events.nRows} rows, ${events.nManual} medium-confidence manual-from-scan). ` +
      `Dashboard 30-day figure spreads that floor across the ${events.windowDays}-day ` +
      `report window; not annualised to a TWh/yr. Monthly PDFs, not a live feed, hence ` +
      `T2 not T1. Latest event date: ${events.latestDate}. Flat 24/7 profile: events ` +
      `are not an hourly series. Supersedes CEA×Ember ~4.6 TWh/yr, which overstated ` +
      `this floor by ~50× (issue #964).`,
    fuelShare: recordTWh > 0
      ? { solar: events.solarCurtailedTWh / recordTWh, wind: events.windCurtailedTWh / recordTWh }
      : { solar: 1, wind: 0 },
    sourceProvenance: "verified",
  };
  return applyUncertainty(base, { regionTier: "anchored", profileKind: "flat" });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback(REGION_ID, () => run(), { regionTier: "anchored" })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("india-rajasthan loader failed", err);
      process.exit(1);
    });
}

export const buildIndiaRajasthanData = () => run();
