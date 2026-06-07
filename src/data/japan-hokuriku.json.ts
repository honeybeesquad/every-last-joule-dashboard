import { pathToFileURL } from "node:url";
import { runJapanAreaLoader, type JapanAreaConfig } from "../lib/japan-area-csv.js";
import { withFallback } from "../lib/resilient.js";
import type { RegionData } from "../lib/types.js";

/**
 * Japan — Hokuriku Electric Power T&D (北陸電力送配電), area code 05.
 *
 * Direct measured curtailment from the monthly area supply/demand CSV:
 *   https://www.rikuden.co.jp/nw/denki-yoho/csv/eria_jukyu_YYYYMM_05.csv
 *
 * Encoding: Shift-JIS. 22-column layout, 30-min intervals, MW. Replaces the
 * old daily juyo_05_YYYYMMDD.csv proxy (×1% calibration rate).
 * Promoted to direct measured curtailment 2026-06-07.
 */
const CONFIG: JapanAreaConfig = {
  regionId: "japan-hokuriku",
  areaCode: "05",
  baseUrl: "https://www.rikuden.co.jp/nw/denki-yoho/csv",
  cadence: "monthly",
  dateFormat: "slash",
};
const SOURCE_NOTE =
  "Hokuriku Electric Power T&D (北陸電力送配電) area supply/demand CSV (eria_jukyu_YYYYMM_05.csv) — " +
  "direct 太陽光出力制御量+風力出力制御量 columns (MW, 30-min, Shift-JIS). Solar-dominant.";

const run = async (): Promise<RegionData> => runJapanAreaLoader(CONFIG, SOURCE_NOTE);

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<RegionData>("japan-hokuriku", run, {
    regionTier: "live" as const,
    tagLive: (r) => ({ ...r, sourceStatus: "live" as const }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" as const }),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("japan-hokuriku loader failed", err);
      process.exit(1);
    });
}
