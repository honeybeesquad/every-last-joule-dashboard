import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildChinaRegionFromAnchor } from "../lib/chinaParse.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "china-jiangsu";
const SOURCE_URL = "https://ember-energy.org/";

async function run({ probe = true } = {}): Promise<{ wind: RegionData; solar: RegionData }> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("NEA 2024 provincial RE monitoring bulletin is not an hourly machine-readable feed");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    const note = `Typical-shape fallback: ${(err as Error).message}; Jiangsu offshore wind + solar curtailment ~2.8 TWh/yr; NEA 2024 provincial RE monitoring bulletin.`;
    return {
      wind:  buildChinaRegionFromAnchor(
        "china-jiangsu-wind", "wind", 15, 2.8 * 0.5,
        note + " — wind share (50%)",
      ),
      solar: buildChinaRegionFromAnchor(
        "china-jiangsu-solar", "solar", 4, 2.8 * 0.5,
        note + " — solar share (50%)",
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
    .catch((err) => { console.error("china-jiangsu loader failed", err); process.exit(1); });
}

export const buildChinaJiangsuData = () => run({ probe: false });
