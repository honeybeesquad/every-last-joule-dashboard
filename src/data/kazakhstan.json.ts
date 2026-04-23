import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalWindRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "kazakhstan";
const SOURCE_URL = "https://www.kegoc.kz/";

async function run({ probe = true } = {}): Promise<RegionData> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("KEGOC public pages do not expose machine-readable hourly curtailment; market operator data is login-gated");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    return buildTypicalWindRegion(
      REGION_ID,
      15,
      0.4,
      `Typical-shape fallback: KEGOC live feed unavailable (${(err as Error).message}); Aktobe transmission-limited wind curtailment scaled to ~0.4 TWh/yr (Qazaq Green 2024: ~7.5 TWh RES with 5-8% systemic curtailment).`,
      "2024",
    );
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback(REGION_ID, () => run())
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("kazakhstan loader failed", err);
      process.exit(1);
    });
}

export const buildKazakhstanData = () => run({ probe: false });
