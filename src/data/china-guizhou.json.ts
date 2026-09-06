import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalSolarRegion, buildTypicalHydroRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "china-guizhou";
const SOURCE_URL = "https://ember-energy.org/";

async function run({ probe = true } = {}): Promise<{ solar: RegionData; hydro: RegionData }> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("NEA 2024 provincial RE monitoring bulletin is not an hourly machine-readable feed");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    const note = `Typical-shape fallback: ${(err as Error).message}; Guizhou mixed solar+hydro curtailment ~0.25 TWh/yr; NEA 2024 provincial RE monitoring bulletin.`;
    return {
      solar: buildTypicalSolarRegion("china-guizhou-solar", 5, 0.25 * 0.5, note + " — solar share (50%)", "2024"),
      hydro: {
        ...buildTypicalHydroRegion("china-guizhou-hydro", 0.25 * 0.5, note + " — hydro share (50%)", "2024"),
        sourceStatus: "cached" as const,
        sourceProvenance: "modelled-fallback" as const,
      },
    };
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback<{ solar: RegionData; hydro: RegionData }>(REGION_ID, () => run(), {
    regionTier: "estimated" as const,
    tagLive: r => r,
    tagCached: c => c as { solar: RegionData; hydro: RegionData },
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => { console.error("china-guizhou loader failed", err); process.exit(1); });
}

export const buildChinaGuizhouData = () => run({ probe: false });
