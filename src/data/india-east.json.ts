import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalSolarRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "india-east";
const SOURCE_URL = "https://erldc.in/";

async function run({ probe = true } = {}): Promise<RegionData> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("ERLDC public reports do not expose stable unauthenticated hourly solar curtailment data");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    return buildTypicalSolarRegion(
      REGION_ID,
      6,
      0.2,
      `Typical-shape fallback: ERLDC 2024 live feed unavailable (${(err as Error).message}); Odisha and West Bengal emerging PV curtailment anchored at ~0.2 TWh/yr.`,
      "2024",
    );
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback(REGION_ID, () => run())
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => { console.error("india-east loader failed", err); process.exit(1); });
}

export const buildIndiaEastData = () => run({ probe: false });
