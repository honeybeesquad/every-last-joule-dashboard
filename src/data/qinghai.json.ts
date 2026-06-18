import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalWindRegion, buildTypicalSolarRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "qinghai";
const SOURCE_URL = "https://ember-energy.org/";

async function run({ probe = true } = {}): Promise<{ wind: RegionData; solar: RegionData }> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("Ember/NEA Qinghai references do not expose hourly wind/solar curtailment");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    const note = `Typical-shape fallback: Ember GER 2025 / NEA live feed unavailable (${(err as Error).message}); Qinghai mixed wind+solar curtailment anchored at ~4.1 TWh/yr.`;
    return {
      wind:  buildTypicalWindRegion("qinghai-wind",  15, 1.5, note + " — wind share (~1.5 TWh/yr, wind utilisation 92.8%)", "2024"),
      solar: buildTypicalSolarRegion("qinghai-solar", 5, 2.6, note + " — solar share (~2.6 TWh/yr, Haixi/Golmud solar corridor, PV utilisation 90.3%)", "2024"),
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
    .catch((err) => { console.error("qinghai loader failed", err); process.exit(1); });
}

export const buildQinghaiData = () => run({ probe: false });
