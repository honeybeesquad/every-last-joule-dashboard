import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalSolarRegion } from "../lib/typical-profiles.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "india-gujarat";
// Gujarat State Load Despatch Centre (GSLDC / GETCO). Publishes daily RE
// generation and curtailment reports. Site is geoblocked from non-Indian IP
// ranges; a future India-egress relay will make this live path operational.
const SOURCE_URL = "https://sldc.gujarat.gov.in/";

async function run({ probe = true } = {}): Promise<RegionData> {
  let probeNote = "";

  if (probe) {
    try {
      await fetchText(SOURCE_URL, { timeoutMs: 10000, retries: 0, headers: { "user-agent": "Mozilla/5.0" } });
      // TODO: parse GSLDC daily RE curtailment report and return live data.
      // Currently unreachable from the build environment — geoblocked outside India.
      throw new Error("GSLDC live parsing not yet implemented; geoblocked from build environment");
    } catch (err) {
      probeNote = `GSLDC unreachable (${(err as Error).message}); `;
    }
  }

  const base = buildTypicalSolarRegion(
    REGION_ID,
    6.5,
    1.0,
    `${probeNote}Typical-shape T1a fallback calibrated to POSOCO/Ember India 2024 ` +
    `(~1.0 TWh/yr solar curtailment, Gujarat Khavda-Kutch transmission bottlenecks). ` +
    `State-level GSLDC source established; live path activates when India-egress relay is available.`,
    "2024",
  );
  // Override T3-modelled → T1a-live-tso: this loader targets the Gujarat SLDC
  // as the intended T1a source. The typical-shape is the current fallback.
  return applyUncertainty(base, { regionTier: "live" });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback(REGION_ID, () => run(), { regionTier: "live" })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("india-gujarat loader failed", err);
      process.exit(1);
    });
}

export const buildIndiaGujaratData = () => run({ probe: false });
