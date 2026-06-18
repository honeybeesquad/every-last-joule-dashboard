import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalSolarRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "thailand";
const SOURCE_URL = "https://sothailand.com/sysgen/ws/sysgen";

async function run({ probe = true } = {}): Promise<RegionData> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("EGAT sothailand.com/sysgen endpoint reachable but does not expose machine-readable hourly renewable curtailment");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    return buildTypicalSolarRegion(
      REGION_ID,
      5.5,
      0.3,
      `Typical-shape fallback: EGAT sothailand.com/sysgen/ws/sysgen probed — ${(err as Error).message}. T2-anchored: calibration anchor ~0.3 TWh/yr solar curtailment (EGAT/ERC) applied to typical profile.`,
      "2024",
    );
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback(REGION_ID, () => run(), { regionTier: "estimated" })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("thailand loader failed", err);
      process.exit(1);
    });
}

export const buildThailandData = () => run({ probe: false });
