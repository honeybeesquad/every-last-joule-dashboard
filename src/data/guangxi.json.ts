import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalWindRegion, buildTypicalSolarRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "guangxi";
const SOURCE_URL = "https://www.nea.gov.cn/";

async function run({ probe = true } = {}): Promise<{ wind: RegionData; solar: RegionData }> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("NEA provincial RE monitoring bulletin is not exposed as an hourly machine-readable feed");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    const note = `Typical-shape fallback: NEA 2024 provincial RE monitoring bulletin / live hourly feed unavailable (${(err as Error).message}); Guangxi wind+solar curtailment anchored at ~0.2 TWh/yr wind + ~0.3 TWh/yr solar.`;
    return {
      wind:  buildTypicalWindRegion("guangxi-wind",  15, 0.2, note + " — wind (coastal/mountain wind, CSG grid)", "2024"),
      solar: buildTypicalSolarRegion("guangxi-solar", 5, 0.3, note + " — solar (growing PV in Nanning/Guilin corridor)", "2024"),
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
    .catch((err) => { console.error("guangxi loader failed", err); process.exit(1); });
}

export const buildGuangxiData = () => run({ probe: false });
