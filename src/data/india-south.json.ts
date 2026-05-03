import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalMixedRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "india-south";
const SOURCE_URL = "https://srldc.in/";

async function run({ probe = true } = {}): Promise<RegionData> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("SRLDC public reports do not expose stable unauthenticated hourly renewable curtailment data");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    return buildTypicalMixedRegion(
      REGION_ID,
      1.5,
      { wind: 0.6, solar: 0.4 },
      `Typical-shape fallback: SRLDC 2024 live feed unavailable (${(err as Error).message}); Tamil Nadu wind plus Karnataka/Andhra solar curtailment anchored at ~1.5 TWh/yr.`,
      "2024",
      6.5,
      15,
    );
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback(REGION_ID, () => run())
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => { console.error("india-south loader failed", err); process.exit(1); });
}

export const buildIndiaSouthData = () => run({ probe: false });
