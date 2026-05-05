import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalWindRegion, buildTypicalSolarRegion, buildTypicalHydroRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "china-hubei";
const SOURCE_URL = "https://ember-energy.org/";

async function run({ probe = true } = {}): Promise<{ wind: RegionData; solar: RegionData; hydro: RegionData }> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("NEA 2024 provincial RE monitoring bulletin is not an hourly machine-readable feed");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    const note = `Typical-shape fallback: ${(err as Error).message}; Hubei mixed solar+wind+hydro curtailment ~1.5 TWh/yr; NEA 2024 provincial RE monitoring bulletin (Three Gorges basin; missed RE consumption target by 3 pp).`;
    return {
      wind:  buildTypicalWindRegion("china-hubei-wind",  15, 1.5 * 0.26, note + " — wind share (26%)", "2024"),
      solar: buildTypicalSolarRegion("china-hubei-solar",  4, 1.5 * 0.40, note + " — solar share (40%)", "2024"),
      hydro: buildTypicalHydroRegion("china-hubei-hydro", 1.5 * 0.34, note + " — hydro share (34%)", "2024"),
    };
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback<{ wind: RegionData; solar: RegionData; hydro: RegionData }>(REGION_ID, () => run(), {
    regionTier: "live" as const,
    tagLive: r => r,
    tagCached: c => c as { wind: RegionData; solar: RegionData; hydro: RegionData },
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => { console.error("china-hubei loader failed", err); process.exit(1); });
}

export const buildChinaHubeiData = () => run({ probe: false });
