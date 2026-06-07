import { pathToFileURL } from "node:url";
import { runJapanAreaLoader, type JapanAreaConfig } from "../lib/japan-area-csv.js";
import { withFallback } from "../lib/resilient.js";
import type { RegionData } from "../lib/types.js";

/**
 * Japan — Shikoku Electric Power T&D (四国電力送配電), area code 08.
 *
 * Direct measured curtailment from the monthly area supply/demand CSV:
 *   https://www.yonden.co.jp/nw/supply_demand/csv/eria_jukyu_YYYYMM_08.csv
 *
 * Encoding: Shift-JIS. 20-column layout, 30-min intervals, MW. Replaces the
 * old daily juyo_08_YYYYMMDD.csv proxy (×7% calibration rate; current-day only).
 * Promoted to direct measured curtailment 2026-06-07.
 */
const CONFIG: JapanAreaConfig = {
  regionId: "japan-shikoku",
  areaCode: "08",
  baseUrl: "https://www.yonden.co.jp/nw/supply_demand/csv",
  cadence: "monthly",
  dateFormat: "slash",
};
const SOURCE_NOTE =
  "Shikoku Electric Power T&D (四国電力送配電) area supply/demand CSV (eria_jukyu_YYYYMM_08.csv) — " +
  "direct 太陽光出力制御量+風力出力制御量 columns (MW, 30-min, Shift-JIS). Solar-dominant.";

const run = async (): Promise<RegionData> => runJapanAreaLoader(CONFIG, SOURCE_NOTE);

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<RegionData>("japan-shikoku", run, {
    regionTier: "live" as const,
    tagLive: (r) => ({ ...r, sourceStatus: "live" as const }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" as const }),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("japan-shikoku loader failed", err);
      process.exit(1);
    });
}
