import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalMixedRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "manitoba";
const SOURCE_URL = "https://www.hydro.mb.ca/";

async function run({ probe = true } = {}): Promise<RegionData> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("Manitoba Hydro corporate reports do not expose hourly wind/hydro curtailment data");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    return buildTypicalMixedRegion(
      REGION_ID,
      0.2,
      { wind: 0.6, hydro: 0.4 },
      `Typical-shape fallback: Manitoba Hydro corporate reports live feed unavailable (${(err as Error).message}); wind plus hydro curtailment anchored at ~0.2 TWh/yr.`,
      "2024",
      18,
      15,
    );
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback(REGION_ID, () => run())
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => { console.error("manitoba loader failed", err); process.exit(1); });
}

export const buildManitobaData = () => run({ probe: false });
