import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalWindRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

/**
 * Morocco: 45% renewable installed capacity by end-2024 (5,439 MW), with
 * wind leading at 2,390 MW and growing fastest. Wind generation rose 43%
 * YoY to 9,363 GWh in 2024 per ANRE annual report.
 *
 * ANRE has not published curtailment volumes publicly, but 2025-2029
 * hosting-capacity plan + ONEE MAD 30 billion grid upgrade + 3 GW HVDC
 * Dakhla-Casablanca line procurement all indicate a managed risk.
 * Curtailment is concentrated south (renewables) → north (load) axis.
 *
 * Calibration: wind 9,363 GWh × estimated 3% transmission-limited curtailment
 * = ~0.28 TWh/yr. Bump to 0.4 TWh including some solar curtailment from Noor
 * Ouarzazate CSP spill + Noor Midelt PV events. Mixed 70% wind / 30% solar
 * reflects the generation-mix weighting.
 *
 * Peak wind UTC: Tarfaya / Midelt Atlantic-exposed clusters peak late
 * afternoon local (UTC+0/+1) → UTC 15.
 */

const REGION_ID = "morocco";
const SOURCE_URL = "http://www.anre.ma/";
const ANNUAL_TWH = 0.4;
const WIND_PEAK_UTC = 15;

async function run({ probe = true } = {}): Promise<RegionData> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("ANRE Morocco publishes annual regulatory reports but no hourly curtailment feed");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    const base = buildTypicalWindRegion(
      REGION_ID,
      WIND_PEAK_UTC,
      ANNUAL_TWH,
      `Typical-shape fallback: ANRE Morocco live feed unavailable (${(err as Error).message}); ~0.4 TWh/yr mixed wind+solar curtailment from 9,363 GWh 2024 wind × 3% transmission-limited proxy + Noor CSP spill`,
      "2024",
    );
    return {
      ...base,
      fuelShare: { wind: 0.7, solar: 0.3 },
    };
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback(REGION_ID, () => run())
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("morocco loader failed", err);
      process.exit(1);
    });
}

export const buildMoroccoData = () => run({ probe: false });
