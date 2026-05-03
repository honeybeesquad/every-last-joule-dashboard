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
    `${probeNote}Typical-shape T3-modelled fallback calibrated to POSOCO/Ember India 2024 ` +
    `(~1.0 TWh/yr solar curtailment, Gujarat Khavda-Kutch transmission bottlenecks). ` +
    `State-level GSLDC source established; will be promoted to T1a-live-tso when the India-egress relay activates the live parse.`,
    "2024",
  );
  // T3-modelled while the GSLDC live path is unreachable from the build
  // environment (geoblocked). When the India-egress relay lands and the
  // GSLDC parser is implemented, flip both this and the canonical
  // src/lib/regions.ts entry back to T1a-live-tso.
  return applyUncertainty(base, { regionTier: "static", profileKind: "solar" });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback(REGION_ID, () => run(), { regionTier: "static" })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("india-gujarat loader failed", err);
      process.exit(1);
    });
}

export const buildIndiaGujaratData = () => run({ probe: false });
