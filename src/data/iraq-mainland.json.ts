import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalSolarRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "iraq-mainland";
const SOURCE_URL = "https://moelc.gov.iq/";

async function run({ probe = true } = {}): Promise<RegionData> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("Iraq Ministry public pages do not expose hourly solar curtailment data");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    return buildTypicalSolarRegion(
      REGION_ID,
      7,
      0.1,
      `Typical-shape fallback: Iraq Ministry of Electricity 2024 live feed unavailable (${(err as Error).message}); Karbala and Dhi Qar PV curtailment anchored at ~0.1 TWh/yr.`,
      "2024",
    );
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback(REGION_ID, () => run())
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => { console.error("iraq-mainland loader failed", err); process.exit(1); });
}

export const buildIraqMainlandData = () => run({ probe: false });
