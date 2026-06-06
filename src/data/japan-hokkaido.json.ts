import { pathToFileURL } from "node:url";
import { runJapanAreaLoader, type JapanAreaConfig } from "../lib/japan-area-csv.js";
import { withFallback } from "../lib/resilient.js";
import type { RegionData } from "../lib/types.js";

/**
 * Japan — Hokkaido Electric Power Network (北海道電力ネットワーク), area code 01.
 *
 * Direct measured curtailment from the monthly area supply/demand CSV:
 *   https://www.hepco.co.jp/network/con_service/public_document/supply_demand_results/csv/eria_jukyu_YYYYMM_01.csv
 *
 * Encoding: Shift-JIS. 22-column layout, 30-min intervals, MW. Standalone
 * monthly CSVs from 2024-04 on. Replaces the all-renewables juyo_01 misread
 * (PR #90) — this feed has a solar-specific 太陽光出力制御量 column. Wind is a
 * non-trivial minority here (~16% in May 2026) but still solar-dominant, so
 * kind stays "solar"; the split is recorded in fuelShare. Promoted
 * estimated→live 2026-06-07.
 */
const CONFIG: JapanAreaConfig = {
  regionId: "japan-hokkaido",
  areaCode: "01",
  baseUrl: "https://www.hepco.co.jp/network/con_service/public_document/supply_demand_results/csv",
  cadence: "monthly",
  dateFormat: "slash",
};
const SOURCE_NOTE =
  "Hokkaido Electric Power Network (北海道電力ネットワーク) area supply/demand CSV (eria_jukyu_YYYYMM_01.csv) — " +
  "direct 太陽光出力制御量+風力出力制御量 columns (MW, 30-min, Shift-JIS).";

const run = async (): Promise<RegionData> => runJapanAreaLoader(CONFIG, SOURCE_NOTE);

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<RegionData>("japan-hokkaido", run, {
    regionTier: "live" as const,
    tagLive: (r) => ({ ...r, sourceStatus: "live" as const }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" as const }),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("japan-hokkaido loader failed", err);
      process.exit(1);
    });
}
