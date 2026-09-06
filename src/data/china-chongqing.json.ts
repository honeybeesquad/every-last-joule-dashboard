import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalSolarRegion, buildTypicalHydroRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "china-chongqing";
const SOURCE_URL = "https://ember-energy.org/";

async function run({ probe = true } = {}): Promise<{ hydro: RegionData; solar: RegionData }> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("NEA 2024 provincial RE monitoring bulletin is not an hourly machine-readable feed");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    const note = `Typical-shape fallback: ${(err as Error).message}; Chongqing mixed hydro+solar curtailment ~0.22 TWh/yr; NEA 2024 provincial RE monitoring bulletin (Yangtze basin).`;
    return {
      hydro: {
        ...buildTypicalHydroRegion("china-chongqing-hydro", 0.22 * 0.6, note + " — hydro share (60%)", "2024"),
        sourceStatus: "cached" as const,
        sourceProvenance: "modelled-fallback" as const,
      },
      solar: buildTypicalSolarRegion("china-chongqing-solar", 5, 0.22 * 0.4, note + " — solar share (40%)", "2024"),
    };
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback<{ hydro: RegionData; solar: RegionData }>(REGION_ID, () => run(), {
    regionTier: "estimated" as const,
    tagLive: r => r,
    tagCached: c => c as { hydro: RegionData; solar: RegionData },
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => { console.error("china-chongqing loader failed", err); process.exit(1); });
}

export const buildChinaChongqingData = () => run({ probe: false });
