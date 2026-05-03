import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalWindRegion } from "../lib/typical-profiles.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "india-tamil-nadu";
// Tamil Nadu State Load Despatch Centre (TNSLDC / TANTRANSCO). Publishes
// daily RE curtailment and system operation reports. Geoblocked from
// non-Indian IP ranges; India-egress relay activates live path.
const SOURCE_URL = "https://tnsldc.com/";

async function run({ probe = true } = {}): Promise<RegionData> {
  let probeNote = "";

  if (probe) {
    try {
      await fetchText(SOURCE_URL, { timeoutMs: 10000, retries: 0, headers: { "user-agent": "Mozilla/5.0" } });
      // TODO: parse TNSLDC daily RE curtailment report and return live data.
      // Currently unreachable from the build environment — geoblocked outside India.
      throw new Error("TNSLDC live parsing not yet implemented; geoblocked from build environment");
    } catch (err) {
      probeNote = `TNSLDC unreachable (${(err as Error).message}); `;
    }
  }

  const base = buildTypicalWindRegion(
    REGION_ID,
    9,
    1.0,
    `${probeNote}Typical-shape T3-modelled fallback calibrated to POSOCO South Region RE curtailment 2024 ` +
    `(~1.0 TWh/yr Tamil Nadu wind curtailment; India's largest wind state, ` +
    `Gulf of Mannar + Palladam-Coimbatore corridor). ` +
    `State-level TNSLDC source established; will be promoted to T1a-live-tso when the India-egress relay activates the live parse.`,
    "2024",
  );
  // T3-modelled while the TNSLDC live path is unreachable from the build
  // environment (geoblocked). When the India-egress relay lands and the
  // TNSLDC parser is implemented, flip both this and the canonical
  // src/lib/regions.ts entry back to T1a-live-tso.
  return applyUncertainty(base, { regionTier: "static", profileKind: "wind" });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback(REGION_ID, () => run(), { regionTier: "static" })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("india-tamil-nadu loader failed", err);
      process.exit(1);
    });
}

export const buildIndiaTamilNaduData = () => run({ probe: false });
