import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalMixedRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "india-west";
const SOURCE_URL = "https://wrldc.in/";

async function run({ probe = true } = {}): Promise<RegionData> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("WRLDC public reports do not expose stable unauthenticated hourly renewable curtailment data");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    return buildTypicalMixedRegion(
      REGION_ID,
      1.0,
      { solar: 0.65, wind: 0.35 },
      `Typical-shape fallback: WRLDC 2024 live feed unavailable (${(err as Error).message}); Gujarat Khavda plus Maharashtra solar/wind curtailment anchored at ~1.0 TWh/yr.`,
      "2024",
      6.5,
      15,
    );
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback(REGION_ID, () => run())
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => { console.error("india-west loader failed", err); process.exit(1); });
}

export const buildIndiaWestData = () => run({ probe: false });
