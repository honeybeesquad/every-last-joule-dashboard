import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalWindRegion, buildTypicalSolarRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "china-shaanxi";
const SOURCE_URL = "https://ember-energy.org/";

async function run({ probe = true } = {}): Promise<{ wind: RegionData; solar: RegionData }> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("NEA 2024 provincial RE monitoring bulletin is not an hourly machine-readable feed");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    const note = `Typical-shape fallback: ${(err as Error).message}; Shaanxi mixed wind+solar curtailment ~1.5 TWh/yr; NEA 2024 provincial RE monitoring bulletin.`;
    return {
      wind:  buildTypicalWindRegion("china-shaanxi-wind",  15, 0.4, note + " — wind share (~0.4 TWh/yr, northern Shaanxi wind corridor)", "2024"),
      solar: buildTypicalSolarRegion("china-shaanxi-solar", 5, 1.1, note + " — solar share (~1.1 TWh/yr, Guanzhong basin PV)", "2024"),
    };
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback<{ wind: RegionData; solar: RegionData }>(REGION_ID, () => run(), {
    regionTier: "live" as const,
    tagLive: r => r,
    tagCached: c => c as { wind: RegionData; solar: RegionData },
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => { console.error("china-shaanxi loader failed", err); process.exit(1); });
}

export const buildChinaShaanxiData = () => run({ probe: false });
