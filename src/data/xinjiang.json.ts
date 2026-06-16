import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalWindRegion, buildTypicalSolarRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "xinjiang";
const SOURCE_URL = "https://ember-energy.org/";

async function run({ probe = true } = {}): Promise<{ wind: RegionData; solar: RegionData }> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("NEA 2024 renewable monitoring evaluation + Huaon/NBS generation by fuel is not an hourly machine-readable feed");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    const note = `Typical-shape fallback: ${(err as Error).message}; Xinjiang mixed wind+solar curtailment ~8.2 TWh/yr; NEA 2024 renewable monitoring evaluation.`;
    return {
      wind:  buildTypicalWindRegion("xinjiang-wind",  15, 5.0, note + " — wind share (~5.0 TWh/yr, Xinjiang wind utilisation 93.4%; Huaon 70.79 TWh gen)", "2024"),
      solar: buildTypicalSolarRegion("xinjiang-solar", 6.33, 3.2, note + " — solar share (~3.2 TWh/yr, Xinjiang PV utilisation 92.2%; Huaon 38.04 TWh gen)", "2024"),
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
    .catch((err) => { console.error("xinjiang loader failed", err); process.exit(1); });
}

export const buildXinjiangData = () => run({ probe: false });
