import { pathToFileURL } from "node:url";
import { runJapanAreaLoader, type JapanAreaConfig } from "../lib/japan-area-csv.js";
import { withFallback } from "../lib/resilient.js";
import type { RegionData } from "../lib/types.js";

/**
 * Japan — TEPCO Power Grid (東京電力パワーグリッド), area code 03.
 *
 * Direct measured curtailment from the monthly area supply/demand CSV:
 *   https://www.tepco.co.jp/forecast/html/images/eria_jukyu_YYYYMM_03.csv
 *
 * Encoding: UTF-8 (TEPCO is the only area not Shift-JIS). 20-column layout,
 * 30-min intervals, MW. Columns 太陽光出力制御量 + 風力出力制御量 are summed.
 * WAF is User-Agent-gated; fetchHttp1Bytes sends a browser UA (probe 2026-06-07).
 * Promoted estimated→live 2026-06-07 (was a typical-shape T3 fallback).
 */
const CONFIG: JapanAreaConfig = {
  regionId: "japan-tepco",
  areaCode: "03",
  baseUrl: "https://www.tepco.co.jp/forecast/html/images",
  cadence: "monthly",
  dateFormat: "slash",
};
const SOURCE_NOTE =
  "TEPCO Power Grid (東京電力パワーグリッド) area supply/demand CSV (eria_jukyu_YYYYMM_03.csv) — " +
  "direct 太陽光出力制御量+風力出力制御量 columns (MW, 30-min, UTF-8). Solar-dominant.";

const run = async (): Promise<RegionData> => runJapanAreaLoader(CONFIG, SOURCE_NOTE);

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<RegionData>("japan-tepco", run, {
    regionTier: "live" as const,
    tagLive: (r) => ({ ...r, sourceStatus: "live" as const }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" as const }),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("japan-tepco loader failed", err);
      process.exit(1);
    });
}
