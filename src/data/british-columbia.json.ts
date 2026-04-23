import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalHydroSeasonalRegion, HYDRO_SEASONAL_SHARES } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "british-columbia";
const SOURCE_URL = "https://www.bchydro.com/";

async function run({ probe = true } = {}): Promise<RegionData> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("BC Hydro annual reports do not expose machine-readable hourly spill data");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    return buildTypicalHydroSeasonalRegion(
      REGION_ID,
      0.5,
      HYDRO_SEASONAL_SHARES["british-columbia"],
      `Typical-shape fallback: BC Hydro annual reports live feed unavailable (${(err as Error).message}); spring snowmelt oversupply plus Site C ramp anchored at ~0.5 TWh/yr.`,
      "2024",
    );
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback(REGION_ID, () => run())
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => { console.error("british-columbia loader failed", err); process.exit(1); });
}

export const buildBritishColumbiaData = () => run({ probe: false });
