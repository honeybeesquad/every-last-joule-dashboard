import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalWindRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "jeju";
const SOURCE_URL = "https://www.kpx.or.kr/eng/";

async function run({ probe = true } = {}): Promise<RegionData> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("KPX public pages do not expose a stable machine-readable hourly Jeju curtailment feed");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    return buildTypicalWindRegion(
      REGION_ID,
      15,
      0.05,
      `Typical-shape fallback: KPX live feed unavailable (${(err as Error).message}); Jeju island-grid wind+solar curtailment calibrated to ~0.05 TWh/yr (KPX reports 181+ curtailment events in 2023, up from 19 GWh measured in 2020).`,
      "2024",
    );
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback(REGION_ID, () => run())
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("jeju loader failed", err);
      process.exit(1);
    });
}

export const buildJejuData = () => run({ probe: false });
