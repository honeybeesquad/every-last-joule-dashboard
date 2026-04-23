import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalSolarRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "wa-swis";
const SOURCE_URL = "https://data.wa.aemo.com.au/";
const PROBE_URLS = [
  "https://data.wa.aemo.com.au/public/market-data/wem/",
  "https://aemo.com.au/energy-systems/electricity/wholesale-electricity-market-wem/data-wem/data-dashboard-wem",
  SOURCE_URL,
];

async function run({ probe = true } = {}): Promise<RegionData> {
  try {
    if (probe) {
      for (const url of PROBE_URLS) {
        await fetchText(url, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      }
      throw new Error("AEMO WA public pages do not expose a machine-readable FACILITY_SCADA curtailment feed");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    const data = buildTypicalSolarRegion(
      REGION_ID,
      4,
      0.4,
      `Typical-shape fallback: AEMO WA WEM live feed unavailable (${(err as Error).message}); calibration anchor ~0.4 TWh/yr solar + wind curtailment.`,
      "2024",
    );
    return {
      ...data,
      fuelShare: { solar: 0.7, wind: 0.3 },
      sourceNote: `${data.sourceNote} fuelShare: solar 70% / wind 30% typical SWIS renewable mix.`,
    };
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback(REGION_ID, () => run())
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => { console.error("wa-swis loader failed", err); process.exit(1); });
}

export const buildWaSwisData = () => run({ probe: false });
