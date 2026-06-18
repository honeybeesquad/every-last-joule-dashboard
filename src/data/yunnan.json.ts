import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalWindRegion, buildTypicalSolarRegion, buildTypicalHydroSeasonalRegion, HYDRO_SEASONAL_SHARES } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "yunnan";
const SOURCE_URL = "https://www.iea.org/";

async function run({ probe = true } = {}): Promise<{ wind: RegionData; solar: RegionData; hydro: RegionData }> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("IEA/NEA Yunnan wind/solar/hydro spill references are annual or quarterly, not hourly machine-readable");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    const note = `Typical-shape fallback: IEA China Energy Outlook / NEA live feed unavailable (${(err as Error).message});`;
    return {
      wind:  buildTypicalWindRegion("yunnan-wind",  15, 0.9, note + " Yunnan wind curtailment ~0.9 TWh/yr (wind utilisation 99.1%).", "2024"),
      solar: buildTypicalSolarRegion("yunnan-solar", 5, 0.9, note + " Yunnan solar curtailment ~0.9 TWh/yr (PV utilisation 96.7%).", "2024"),
      hydro: buildTypicalHydroSeasonalRegion(REGION_ID, 10.0, HYDRO_SEASONAL_SHARES.yunnan, note + " Lancang River monsoon hydro spill anchored at ~10.0 TWh/yr.", "2024"),
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
    .catch((err) => { console.error("yunnan loader failed", err); process.exit(1); });
}

export const buildYunnanData = () => run({ probe: false });
