import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalSolarRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "nt-pilbara";
const SOURCE_URL = "https://www.horizonpower.com.au/";

async function run({ probe = true } = {}): Promise<RegionData> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("Horizon Power / Pilbara captive networks expose no unauthenticated hourly curtailment feed");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    return buildTypicalSolarRegion(
      REGION_ID,
      4,
      0.2,
      `Typical-shape fallback: NT/Pilbara live feed unavailable (${(err as Error).message}); calibration anchor ~0.2 TWh/yr captive solar curtailment.`,
      "2024",
    );
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback(REGION_ID, () => run())
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => { console.error("nt-pilbara loader failed", err); process.exit(1); });
}

export const buildNtPilbaraData = () => run({ probe: false });
