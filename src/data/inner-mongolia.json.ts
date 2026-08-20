import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildChinaRegionFromAnchor } from "../lib/chinaParse.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "inner-mongolia";
const SOURCE_URL = "https://www.nea.gov.cn/";

async function run({ probe = true } = {}): Promise<{ wind: RegionData; solar: RegionData }> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("NEA provincial RE monitoring bulletin is not exposed as an hourly machine-readable feed");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    const note = `Typical-shape fallback: NEA 2024 provincial RE monitoring bulletin / live hourly feed unavailable (${(err as Error).message}); Inner Mongolia wind+solar curtailment anchored at ~8.0 TWh/yr wind + ~4.6 TWh/yr solar.`;
    return {
      wind:  buildChinaRegionFromAnchor(
        "inner-mongolia-wind", "wind", 15, 8.0,
        note + " — wind (largest wind base in China)",
      ),
      solar: buildChinaRegionFromAnchor(
        "inner-mongolia-solar", "solar", 5, 4.6,
        note + " — solar (growing PV in Ordos/Baotou)",
      ),
    };
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback<{ wind: RegionData; solar: RegionData }>(REGION_ID, () => run(), {
    regionTier: "estimated" as const,
    tagLive: r => r,
    tagCached: c => c as { wind: RegionData; solar: RegionData },
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => { console.error("inner-mongolia loader failed", err); process.exit(1); });
}

export const buildInnerMongoliaData = () => run({ probe: false });
