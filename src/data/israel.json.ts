import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalSolarRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "israel";
const SOURCE_URL = "https://www.noga-iso.co.il/";

async function run({ probe = true } = {}): Promise<RegionData> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("Noga/IEC public pages do not expose hourly solar curtailment");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    return buildTypicalSolarRegion(
      REGION_ID,
      10,
      1.2,
      `Typical-shape fallback: Israel live feed unavailable (${(err as Error).message}); calibration anchor ~1.2 TWh/yr system-wide solar curtailment. Source: Israel Electricity Authority (PUA) 2024 Status Report — ~1.5 pp shortfall between potential (16.2%) and actual consumed (14.7%) renewable generation; Noga-ISO corporate responsibility reports 2023–2024.`,
      "2024",
    );
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback(REGION_ID, () => run())
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => { console.error("israel loader failed", err); process.exit(1); });
}

export const buildIsraelData = () => run({ probe: false });
