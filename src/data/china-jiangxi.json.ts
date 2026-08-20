import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildChinaRegionFromAnchor } from "../lib/chinaParse.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "china-jiangxi";
const SOURCE_URL = "https://ember-energy.org/";

async function run({ probe = true } = {}): Promise<RegionData> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("NEA 2024 provincial RE monitoring bulletin is not an hourly machine-readable feed");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    const note = `Typical-shape fallback: ${(err as Error).message}; Jiangxi solar curtailment ~0.4 TWh/yr; NEA 2024 provincial RE monitoring bulletin (99.0% PV utilisation, 25+ GW distributed solar).`;
    // Anchor store keys are per-fuel (china-jiangxi-solar); the region id is china-jiangxi.
    const r = buildChinaRegionFromAnchor("china-jiangxi-solar", "solar", 4, 0.4, note);
    return { ...r, regionId: REGION_ID };
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback(REGION_ID, () => run())
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => { console.error("china-jiangxi loader failed", err); process.exit(1); });
}

export const buildChinaJiangxiData = () => run({ probe: false });
