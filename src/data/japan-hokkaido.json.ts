import { pathToFileURL } from "node:url";
import { runJapanAreaLoaderSplit, type JapanAreaConfig } from "../lib/japan-area-csv.js";
import { withFallback } from "../lib/resilient.js";
import type { RegionData } from "../lib/types.js";

/**
 * Japan — Hokkaido Electric Power Network (北海道電力ネットワーク), area code 01.
 *
 * Direct measured curtailment from the monthly area supply/demand CSV:
 *   https://www.hepco.co.jp/network/con_service/public_document/supply_demand_results/csv/eria_jukyu_YYYYMM_01.csv
 *
 * Encoding: Shift-JIS. 22-column layout, 30-min intervals, MW.
 *
 * Per-fuel split (2026-06-17): 30-day measurement found wind curtailment
 * material at ~16% of total (a seasonal few GWh/30d). Emits two RegionData:
 *   japan-hokkaido-solar — 太陽光出力制御量 column only
 *   japan-hokkaido-wind  — 風力出力制御量 column only
 */
const CONFIG: JapanAreaConfig = {
  regionId: "japan-hokkaido",
  areaCode: "01",
  baseUrl: "https://www.hepco.co.jp/network/con_service/public_document/supply_demand_results/csv",
  cadence: "monthly",
  dateFormat: "slash",
};

const SOLAR_SOURCE_NOTE =
  "Hokkaido Electric Power Network (北海道電力ネットワーク) area supply/demand CSV (eria_jukyu_YYYYMM_01.csv) — " +
  "太陽光出力制御量 column (MW, 30-min, Shift-JIS). Solar share of measured curtailment.";

const WIND_SOURCE_NOTE =
  "Hokkaido Electric Power Network (北海道電力ネットワーク) area supply/demand CSV (eria_jukyu_YYYYMM_01.csv) — " +
  "風力出力制御量 column (MW, 30-min, Shift-JIS). Wind is the minority fuel (~16% of measured curtailment; absolute volume is seasonal).";

const run = async (): Promise<Record<string, RegionData>> => {
  const { solar, wind } = await runJapanAreaLoaderSplit(
    CONFIG,
    "japan-hokkaido-solar",
    "japan-hokkaido-wind",
    SOLAR_SOURCE_NOTE,
    WIND_SOURCE_NOTE,
  );
  return { "japan-hokkaido-solar": solar, "japan-hokkaido-wind": wind };
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<Record<string, RegionData>>("japan-hokkaido", run, {
    regionTier: "live" as const,
    tagLive: (r) => {
      const tagged: Record<string, RegionData> = {};
      for (const [k, v] of Object.entries(r)) tagged[k] = { ...v, sourceStatus: "live" as const };
      return tagged;
    },
    tagCached: (c) => {
      const tagged: Record<string, RegionData> = {};
      for (const [k, v] of Object.entries(c as Record<string, RegionData>)) tagged[k] = { ...v, sourceStatus: "cached" as const };
      return tagged;
    },
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("japan-hokkaido loader failed", err);
      process.exit(1);
    });
}
