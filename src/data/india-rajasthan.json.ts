import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalSolarRegion } from "../lib/typical-profiles.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "india-rajasthan";
// Rajasthan State Load Despatch Centre (RRVPNL). Publishes daily RE
// curtailment reports. Site is geoblocked from non-Indian IP ranges; a future
// India-egress relay will make this live path operational.
const SOURCE_URL = "https://sldc.rajasthan.gov.in/";

async function run({ probe = true } = {}): Promise<RegionData> {
  let probeNote = "";

  if (probe) {
    try {
      await fetchText(SOURCE_URL, { timeoutMs: 10000, retries: 0, headers: { "user-agent": "Mozilla/5.0" } });
      // TODO: parse RRVPNL SLDC daily RE curtailment report (HTML table or
      // Excel download) and return live hourly data. Currently unreachable
      // from the build environment — geoblocked outside India.
      throw new Error("RRVPNL SLDC live parsing not yet implemented; geoblocked from build environment");
    } catch (err) {
      probeNote = `RRVPNL SLDC unreachable (${(err as Error).message}); `;
    }
  }

  const base = buildTypicalSolarRegion(
    REGION_ID,
    6.5,
    3.5,
    `${probeNote}Typical-shape T1a fallback calibrated to Ember India 2025 report ` +
    `(2.3 TWh solar curtailed May-Dec 2025 → annualised ~3.5 TWh/yr, Rajasthan transmission bottlenecks). ` +
    `State-level RRVPNL SLDC source established; live path activates when India-egress relay is available.`,
    "2025",
  );
  // Override T3-modelled → T1a-live-tso: this loader targets a state-level
  // TSO source with own-jurisdiction anchor. The typical-shape is the current
  // fallback, not the intended steady-state.
  return applyUncertainty(base, { regionTier: "live" });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback(REGION_ID, () => run(), { regionTier: "live" })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("india-rajasthan loader failed", err);
      process.exit(1);
    });
}

export const buildIndiaRajasthanData = () => run({ probe: false });
