import { pathToFileURL } from "node:url";
import { runJapanAreaLoader, type JapanAreaConfig } from "../lib/japan-area-csv.js";
import { withFallback } from "../lib/resilient.js";
import type { RegionData } from "../lib/types.js";

/**
 * Japan — Okinawa Electric Power (沖縄電力), area code 10.
 *
 * Direct measured curtailment from the monthly area supply/demand CSV:
 *   https://www.okiden.co.jp/business-support/service/supply-and-demand/csv/eria_jukyu_YYYYMM_10.csv
 *
 * Encoding: Shift-JIS. 22-column layout, 30-min intervals, MW. Was already
 * reading direct 太陽光出力制御量+風力出力制御量 columns since the 2026-05
 * source restructure; folded onto the shared runJapanAreaLoader in Phase 2
 * (2026-06-07) for consistency with the other 9 areas.
 */
const CONFIG: JapanAreaConfig = {
  regionId: "japan-okinawa",
  areaCode: "10",
  baseUrl: "https://www.okiden.co.jp/business-support/service/supply-and-demand/csv",
  cadence: "monthly",
  dateFormat: "slash",
};
const SOURCE_NOTE =
  "Okinawa Electric Power (沖縄電力) area supply/demand CSV (eria_jukyu_YYYYMM_10.csv) — " +
  "direct 太陽光出力制御量+風力出力制御量 columns (MW, 30-min, Shift-JIS).";

const run = async (): Promise<RegionData> => runJapanAreaLoader(CONFIG, SOURCE_NOTE);

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<RegionData>("japan-okinawa", run, {
    regionTier: "live" as const,
    tagLive: (r) => ({ ...r, sourceStatus: "live" as const }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" as const }),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("japan-okinawa loader failed", err);
      process.exit(1);
    });
}
