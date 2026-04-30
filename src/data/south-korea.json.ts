import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalSolarRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "south-korea";
const SOURCE_URL = "https://www.kpx.or.kr/eng/";
const DATA_PORTAL_URL = "https://www.data.go.kr/data/15103243/openapi.do";
const BLOCKER_NOTE =
  "KPX/EPSIS pages are reachable, but the Data Portal KPX hourly solar/generation APIs require an approved serviceKey and no unauthenticated mainland curtailment feed was found";

async function run({ probe = true } = {}): Promise<RegionData> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      await fetchText(DATA_PORTAL_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error(BLOCKER_NOTE);
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    return buildTypicalSolarRegion(
      REGION_ID,
      3,
      0.5,
      `Typical-shape fallback: KPX mainland live feed unavailable (${(err as Error).message}); calibration anchor remains ~0.5 TWh/yr mainland solar curtailment, excluding Jeju.`,
      "2024",
    );
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback(REGION_ID, () => run())
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => { console.error("south-korea loader failed", err); process.exit(1); });
}

export const buildSouthKoreaData = () => run({ probe: false });
