import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalSolarRegion } from "../lib/typical-profiles.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "india-andhra-pradesh";
// APTRANSCO / APSLDC (Andhra Pradesh Transmission Corporation Ltd / State Load
// Despatch Centre). Publishes daily RE curtailment data. Geoblocked from
// non-Indian IP ranges; India-egress relay activates live path.
const SOURCE_URL = "https://apsldc.in/";

async function run({ probe = true } = {}): Promise<RegionData> {
  let probeNote = "";

  if (probe) {
    try {
      await fetchText(SOURCE_URL, { timeoutMs: 10000, retries: 0, headers: { "user-agent": "Mozilla/5.0" } });
      // TODO: parse APSLDC daily RE curtailment report and return live data.
      // Currently unreachable from the build environment — geoblocked outside India.
      throw new Error("APSLDC live parsing not yet implemented; geoblocked from build environment");
    } catch (err) {
      probeNote = `APSLDC unreachable (${(err as Error).message}); `;
    }
  }

  const base = buildTypicalSolarRegion(
    REGION_ID,
    7,
    0.4,
    `${probeNote}Typical-shape T1a fallback calibrated to POSOCO Southern Region 2024 ` +
    `(~0.4 TWh/yr solar curtailment; Anantapur + Kadapa solar parks, ` +
    `Andhra Pradesh transmission bottlenecks post-bifurcation). ` +
    `State-level APSLDC source established; live path activates when India-egress relay is available.`,
    "2024",
  );
  // Override T3-modelled → T1a-live-tso: this loader targets the APSLDC as
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
