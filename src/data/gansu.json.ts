import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildChinaRegionFromAnchor } from "../lib/chinaParse.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "gansu";
const SOURCE_URL = "https://ember-energy.org/";

async function run({ probe = true } = {}): Promise<{ wind: RegionData; solar: RegionData }> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("Ember/S&P/NEA China province curtailment references are not hourly machine-readable feeds");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    const note = `Typical-shape fallback: Ember GER 2025 + S&P Rising Curtailment in China 2024 / NEA feed unavailable (${(err as Error).message}); Jiuquan/Wuwei wind+solar curtailment anchored at ~3.0 TWh/yr.`;
    return {
      wind:  buildChinaRegionFromAnchor(
        "gansu-wind", "wind", 15, 3.0 * 0.6,
        note + " — wind share (60%)",
      ),
      solar: buildChinaRegionFromAnchor(
        "gansu-solar", "solar", 5, 3.0 * 0.4,
        note + " — solar share (40%)",
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
    .catch((err) => { console.error("gansu loader failed", err); process.exit(1); });
}

export const buildGansuData = () => run({ probe: false });
