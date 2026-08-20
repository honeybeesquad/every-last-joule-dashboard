import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildChinaRegionFromAnchor } from "../lib/chinaParse.js";
import { buildTypicalHydroRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "china-hunan";
const SOURCE_URL = "https://ember-energy.org/";

async function run({ probe = true } = {}): Promise<{ wind: RegionData; solar: RegionData; hydro: RegionData }> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("NEA 2024 provincial RE monitoring bulletin is not an hourly machine-readable feed");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    const note = `Typical-shape fallback: ${(err as Error).message}; Hunan mixed wind+solar+hydro curtailment ~1.9 TWh/yr; NEA 2024 provincial RE monitoring bulletin.`;
    return {
      wind:  buildChinaRegionFromAnchor(
        "china-hunan-wind", "wind", 15, 1.9 * 0.5,
        note + " — wind share (50%)",
      ),
      solar: buildChinaRegionFromAnchor(
        "china-hunan-solar", "solar", 4, 1.9 * 0.3,
        note + " — solar share (30%)",
      ),
      hydro: {
        ...buildTypicalHydroRegion("china-hunan-hydro", 1.9 * 0.2, note + " — hydro share (20%)", "2024"),
        sourceStatus: "cached" as const,
        sourceProvenance: "modelled-fallback" as const,
      },
    };
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback<{ wind: RegionData; solar: RegionData; hydro: RegionData }>(REGION_ID, () => run(), {
    regionTier: "estimated" as const,
    tagLive: r => r,
    tagCached: c => c as { wind: RegionData; solar: RegionData; hydro: RegionData },
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => { console.error("china-hunan loader failed", err); process.exit(1); });
}

export const buildChinaHunanData = () => run({ probe: false });
