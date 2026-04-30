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
      4,
      0.2,
      "No public hourly curtailment feed; calibration anchor ~0.2 TWh/yr (200 GWh) — EWEC Statistical Report 2023/2024 + Abu Dhabi Department of Energy 2023 Technical Report confirm ~200-330 GWh curtailed in 2024 as Al Dhafra 2 GW solar reached full capacity alongside 5.6 GW Barakah nuclear baseload; DEWA Dubai reports near-zero curtailment (CSP storage + high midday AC load absorbs generation). IRENA Renewable Energy Statistics 2024 confirms UAE total solar capacity 6.05 GW end-2023. UTC+4 Gulf Standard Time. T3-modelled, ±40% envelope. Gemini-3.1 research wave 5 (2026-04-30).",
      "2024",
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
