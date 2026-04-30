import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalSolarRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "kurdistan";
const SOURCE_URL = "https://gov.krd/moel-en/";

async function run({ probe = true } = {}): Promise<RegionData> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("KRG Ministry public pages do not expose hourly solar curtailment data");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    return buildTypicalSolarRegion(
      REGION_ID,
      7,
      0.05,
      `Typical-shape fallback: KRG Ministry of Electricity live feed unavailable (${(err as Error).message}); nominal Kurdistan solar curtailment anchored at ~0.05 TWh/yr.`,
      "2024",
    );
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback(REGION_ID, () => run())
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => { console.error("kurdistan loader failed", err); process.exit(1); });
}

export const buildKurdistanData = () => run({ probe: false });
