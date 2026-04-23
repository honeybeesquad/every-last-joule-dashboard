import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalWindRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "inner-mongolia";
const SOURCE_URL = "https://ember-energy.org/";

async function run({ probe = true } = {}): Promise<RegionData> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("Ember/NEA China province curtailment references are not exposed as hourly machine-readable feeds");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    return buildTypicalWindRegion(
      REGION_ID,
      15,
      4.0,
      `Typical-shape fallback: Ember Global Electricity Review 2025 / NEA live hourly feed unavailable (${(err as Error).message}); Inner Mongolia wind transmission-limited curtailment anchored at ~4.0 TWh/yr.`,
      "2024",
    );
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback(REGION_ID, () => run())
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => { console.error("inner-mongolia loader failed", err); process.exit(1); });
}

export const buildInnerMongoliaData = () => run({ probe: false });
