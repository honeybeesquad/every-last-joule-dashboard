import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalHydroSeasonalRegion, HYDRO_SEASONAL_SHARES } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "russia-mainland";
const SOURCE_URL = "https://www.so-ups.ru/";

async function run({ probe = true } = {}): Promise<RegionData> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("SO UES public pages do not expose unauthenticated hourly hydro-spill data");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    return buildTypicalHydroSeasonalRegion(
      REGION_ID,
      1,
      HYDRO_SEASONAL_SHARES["russia-mainland"],
      `Typical-shape fallback: SO UES live feed unavailable (${(err as Error).message}); calibration anchor ~1 TWh/yr European Russia hydro spill.`,
      "2024",
    );
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback(REGION_ID, () => run())
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => { console.error("russia-mainland loader failed", err); process.exit(1); });
}

export const buildRussiaMainlandData = () => run({ probe: false });
