import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildChinaRegionFromAnchor } from "../lib/chinaParse.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "ningxia";
const SOURCE_URL = "https://ember-energy.org/";

async function run({ probe = true } = {}): Promise<{ wind: RegionData; solar: RegionData }> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("NEA provincial wind/solar curtailment statistics are quarterly, not hourly machine-readable");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    const note = `Typical-shape fallback: Ember GER 2025 / NEA quarterly statistics unavailable as hourly feed (${(err as Error).message}); Ningxia wind+solar curtailment anchored at ~1.0 TWh/yr.`;
    return {
      wind:  buildChinaRegionFromAnchor(
        "ningxia-wind", "wind", 15, 1.0 * 0.5,
        note + " — wind share (50%)",
      ),
      solar: buildChinaRegionFromAnchor(
        "ningxia-solar", "solar", 4.5, 1.0 * 0.5,
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
    .catch((err) => { console.error("ningxia loader failed", err); process.exit(1); });
}

export const buildNingxiaData = () => run({ probe: false });
