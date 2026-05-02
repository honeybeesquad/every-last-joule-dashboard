import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalMixedRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "china-hubei";
const SOURCE_URL = "https://ember-energy.org/";

async function run({ probe = true } = {}): Promise<RegionData> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("NEA 2024 provincial RE monitoring bulletin is not an hourly machine-readable feed");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    return buildTypicalMixedRegion(
      REGION_ID,
      1.5,
      { solar: 0.4, wind: 0.26, hydro: 0.34 },
      `Typical-shape fallback: ${(err as Error).message}; Hubei mixed solar+wind+hydro curtailment ~1.5 TWh/yr; NEA 2024 provincial RE monitoring bulletin (Three Gorges basin; missed RE consumption target by 3 pp).`,
      "2024",
      4,
      15,
    );
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback(REGION_ID, () => run())
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => { console.error("china-hubei loader failed", err); process.exit(1); });
}

export const buildChinaHubeiData = () => run({ probe: false });
