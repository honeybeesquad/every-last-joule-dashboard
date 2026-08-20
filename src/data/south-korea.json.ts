import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalSolarRegion, buildTypicalWindRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "south-korea";
// KPX regional hourly PV generation (data.go.kr dataset 15103243, API B552115).
// Requires an approved serviceKey (Korean identity verification) — documented blocker.
const SOURCE_URL = "https://www.data.go.kr/data/15103243/openapi.do";
const KPX_PORTAL = "https://openapi.kpx.or.kr/openapiv2/PvAmountByLocHr";

// Curtailment = published generation × published curtailment rate (two cited sources).
// Generation: Ember / Our World in Data, South Korea, 2025 — wind 3.64 TWh, solar 37.80 TWh
//   (owid-energy.org, "Electricity Data Explorer / Yearly Electricity Data", Ember 2026).
// Rate: published 2024 curtailment — 4.1% wind / 3.2% PV in major (mainland) power systems
//   (MDPI 2024, citing IEA; "curtailed wind and PV increased ~55% in 2024"). Jeju excluded,
//   matching the repo's mainland scope. Mixed years (2025 gen × 2024 rate) follow the same
//   precedent as the China Ember-anchored regions.
const WIND_GEN_TWH = 3.64;
const SOLAR_GEN_TWH = 37.80;
const WIND_RATE = 0.041;
const SOLAR_RATE = 0.032;
const WIND_CURTAILED_TWH = Math.round(WIND_GEN_TWH * WIND_RATE * 1000) / 1000; // 0.149
const SOLAR_CURTAILED_TWH = Math.round(SOLAR_GEN_TWH * SOLAR_RATE * 1000) / 1000; // 1.210

const BLOCKER_NOTE =
  "KPX/data.go.kr hourly feed requires an approved serviceKey (Korean identity verification); " +
  "using Ember/OWID 2025 generation × published 2024 curtailment rate (4.1% wind / 3.2% PV).";

async function run({ probe = true } = {}): Promise<{ solar: RegionData; wind: RegionData }> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      await fetchText(KPX_PORTAL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error(BLOCKER_NOTE);
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    const solarNote =
      `KPX mainland live feed unavailable (${(err as Error).message}); ` +
      `curtailed = Ember/OWID 2025 solar generation ${SOLAR_GEN_TWH} TWh × ${(SOLAR_RATE * 100).toFixed(1)}% ` +
      `published 2024 rate = ${SOLAR_CURTAILED_TWH} TWh/yr (mainland, excl. Jeju).`;
    const windNote =
      `KPX mainland live feed unavailable (${(err as Error).message}); ` +
      `curtailed = Ember/OWID 2025 wind generation ${WIND_GEN_TWH} TWh × ${(WIND_RATE * 100).toFixed(1)}% ` +
      `published 2024 rate = ${WIND_CURTAILED_TWH} TWh/yr (mainland, excl. Jeju).`;

    return {
      solar: buildTypicalSolarRegion(
        "south-korea-solar",
        3, // peak UTC hour for KST noon
        SOLAR_CURTAILED_TWH,
        solarNote,
        "2025",
      ),
      wind: buildTypicalWindRegion(
        "south-korea-wind",
        3, // peak UTC hour for KST noon (onshore wind)
        WIND_CURTAILED_TWH,
        windNote,
        "2025",
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
