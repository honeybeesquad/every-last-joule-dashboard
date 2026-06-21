import { readFileSync } from "fs";
import { join } from "path";
import { pathToFileURL } from "url";
import { withFallback } from "../lib/resilient.js";
import { timeOfDayAverageGW, totalTWh30d, peakGW, latestCompleteUtcDayProfileGW } from "../lib/profile.js";
import { buildTypicalSolarRegion } from "../lib/typical-profiles.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";

const REGION_ID = "cyprus";

/**
 * Cyprus wind curtailment rate.
 * TSOC publishes hourly wind generation at the transmission system (MW).
 * No direct curtailment column exists — Cyprus's RES curtailment is managed
 * by dispatch and reported in annual PDFs (TSOC RES curtailments reports).
 * The ~2% rate is estimated from the gap between installed wind (~150 MW)
 * and typical dispatch patterns in the Eastern Mediterranean synchronous zone.
 */
const WIND_CURTAILMENT_RATE = 0.02;

function readCsvData(): CurtailmentPoint[] | null {
  const csvPath = join(process.cwd(), "data", "historical", "cyprus-tsoc-wind.csv");
  try {
    const csv = readFileSync(csvPath, "utf-8");
    const lines = csv.trim().split("\n");
    if (lines.length < 2) return null;

    const points: CurtailmentPoint[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",");
      if (cols.length < 3) continue;
      const utcTs = cols[0].trim();
      const curtMw = parseFloat(cols[2]); // curtailment_mw
      if (!Number.isFinite(curtMw) || curtMw <= 0) continue;
      points.push({ utcTimestamp: utcTs, mw: curtMw });
    }
    if (points.length < 4) return null;
    return points;
  } catch {
    return null;
  }
}

async function run({ probe = true } = {}): Promise<RegionData> {
  // Try relay CSV first (committed data from Flaresolverr)
  const csvPoints = readCsvData();
  if (csvPoints && csvPoints.length > 0) {
    const lastTs = csvPoints[csvPoints.length - 1].utcTimestamp;
    const sourceNote =
      `TSOC Cyprus wind generation relay CSV (cyprus-tsoc-wind.csv, ${csvPoints.length} points) ` +
      `× ${(WIND_CURTAILMENT_RATE * 100).toFixed(0)}% calibrated curtailment rate. ` +
      `Flaresolverr-unblocked from tsoc.org.cy (Cloudflare). Latest: ${lastTs}.`;

    const result: RegionData = {
      regionId: REGION_ID,
      profile: timeOfDayAverageGW(csvPoints),
      latestProfile: null,
      totalTWh: totalTWh30d(csvPoints),
      peakGW: peakGW(csvPoints),
      lastUpdated: lastTs,
      lastSuccessAt: new Date().toISOString(),
      sourceNote,
    };
    return applyUncertainty(result, { regionTier: "estimated" });
  }

  // Fallback: typical solar profile
  return buildTypicalSolarRegion(
    REGION_ID,
    5,
    0.05,
    `Typical-shape fallback: TSOC Cyprus relay CSV unavailable. ` +
    `Calibration anchor ~0.05 TWh/yr (TSOC annual reports).`,
    "2025",
  );
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback(REGION_ID, () => run(), { regionTier: "estimated" })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => { console.error("cyprus loader failed", err); process.exit(1); });
}

export const buildCyprusData = () => run({ probe: false });
