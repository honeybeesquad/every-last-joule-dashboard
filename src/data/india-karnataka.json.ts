import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalSolarRegion } from "../lib/typical-profiles.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "india-karnataka";
// Karnataka State Load Despatch Centre (KSLDC). Publishes real-time dashboard
// and curtailment PDFs. KSLDC was reachable from non-Indian IPs in the
// 2026-04-26 coverage audit; India-egress relay will also activate live parse.
const SOURCE_URL = "https://ksldc.in/";

async function run({ probe = true } = {}): Promise<RegionData> {
  let probeNote = "";

  if (probe) {
    try {
      await fetchText(SOURCE_URL, { timeoutMs: 10000, retries: 0, headers: { "user-agent": "Mozilla/5.0" } });
      // TODO: parse KSLDC curtailment PDF/dashboard and return live data.
      // KSLDC was probed successfully in April 2026; full parser not yet built.
      throw new Error("KSLDC live parsing not yet implemented");
    } catch (err) {
      probeNote = `KSLDC unreachable (${(err as Error).message}); `;
    }
  }

  const base = buildTypicalSolarRegion(
    REGION_ID,
    6.5,
    0.5,
    `${probeNote}Typical-shape T1a fallback calibrated to POSOCO South Region RE curtailment 2024 ` +
    `(~0.5 TWh/yr Karnataka solar curtailment; Pavagada Solar Park + Bidar solar + growing wind). ` +
    `State-level KSLDC source established; live path activates when parser is complete.`,
    "2024",
  );
  // Override T3-modelled → T1a-live-tso: KSLDC is the intended T1a source.
  return applyUncertainty(base, { regionTier: "live" });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback(REGION_ID, () => run(), { regionTier: "live" })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("india-karnataka loader failed", err);
      process.exit(1);
    });
}

export const buildIndiaKarnatakaData = () => run({ probe: false });
