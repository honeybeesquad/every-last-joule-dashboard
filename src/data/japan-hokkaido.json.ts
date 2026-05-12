import { pathToFileURL } from "node:url";
import { buildTypicalSolarRegion } from "../lib/typical-profiles.js";
import { withFallback } from "../lib/resilient.js";
import type { RegionData } from "../lib/types.js";

/**
 * Japan — Hokkaido Electric Power (北海道電力) curtailment.
 *
 * Status: T3 / estimated — typical-shape only.
 *
 * History: a previous version of this loader read column[3] of the
 * `juyo_01_YYYYMMDD.csv` 5-min section as "solar 万kW" and applied a
 * ×10 万kW→MW multiplier. The 2026-05-10 endpoint investigation
 * established that column[3] is actually 再生可能エネルギー出力
 * (all-renewables output, already in MW) — a mixed-fuel signal, not
 * solar — and that no solar-specific 5-min CSV is published by
 * denkiyoho.hepco.co.jp. The historical decode therefore produced
 * mixed-fuel data 10× larger than reality, attributed to solar.
 *
 * The parser + helper were removed on 2026-05-12 rather than "fixed",
 * because no parameter substitution recovers solar curtailment from
 * an all-renewables signal — attribution, not units, is the failure.
 * If a solar-specific Hokkaido feed emerges in future, write a new
 * loader against that schema; do not resurrect the juyo_01 path.
 *
 * Calibration anchor for the typical-shape fallback: OCCTO FY2024
 * Hokkaido area curtailment ≈ 0.10 TWh/yr. Solar peak UTC: 03:00
 * (noon JST = 03:00 UTC for lon ~141.4°E).
 */
const REGION_ID = "japan-hokkaido";

const run = async (): Promise<RegionData> =>
  buildTypicalSolarRegion(
    REGION_ID,
    3, // peakHourUtc (noon JST = 03:00 UTC)
    0.10,
    "Hokkaido Electric Power (北海道電力) — no solar-specific live feed published (denkiyoho.hepco.co.jp juyo_01 column[3] is all-renewables MW, not solar; verified 2026-05-10). Typical solar shape × OCCTO FY2024 Hokkaido anchor ~0.10 TWh/yr.",
    "2024",
  );

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<RegionData>(REGION_ID, run, {
    regionTier: "estimated" as const,
    tagLive: (r) => ({ ...r, sourceStatus: "live" as const }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" as const }),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("japan-hokkaido loader failed", err);
      process.exit(1);
    });
}
