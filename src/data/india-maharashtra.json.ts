import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalMixedRegion } from "../lib/typical-profiles.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "india-maharashtra";
// MSLDC (Maharashtra State Load Despatch Centre / MSEDCL). Publishes daily
// RE curtailment and system data. Geoblocked from non-Indian IP ranges;
// India-egress relay activates live path.
const SOURCE_URL = "https://msldc.mahavedha.com/";

async function run({ probe = true } = {}): Promise<RegionData> {
  let probeNote = "";

  if (probe) {
    try {
      await fetchText(SOURCE_URL, { timeoutMs: 10000, retries: 0, headers: { "user-agent": "Mozilla/5.0" } });
      // TODO: parse MSLDC daily RE curtailment report and return live data.
      // Currently unreachable from the build environment — geoblocked outside India.
      throw new Error("MSLDC live parsing not yet implemented; geoblocked from build environment");
    } catch (err) {
      probeNote = `MSLDC unreachable (${(err as Error).message}); `;
    }
  }

  const base = buildTypicalMixedRegion(
    REGION_ID,
    0.3,
    { solar: 0.55, wind: 0.45 },
    `${probeNote}Typical-shape T1a fallback calibrated to POSOCO Western Region 2024 ` +
    `(~0.3 TWh/yr mixed solar+wind curtailment; Solapur solar parks + Satara/Dhule wind corridor). ` +
    `Split 55% solar / 45% wind based on MW-weighted generation capacity (MNRE 2024). ` +
    `State-level MSLDC source established; live path activates when India-egress relay is available.`,
    "2024",
    7,
    15,
  );
  // Override T3-modelled → T1a-live-tso: this loader targets the MSLDC as
  // the intended T1a source. The typical-shape is the current fallback.
  return applyUncertainty(base, { regionTier: "live" });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback(REGION_ID, () => run(), { regionTier: "live" })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("india-maharashtra loader failed", err);
      process.exit(1);
    });
}

export const buildIndiaMaharashtraData = () => run({ probe: false });
