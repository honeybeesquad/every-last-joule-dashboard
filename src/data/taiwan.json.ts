import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalSolarRegion, buildTypicalWindRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "taiwan";
const PROBE_URLS = [
  "https://www.taipower.com.tw/d006/loadGraph/loadGraph/genshx_.html",
  "https://data.gov.tw/datasets/search?qs=Taipower%20renewable%20curtailment",
  "https://www.trec.org.tw/",
];

function buildMixed(sourceNote: string): RegionData {
  const wind = buildTypicalWindRegion(REGION_ID, 15, 0.4, sourceNote, "2024");
  const solar = buildTypicalSolarRegion(REGION_ID, 4, 0.2, sourceNote, "2024");
  const profile = wind.profile.map((value, i) => value + solar.profile[i]);
  return {
    ...wind,
    profile,
    totalTWh: wind.totalTWh + solar.totalTWh,
    peakGW: Math.max(...profile),
    fuelShare: { wind: 0.67, solar: 0.33 },
    sourceNote: `${sourceNote} fuelShare: wind 67% / solar 33% per offshore-wind and southern-PV calibration.`,
  };
}

async function run({ probe = true } = {}): Promise<RegionData> {
  try {
    if (probe) {
      for (const url of PROBE_URLS) {
        await fetchText(url, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      }
      throw new Error("Taipower/data.gov.tw/T-REC pages do not expose machine-readable hourly curtailment");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    return buildMixed(
      `Typical-shape fallback: Taiwan live feed unavailable (${(err as Error).message}); calibration anchor ~0.6 TWh/yr offshore wind + solar curtailment.`,
    );
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback(REGION_ID, () => run())
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => { console.error("taiwan loader failed", err); process.exit(1); });
}

export const buildTaiwanData = () => run({ probe: false });
