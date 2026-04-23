import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalWindRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "mongolia";
const SOURCE_URL = "https://nptg.mn/";

async function run({ probe = true } = {}): Promise<RegionData> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("NPTG public pages do not expose hourly wind curtailment data");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    return buildTypicalWindRegion(
      REGION_ID,
      15,
      0.15,
      `Typical-shape fallback: NPTG 2024 live feed unavailable (${(err as Error).message}); Salkhit and Tsetsii wind cluster curtailment anchored at ~0.15 TWh/yr.`,
      "2024",
    );
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback(REGION_ID, () => run())
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => { console.error("mongolia loader failed", err); process.exit(1); });
}

export const buildMongoliaData = () => run({ probe: false });
