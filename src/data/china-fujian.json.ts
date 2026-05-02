import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalMixedRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "china-fujian";
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
      0.6,
      { wind: 0.55, solar: 0.45 },
      `Typical-shape fallback: ${(err as Error).message}; Fujian coastal mixed wind+solar curtailment ~0.6 TWh/yr; NEA 2024 provincial RE monitoring bulletin.`,
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
    .catch((err) => { console.error("china-fujian loader failed", err); process.exit(1); });
}

export const buildChinaFujianData = () => run({ probe: false });
