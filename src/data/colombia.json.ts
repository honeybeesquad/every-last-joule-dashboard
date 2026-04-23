import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalHydroSeasonalRegion, HYDRO_SEASONAL_SHARES } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "colombia";
const SOURCE_URL = "https://www.xm.com.co/";

async function run({ probe = true } = {}): Promise<RegionData> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("XM / UPME data is publicly available only as monthly bulletins; hourly spill is not machine-readable");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    return buildTypicalHydroSeasonalRegion(
      REGION_ID,
      1.0,
      HYDRO_SEASONAL_SHARES.colombia,
      `Typical bimodal hydro fallback: XM / UPME data is publicly available only as monthly bulletins; hourly spill is not machine-readable (${(err as Error).message}); El Nino-driven hydro spill on 70% hydro grid anchored at ~1.0 TWh/yr.`,
      "2024",
    );
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback(REGION_ID, () => run())
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => { console.error("colombia loader failed", err); process.exit(1); });
}

export const buildColombiaData = () => run({ probe: false });
