import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalSolarRegion, buildTypicalWindRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "jordan";
const SOURCE_URL = "https://www.nepco.com.jo/";

function buildMixed(sourceNote: string): RegionData {
  const wind = buildTypicalWindRegion(REGION_ID, 21, 0.25, sourceNote, "2024");
  const solar = buildTypicalSolarRegion(REGION_ID, 10, 0.1, sourceNote, "2024");
  const profile = wind.profile.map((value, i) => value + solar.profile[i]);
  return {
    ...wind,
    profile,
    totalTWh: wind.totalTWh + solar.totalTWh,
    peakGW: Math.max(...profile),
    fuelShare: { wind: 0.7, solar: 0.3 },
    sourceNote: `${sourceNote} fuelShare: wind 70% / solar 30% from 17% wind-curtailment headline plus Ma'an solar estimate.`,
  };
}

async function run({ probe = true } = {}): Promise<RegionData> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("NEPCO public pages cite curtailment but expose no hourly machine-readable feed");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    return buildMixed(
      `Typical-shape fallback: NEPCO live feed unavailable (${(err as Error).message}); calibration anchor ~0.35 TWh/yr wind + solar curtailment.`,
    );
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback(REGION_ID, () => run())
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => { console.error("jordan loader failed", err); process.exit(1); });
}

export const buildJordanData = () => run({ probe: false });
