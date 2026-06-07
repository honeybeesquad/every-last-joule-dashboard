import { pathToFileURL } from "node:url";
import { runJapanAreaLoader, type JapanAreaConfig } from "../lib/japan-area-csv.js";
import { withFallback } from "../lib/resilient.js";
import type { RegionData } from "../lib/types.js";

/**
 * Japan — Chubu Electric Power Grid (中部電力パワーグリッド), area code 04.
 *
 * Direct measured curtailment from the monthly area supply/demand CSV:
 *   https://powergrid.chuden.co.jp/denki_yoho_content_data/eria_jukyu_YYYYMM_04.csv
 *
 * Encoding: Shift-JIS. 22-column layout, 30-min intervals, MW. Only the current
 * and previous month are exposed standalone (older months → yearly zip); the
 * current+previous month fetch covers the 30-day window. The dead juyo_cepco003
 * proxy path (PR #90) is retired. Promoted estimated→live 2026-06-07.
 */
const CONFIG: JapanAreaConfig = {
  regionId: "japan-chubu",
  areaCode: "04",
  baseUrl: "https://powergrid.chuden.co.jp/denki_yoho_content_data",
  cadence: "monthly",
  dateFormat: "slash",
};
const SOURCE_NOTE =
  "Chubu Electric Power Grid (中部電力パワーグリッド) area supply/demand CSV (eria_jukyu_YYYYMM_04.csv) — " +
  "direct 太陽光出力制御量+風力出力制御量 columns (MW, 30-min, Shift-JIS). Solar-dominant.";

const run = async (): Promise<RegionData> => runJapanAreaLoader(CONFIG, SOURCE_NOTE);

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<RegionData>("japan-chubu", run, {
    regionTier: "live" as const,
    tagLive: (r) => ({ ...r, sourceStatus: "live" as const }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" as const }),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("japan-chubu loader failed", err);
      process.exit(1);
    });
}
