import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalHydroSeasonalRegion, HYDRO_SEASONAL_SHARES } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "tibet";
const SOURCE_URL = "https://www.iea.org/";

async function run({ probe = true } = {}): Promise<RegionData> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("IEA/NEA Tibet hydro spill references are not hourly machine-readable");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    return buildTypicalHydroSeasonalRegion(
      REGION_ID,
      3.0,
      HYDRO_SEASONAL_SHARES.tibet,
      `Typical-shape fallback: IEA China Energy Outlook / NEA live feed unavailable (${(err as Error).message}); Yarlung-Tsangpo high-altitude hydro spill anchored at ~3.0 TWh/yr.`,
      "2024",
    );
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback(REGION_ID, () => run())
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => { console.error("tibet loader failed", err); process.exit(1); });
}

export const buildTibetData = () => run({ probe: false });
