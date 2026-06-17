import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalSolarRegion, buildTypicalWindRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "south-korea";
const SOURCE_URL = "https://www.kpx.or.kr/eng/";
const DATA_PORTAL_URL = "https://www.data.go.kr/data/15103243/openapi.do";
const BLOCKER_NOTE =
  "KPX/EPSIS pages are reachable, but the Data Portal KPX hourly solar/generation APIs require an approved serviceKey and no unauthenticated mainland curtailment feed was found";

// Published curtailment anchors from IEA Korea 2024 review
const SOLAR_ANCHOR_TWH = 0.5; // ~0.5 TWh/yr mainland solar curtailment
const WIND_ANCHOR_TWH = 0.05;  // ~0.05 TWh/yr mainland wind curtailment

async function run({ probe = true } = {}): Promise<{ solar: RegionData; wind: RegionData }> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      await fetchText(DATA_PORTAL_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error(BLOCKER_NOTE);
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    const solarNote = `KPX mainland live feed unavailable (${(err as Error).message}); using published anchor ${SOLAR_ANCHOR_TWH} TWh/yr mainland solar curtailment, excluding Jeju.`;
    const windNote = `KPX mainland live feed unavailable (${(err as Error).message}); using published anchor ${WIND_ANCHOR_TWH} TWh/yr mainland wind curtailment, excluding Jeju.`;

    return {
      solar: buildTypicalSolarRegion(
        "south-korea-solar",
        3, // peak UTC hour for KST noon
        SOLAR_ANCHOR_TWH,
        solarNote,
        "2024",
      ),
      wind: buildTypicalWindRegion(
        "south-korea-wind",
        3, // peak UTC hour for KST noon (onshore wind)
        WIND_ANCHOR_TWH,
        windNote,
        "2024",
      ),
    };
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback<{ solar: RegionData; wind: RegionData }>(REGION_ID, () => run(), {
    regionTier: "estimated" as const,
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => { console.error("south-korea loader failed", err); process.exit(1); });
}

export const buildSouthKoreaData = () => run({ probe: false });
