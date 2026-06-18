import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalHydroSeasonalRegion, HYDRO_SEASONAL_SHARES } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "russia-mainland";
const SOURCE_URL = "https://858127-cc16935.tmweb.ru";

async function run({ probe = true } = {}): Promise<RegionData> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("SO UES reverse-proxy reachable but does not expose unauthenticated hourly hydro-spill data");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    return buildTypicalHydroSeasonalRegion(
      REGION_ID,
      1,
      HYDRO_SEASONAL_SHARES["russia-mainland"],
      `Typical-shape fallback: SO UES reverse-proxy (858127-cc16935.tmweb.ru) probed — ${(err as Error).message}. T2-anchored: calibration anchor ~1 TWh/yr European Russia hydro spill applied to typical seasonal profile.`,
      "2024",
    );
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback(REGION_ID, () => run(), { regionTier: "estimated" })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => { console.error("russia-mainland loader failed", err); process.exit(1); });
}

export const buildRussiaMainlandData = () => run({ probe: false });
