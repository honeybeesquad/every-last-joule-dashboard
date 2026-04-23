import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalSolarRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

/**
 * Namibia: ~55 MW installed renewables + 121 MW under construction on a tiny
 * ~600 MW peak-demand grid. NamPower's Integrated Strategic Business Plan
 * 2025 states the technical hosting capacity is ~275 MW, roughly half the
 * midday load, and the existing grid is already at the threshold for
 * absorbing more VRE.
 *
 * Historically reliant on Eskom for load-following via the South-Africa
 * interconnector; as that PPA expires 2025, Namibia is building its own
 * flexibility (Omburu 51 MW BESS, Lithops 45 MW BESS, Sores |Gaib 100 MW PV).
 *
 * Calibration: ~0.05 TWh/yr — small in absolute terms but meaningful
 * relative to the country's total ~4 TWh/yr electricity demand. Expected to
 * rise sharply once Hyphen green-hydrogen phase 1 comes online.
 *
 * Local solar peak UTC 10 (Windhoek UTC+2 → local noon UTC 10).
 */

const REGION_ID = "namibia";
const SOURCE_URL = "https://www.nampower.com.na/";
const ANNUAL_TWH = 0.05;
const LOCAL_NOON_UTC = 10;

async function run({ probe = true } = {}): Promise<RegionData> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("NamPower public pages expose corporate reports but no hourly curtailment feed");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    return buildTypicalSolarRegion(
      REGION_ID,
      LOCAL_NOON_UTC,
      ANNUAL_TWH,
      `Typical-shape fallback: NamPower live feed unavailable (${(err as Error).message}); small isolated-grid solar+wind curtailment ~0.05 TWh/yr per NamPower ISB 2025 (275 MW hosting capacity ceiling)`,
      "2025",
    );
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback(REGION_ID, () => run())
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("namibia loader failed", err);
      process.exit(1);
    });
}

export const buildNamibiaData = () => run({ probe: false });
