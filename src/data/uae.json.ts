import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalSolarRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "uae";
const SOURCE_URL = "https://www.dewa.gov.ae/";

async function run({ probe = true } = {}): Promise<RegionData> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("DEWA/EWEC public pages do not expose hourly solar curtailment");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    return buildTypicalSolarRegion(
      REGION_ID,
      8,
      0.3,
      "No public hourly curtailment feed; DEWA/EWEC public pages do not expose hourly solar curtailment. Calibration anchor ~0.3 TWh/yr (200–330 GWh) solar curtailment driven by Al Dhafra 2 GW solar + 5.6 GW Barakah nuclear baseload duck-curve. Sources: EWEC Statistical Report 2023/2024; Abu Dhabi DoE Technical Report 2023; IEA Electricity 2026. T3-modelled, ±40% envelope.",
      "2025",
    );
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback(REGION_ID, () => run())
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => { console.error("uae loader failed", err); process.exit(1); });
}

export const buildUaeData = () => run({ probe: false });
