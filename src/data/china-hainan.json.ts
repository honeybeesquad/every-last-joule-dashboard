import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildChinaRegionFromAnchor } from "../lib/chinaParse.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "china-hainan";
const SOURCE_URL = "https://ember-energy.org/";

async function run({ probe = true } = {}): Promise<RegionData> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("NEA 2024 provincial RE monitoring bulletin is not an hourly machine-readable feed");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    // Anchor store keys are per-fuel (china-hainan-solar); the region id is china-hainan.
    const r = buildChinaRegionFromAnchor(
      "china-hainan-solar", "solar", 4, 0.01,
      `Typical-shape fallback, used only when data/china-anchors.json has no anchor for this region (the store anchor uses the monitoring-centre bulletin trailing-12-month rate; see src/lib/regions.ts): ${(err as Error).message}; Hainan solar curtailment ~0.01 TWh/yr; NEA 2024 provincial RE monitoring bulletin (99.8% PV utilisation; near-zero).`,
    );
    return { ...r, regionId: REGION_ID };
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback(REGION_ID, () => run())
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => { console.error("china-hainan loader failed", err); process.exit(1); });
}

export const buildChinaHainanData = () => run({ probe: false });
