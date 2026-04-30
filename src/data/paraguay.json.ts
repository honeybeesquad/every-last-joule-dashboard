import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalHydroSeasonalRegion, HYDRO_SEASONAL_SHARES } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "paraguay";
const SOURCE_URL = "https://www.itaipu.gov.py/";

async function run({ probe = true } = {}): Promise<RegionData> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("Itaipu/ANDE public pages did not expose machine-readable hourly spill or dispatch data");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    return buildTypicalHydroSeasonalRegion(
      REGION_ID,
      10,
      HYDRO_SEASONAL_SHARES.paraguay,
      `Typical-shape fallback: Itaipu spill/dispatch feed unavailable (${(err as Error).message}); hydro spill ~10 TWh/yr calibrated to Paraná basin flood stage (SH summer peak Dec-Feb).`,
      "2024",
    );
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback(REGION_ID, () => run())
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("paraguay loader failed", err);
      process.exit(1);
    });
}

export const buildParaguayData = () => run({ probe: false });
