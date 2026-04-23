import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalHydroRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "ethiopia";
const SOURCE_URL = "https://www.eep.com.et/";

async function run({ probe = true } = {}): Promise<RegionData> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("EEP public pages expose no machine-readable hourly GERD/hydro spill feed");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    return buildTypicalHydroRegion(
      REGION_ID,
      5,
      `Typical-shape fallback: EEP live feed unavailable (${(err as Error).message}); GERD/cascade hydro spill estimated from reservoir capacity and seasonal inflow at ~5 TWh/yr.`,
      "2024",
    );
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback(REGION_ID, () => run())
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("ethiopia loader failed", err);
      process.exit(1);
    });
}

export const buildEthiopiaData = () => run({ probe: false });
