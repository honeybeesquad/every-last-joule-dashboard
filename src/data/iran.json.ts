import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalSolarRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "iran";
const SOURCE_URL = "https://www.tavanir.org.ir/";

async function run({ probe = true } = {}): Promise<RegionData> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("TAVANIR public data is opaque and does not expose hourly solar curtailment");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    return buildTypicalSolarRegion(
      REGION_ID,
      7,
      0.3,
      "No public hourly curtailment feed; TAVANIR 2024 opaque public data, Yazd/Kerman solar curtailment anchored at ~0.3 TWh/yr × typical solar profile shape (T3-modelled, ±40% envelope).",
      "2024",
    );
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback(REGION_ID, () => run())
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => { console.error("iran loader failed", err); process.exit(1); });
}

export const buildIranData = () => run({ probe: false });
