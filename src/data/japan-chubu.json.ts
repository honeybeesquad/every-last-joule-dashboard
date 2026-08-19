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
 * Encoding: Shift-JIS. 22-column layout, 30-min intervals, MW. As of 2026-08
 * the portal keeps only the CURRENT month standalone and rolls the previous
 * month straight into the yearly `eria_jukyu_{year}.zip` archive (confirmed:
 * `eria_jukyu_202607_04.csv` 404s standalone but is present inside
 * `eria_jukyu_2026.zip`, same 22-column Shift-JIS content) — narrower than
 * the "current+previous standalone" retention this loader used to rely on,
 * which is what silently broke the live fetch for ~2.5 months (2026-06 to
 * 2026-08). `runJapanAreaLoader`'s shared `fetchAreaMonth` now falls back to
 * the yearly zip on a 404, so the current+previous-month fetch still covers
 * the 30-day window either way. The dead juyo_cepco003 proxy path (PR #90)
 * is retired. Promoted estimated→live 2026-06-07.
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
