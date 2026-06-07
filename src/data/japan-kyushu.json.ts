import { pathToFileURL } from "node:url";
import { runJapanAreaLoader, type JapanAreaConfig } from "../lib/japan-area-csv.js";
import { withFallback } from "../lib/resilient.js";
import type { RegionData } from "../lib/types.js";

/**
 * Japan — Kyushu Electric Power T&D (九州電力送配電), area code 09.
 *
 * Direct measured curtailment from the monthly area supply/demand CSV:
 *   https://www.kyuden.co.jp/td_area_jukyu/csv/eria_jukyu_YYYYMM_09.csv
 *
 * Encoding: Shift-JIS. 20-column layout, 30-min intervals, MW. All fields are
 * double-quoted and dates use YYYYMMDD format (not YYYY/M/D) — handled by the
 * shared parser's "yyyymmdd" dateFormat. Note: distinct from the old
 * `td_power_usages` daily proxy path which used a ×10% calibration rate.
 * Promoted to direct measured curtailment 2026-06-07.
 */
const CONFIG: JapanAreaConfig = {
  regionId: "japan-kyushu",
  areaCode: "09",
  baseUrl: "https://www.kyuden.co.jp/td_area_jukyu/csv",
  cadence: "monthly",
  dateFormat: "yyyymmdd",
};
const SOURCE_NOTE =
  "Kyushu Electric Power T&D (九州電力送配電) area supply/demand CSV (eria_jukyu_YYYYMM_09.csv) — " +
  "direct 太陽光出力制御量+風力出力制御量 columns (MW, 30-min, Shift-JIS, quoted fields + YYYYMMDD dates).";

const run = async (): Promise<RegionData> => runJapanAreaLoader(CONFIG, SOURCE_NOTE);

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<RegionData>("japan-kyushu", run, {
    regionTier: "live" as const,
    tagLive: (r) => ({ ...r, sourceStatus: "live" as const }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" as const }),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("japan-kyushu loader failed", err);
      process.exit(1);
    });
}
