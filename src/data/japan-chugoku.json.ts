import { pathToFileURL } from "node:url";
import { runJapanAreaLoader, type JapanAreaConfig } from "../lib/japan-area-csv.js";
import { withFallback } from "../lib/resilient.js";
import type { RegionData } from "../lib/types.js";

/**
 * Japan — Chugoku Electric Power Network (中国電力ネットワーク), area code 07.
 *
 * Direct measured curtailment from the monthly area supply/demand CSV:
 *   https://www.energia.co.jp/nw/jukyuu/sys/eria_jukyu_YYYYMM_07.csv
 *
 * Encoding: Shift-JIS. 22-column layout (wider than TEPCO/Kansai — includes
 * 火力出力制御量 and バイオマス出力制御量), 30-min intervals, MW. Replaces the
 * old daily juyo_07_YYYYMMDD.csv proxy (×6% calibration rate).
 * Promoted to direct measured curtailment 2026-06-07.
 */
const CONFIG: JapanAreaConfig = {
  regionId: "japan-chugoku",
  areaCode: "07",
  baseUrl: "https://www.energia.co.jp/nw/jukyuu/sys",
  cadence: "monthly",
  dateFormat: "slash",
};
const SOURCE_NOTE =
  "Chugoku Electric Power Network (中国電力ネットワーク) area supply/demand CSV (eria_jukyu_YYYYMM_07.csv) — " +
  "direct 太陽光出力制御量+風力出力制御量 columns (MW, 30-min, Shift-JIS). Solar-dominant.";

const run = async (): Promise<RegionData> => runJapanAreaLoader(CONFIG, SOURCE_NOTE);

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<RegionData>("japan-chugoku", run, {
    regionTier: "live" as const,
    tagLive: (r) => ({ ...r, sourceStatus: "live" as const }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" as const }),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("japan-chugoku loader failed", err);
      process.exit(1);
    });
}
