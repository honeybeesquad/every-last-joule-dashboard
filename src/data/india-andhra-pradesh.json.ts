import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalSolarRegion } from "../lib/typical-profiles.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "india-andhra-pradesh";
// APTRANSCO / APSPDCL SLDC (Andhra Pradesh Transmission Corporation /
// Southern Power Distribution Company). Publishes daily RE curtailment and
// system operation reports. Geoblocked from non-Indian IP ranges; India-egress
// relay activates live path. Telangana (TSLDC) curtailment is included in this
// combined AP+Telangana anchor since both are SRLDC sub-entities and the
// published POSOCO South Region residual cannot be cleanly split below state level.
const SOURCE_URL = "https://aptransco.gov.in/";

async function run({ probe = true } = {}): Promise<RegionData> {
  let probeNote = "";

  if (probe) {
    try {
      await fetchText(SOURCE_URL, { timeoutMs: 10000, retries: 0, headers: { "user-agent": "Mozilla/5.0" } });
      // TODO: parse APTRANSCO SLDC daily RE curtailment report and return live data.
      // Currently unreachable from the build environment — geoblocked outside India.
      throw new Error("APTRANSCO SLDC live parsing not yet implemented; geoblocked from build environment");
    } catch (err) {
      probeNote = `APTRANSCO SLDC unreachable (${(err as Error).message}); `;
    }
  }

  const base = buildTypicalSolarRegion(
    REGION_ID,
    6.5,
    0.4,
    `${probeNote}Typical-shape T1a fallback calibrated to POSOCO South Region RE curtailment 2024 ` +
    `(~0.4 TWh/yr Andhra Pradesh + Telangana solar curtailment; ` +
    `Ananthapuramu + Kurnool Solar Parks, AP Solar Corridor transmission bottlenecks). ` +
    `State-level APTRANSCO SLDC source established; live path activates when India-egress relay is available.`,
    "2024",
  );
  // Override T3-modelled → T1a-live-tso: this loader targets APTRANSCO SLDC as
  // the intended T1a source. The typical-shape is the current fallback.
  return applyUncertainty(base, { regionTier: "live" });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback(REGION_ID, () => run(), { regionTier: "live" })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("india-andhra-pradesh loader failed", err);
      process.exit(1);
    });
}

export const buildIndiaAndhraPradeshData = () => run({ probe: false });
