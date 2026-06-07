import { pathToFileURL } from "node:url";
import { runJapanAreaLoader, type JapanAreaConfig } from "../lib/japan-area-csv.js";
import { withFallback } from "../lib/resilient.js";
import type { RegionData } from "../lib/types.js";

/**
 * Japan — Kansai Transmission and Distribution (関西電力送配電), area code 06.
 *
 * Direct measured curtailment from the monthly area supply/demand CSV:
 *   https://www.kansai-td.co.jp/interchange/denkiyoho/area-performance/eria_jukyu_YYYYMM_06.csv
 *
 * Encoding: Shift-JIS. 20-column layout, 30-min intervals, MW. Replaces the
 * old live-only daily juyo1_kansai.csv proxy (×1% calibration rate).
 * Promoted to direct measured curtailment 2026-06-07.
 */
const CONFIG: JapanAreaConfig = {
  regionId: "japan-kansai",
  areaCode: "06",
  baseUrl: "https://www.kansai-td.co.jp/interchange/denkiyoho/area-performance",
  cadence: "monthly",
  dateFormat: "slash",
};
const SOURCE_NOTE =
  "Kansai Transmission and Distribution (関西電力送配電) area supply/demand CSV (eria_jukyu_YYYYMM_06.csv) — " +
  "direct 太陽光出力制御量+風力出力制御量 columns (MW, 30-min, Shift-JIS). Solar-dominant.";

const run = async (): Promise<RegionData> => runJapanAreaLoader(CONFIG, SOURCE_NOTE);

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<RegionData>("japan-kansai", run, {
    regionTier: "live" as const,
    tagLive: (r) => ({ ...r, sourceStatus: "live" as const }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" as const }),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("japan-kansai loader failed", err);
      process.exit(1);
    });
}
