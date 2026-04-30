import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalMixedRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "gansu";
const SOURCE_URL = "https://ember-energy.org/";

async function run({ probe = true } = {}): Promise<RegionData> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("Ember/S&P/NEA China province curtailment references are not hourly machine-readable feeds");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    return buildTypicalMixedRegion(
      REGION_ID,
      3.0,
      { wind: 0.6, solar: 0.4 },
      `Typical-shape fallback: Ember GER 2025 + S&P Rising Curtailment in China 2024 / NEA feed unavailable (${(err as Error).message}); Jiuquan/Wuwei wind+solar curtailment anchored at ~3.0 TWh/yr.`,
      "2024",
      5,
      15,
    );
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback(REGION_ID, () => run())
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => { console.error("gansu loader failed", err); process.exit(1); });
}

export const buildGansuData = () => run({ probe: false });
