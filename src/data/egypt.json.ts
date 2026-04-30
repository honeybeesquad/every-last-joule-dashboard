import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalSolarRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

/**
 * Egypt: 1.8 GW Benban Solar Park near Aswan + growing Gulf of Suez wind.
 * Renewable generation ~32 TWh FY2024/25 per NREA.
 *
 * Industry analysis reports ~200 hours of Benban disconnection in 2024 as
 * frequency strayed outside the 49.8-50.2 Hz band. Curtailment is
 * frequency-stability-driven, not pure overflow, because Egypt's grid is
 * large and gas-flexible.
 *
 * Calibration: 200 hours × ~1 GW (partial park disconnection) × 0.3 daytime
 * CF ≈ 60-100 GWh/yr direct. Scale up for unreported intra-day constraints
 * and Zafarana/Ras Ghareb wind events → ~0.3 TWh/yr anchor. Local solar peak
 * is UTC 10:00 (Cairo UTC+2, local noon = UTC 10).
 *
 * Future work: probe EETC and NREA for any hourly feeds; Nefertiti BESS
 * commissioning in 2027 should reduce curtailment volumes.
 */

const REGION_ID = "egypt";
const SOURCE_URL = "https://nrea.gov.eg/";
const ANNUAL_TWH = 0.3;
const LOCAL_NOON_UTC = 10;

async function run({ probe = true } = {}): Promise<RegionData> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("NREA public pages publish annual/monthly PDFs but no machine-readable hourly curtailment feed");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    return buildTypicalSolarRegion(
      REGION_ID,
      LOCAL_NOON_UTC,
      ANNUAL_TWH,
      `Typical-shape fallback: NREA Egypt live feed unavailable (${(err as Error).message}); Benban PV curtailment calibrated to ~0.3 TWh/yr from ~200 hrs frequency-driven disconnection events 2024`,
      "2024",
    );
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback(REGION_ID, () => run())
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("egypt loader failed", err);
      process.exit(1);
    });
}

export const buildEgyptData = () => run({ probe: false });
