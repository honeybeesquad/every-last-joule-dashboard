import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalHydroSeasonalRegion, HYDRO_SEASONAL_SHARES } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "yunnan";
const SOURCE_URL = "https://www.iea.org/";

async function run({ probe = true } = {}): Promise<RegionData> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("IEA/NEA Yunnan hydro spill references are annual or quarterly, not hourly machine-readable");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    return buildTypicalHydroSeasonalRegion(
      REGION_ID,
      10.0,
      HYDRO_SEASONAL_SHARES.yunnan,
      `Typical-shape fallback: IEA China Energy Outlook / NEA live feed unavailable (${(err as Error).message}); Lancang River monsoon hydro spill anchored at ~10.0 TWh/yr.`,
      "2024",
    );
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback(REGION_ID, () => run())
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => { console.error("yunnan loader failed", err); process.exit(1); });
}

export const buildYunnanData = () => run({ probe: false });
