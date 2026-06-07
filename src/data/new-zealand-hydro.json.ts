import { pathToFileURL } from "node:url";
import { parseDelimitedRows } from "../lib/csv.js";
import { fetchText } from "../lib/fetch.js";
import { latestCompleteUtcDayProfileGW, peakGW, timeOfDayAverageGW, totalTWh30d } from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";
import { nzTradingPeriodUtc } from "./new-zealand.json.js";

// EMI DispatchNodalPricesAndVolumes — monthly CSVs, one row per PoC per
// trading period. Uses the same Azure Blob Storage base as Generation_MD.
const BASE_URL = "https://emidatasets.blob.core.windows.net/publicdata/Datasets/Wholesale/DispatchAndPricing/NodalPricesAndVolumes";

// 3-letter PoC prefixes for the three hydro corridors named in the source.
// Waitaki corridor: BEN (Benmore), ROX (Roxburgh), CYD (Clyde), TWZ (Twizel), TKU (Tekapo)
// Manapouri: MAT
// Waikato: ARO (Aratiatia), ATI (Atiamuri), KAW (Karapiro), OHA (Ohakuri), WAI (Waipapa)
const HYDRO_NODE_PREFIXES = new Set([
  "BEN", "ROX", "CYD", "TWZ", "TKU",
  "MAT",
  "ARO", "ATI", "KAW", "OHA", "WAI",
]);

/**
 * Parse an EMI DispatchNodalPricesAndVolumes CSV (per-day or per-month).
 *
 * For each row that passes both filters — (a) PoC prefix in the hydro corridor
 * set AND (b) DollarsPerMegawattHour ≤ 0 — the GenerationMegawatts is treated
 * as curtailed. Half-hourly MW values are accumulated into hourly buckets as
 * MW × 0.5 h so the stored value equals average curtailed MW over the hour.
 *
 * @param csv         Raw CSV text.
 * @param tradingDate YYYY-MM-DD to use when the CSV has no TradingDate column
 *                    (per-day files) or as fallback for rows missing that field.
 */
export function parseEmiNodalCsv(csv: string, tradingDate: string): CurtailmentPoint[] {
  const rows = parseDelimitedRows(csv, ",");
  const hours = new Map<string, number>();

  for (const row of rows) {
    const poc = (row.PointOfConnectionCode ?? row.NodeId ?? "").trim();
    const prefix = poc.slice(0, 3).toUpperCase();
    if (!HYDRO_NODE_PREFIXES.has(prefix)) continue;

    const price = Number(row.DollarsPerMegawattHour ?? row.Price ?? "");
    if (!Number.isFinite(price) || price > 0) continue;

    const tp = Number(row.TradingPeriodNumber ?? row.TradingPeriod ?? "");
    if (!tp || !Number.isFinite(tp)) continue;

    const mw = Number(row.GenerationMegawatts ?? row.Generation ?? "");
    if (!Number.isFinite(mw) || mw <= 0) continue;

    // Resolve the date: prefer per-row TradingDate if present (monthly files),
    // fall back to the parameter (per-day files and tests).
    const date = (row.TradingDate ?? row.Trading_Date ?? tradingDate).trim();
    const halfHourTs = nzTradingPeriodUtc(date, tp);
    if (!halfHourTs) continue;

    const d = new Date(halfHourTs);
    d.setUTCMinutes(0, 0, 0);
    const hour = d.toISOString();

    // Accumulate MW × 0.5 h = MWh per interval; sum of two TPs per UTC hour
    // equals total MWh curtailed in that hour = average curtailed MW × 1 h.
    hours.set(hour, (hours.get(hour) ?? 0) + mw * 0.5);
  }

  return Array.from(hours.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw }));
}

export function buildNzHydroData(points: CurtailmentPoint[]): RegionData {
  return {
    regionId: "new-zealand-hydro",
    profile: timeOfDayAverageGW(points),
    latestProfile: latestCompleteUtcDayProfileGW(points),
    totalTWh: totalTWh30d(points),
    peakGW: peakGW(points),
    lastUpdated: points.at(-1)?.utcTimestamp ?? new Date().toISOString(),
    lastSuccessAt: points.at(-1)?.utcTimestamp ?? new Date().toISOString(),
    sourceNote: "EMI DispatchNodalPricesAndVolumes ≤$0/MWh nodal price signal — Waitaki corridor (BEN/ROX/CYD/TWZ/TKU), Manapouri (MAT), Waikato (ARO/ATI/KAW/OHA/WAI)",
    fuelShare: { hydro: 1 },
  };
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

const run = async (): Promise<RegionData> => {
  const now = new Date();
  // NodalPricesAndVolumes files have the same ~1–1.5 month publication lag as
  // Generation_MD. Look back 5 months and stop once we have 2 months of data.
  const LOOKBACK = 5;
  const months = Array.from({ length: LOOKBACK }, (_, i) =>
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)),
  );

  const allPoints: CurtailmentPoint[] = [];
  let monthsFetched = 0;

  for (const date of months) {
    if (monthsFetched >= 2) break;
    const key = monthKey(date);
    try {
      const csv = await fetchText(
        `${BASE_URL}/${key}_DispatchNodalPricesAndVolumes.csv`,
        { timeoutMs: 60_000, retries: 1 },
      );
      // Monthly files carry a TradingDate column — pass an empty string as
      // the fallback date; the parser will read from each row.
      const pts = parseEmiNodalCsv(csv, "");
      if (pts.length) {
        allPoints.push(...pts);
        monthsFetched++;
      }
    } catch (err) {
      console.warn(`nz-hydro nodal month skipped ${key}: ${(err as Error).message}`);
    }
  }

  if (!allPoints.length) throw new Error("NZ EMI DispatchNodalPricesAndVolumes returned no usable hydro curtailment points");
  return buildNzHydroData(allPoints);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  withFallback<RegionData>("new-zealand-hydro", run, {
    regionTier: "live" as const,
    tagLive: (r) => ({ ...r, sourceStatus: "live" as const }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" as const }),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("new-zealand-hydro loader failed", err);
      process.exit(1);
    });
}
