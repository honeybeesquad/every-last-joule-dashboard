import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalWindRegion, buildTypicalSolarRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "sichuan";
const SOURCE_URL = "https://ember-energy.org/";

async function run({ probe = true } = {}): Promise<{ wind: RegionData; solar: RegionData }> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("NEA 2024 provincial RE monitoring bulletin is not an hourly machine-readable feed");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    const note = `Typical-shape fallback: ${(err as Error).message}; Sichuan wind+solar curtailment ~0.4 TWh/yr; NEA 2024 provincial RE monitoring bulletin (hydro-dominant grid).`;
    return {
      wind:  buildTypicalWindRegion("sichuan-wind",  15, 0.1, note + " — wind share (~0.1 TWh/yr, limited wind capacity in hydro-dominant grid)", "2024"),
      solar: buildTypicalSolarRegion("sichuan-solar", 5, 0.3, note + " — solar share (~0.3 TWh/yr, growing distributed PV in Chengdu basin)", "2024"),
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
    .catch((err) => { console.error("sichuan loader failed", err); process.exit(1); });
}

export const buildSichuanData = () => run({ probe: false });
