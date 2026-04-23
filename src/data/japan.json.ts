import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalSolarRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "japan";
const SOURCE_URL = "https://www.occto.or.jp/";

async function run({ probe = true } = {}): Promise<RegionData> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("OCCTO/JEPX/METI public pages did not expose a stable unauthenticated hourly curtailment endpoint");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    return buildTypicalSolarRegion(
      REGION_ID,
      3,
      1.7,
      `Typical-shape fallback: OCCTO/JEPX live feed unavailable (${(err as Error).message}); Kyushu-led solar curtailment scaled to ~1.7 TWh/yr.`,
      "2024",
    );
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback(REGION_ID, () => run())
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("japan loader failed", err);
      process.exit(1);
    });
}

export const buildJapanData = () => run({ probe: false });
