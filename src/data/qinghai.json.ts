import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalSolarRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "qinghai";
const SOURCE_URL = "https://ember-energy.org/";

async function run({ probe = true } = {}): Promise<RegionData> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("Ember/NEA Qinghai references do not expose hourly solar curtailment");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    return buildTypicalSolarRegion(
      REGION_ID,
      5,
      1.5,
      `Typical-shape fallback: Ember GER 2025 / NEA live feed unavailable (${(err as Error).message}); Haixi solar corridor curtailment anchored at ~1.5 TWh/yr.`,
      "2024",
    );
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback(REGION_ID, () => run())
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => { console.error("qinghai loader failed", err); process.exit(1); });
}

export const buildQinghaiData = () => run({ probe: false });
