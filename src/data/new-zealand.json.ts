import { pathToFileURL } from "node:url";
import { parseDelimitedRows } from "../lib/csv.js";
import { fetchText } from "../lib/fetch.js";
import { latestCompleteUtcDayProfileGW, peakGW, timeOfDayAverageGW, totalTWh30d } from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";

// EMI retired anonymous FTP/HTTP downloads at emi.ea.govt.nz; bulk CSVs are
// now served from the Azure Blob Storage publicdata container. See:
//   https://forum.emi.ea.govt.nz/thread/new-access-arrangements-to-emi-datasets-retirement-of-anonymous-ftp/
const BASE_URL = "https://emidatasets.blob.core.windows.net/publicdata/Datasets/Wholesale/Generation/Generation_MD";
const CURTAILMENT_RATE = 0.013;
const FUEL_CODES = new Set(["Wind", "Solar", "Geo", "WIND", "SOLAR", "GEO"]);

function nzTradingPeriodUtc(tradingDate: string, tp: number): string | null {
  const match = tradingDate.match(/^(\d{4})-(\d{2})-(\d{2})$/) ?? tradingDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const y = match[1].length === 4 ? Number(match[1]) : Number(match[3]);
  const m = match[1].length === 4 ? Number(match[2]) : Number(match[2]);
  const d = match[1].length === 4 ? Number(match[3]) : Number(match[1]);
  const minutes = (tp - 1) * 30;
  return new Date(Date.UTC(y, m - 1, d, 0, minutes - 12 * 60, 0)).toISOString();
}

export interface NzParsed {
  points: CurtailmentPoint[];
  /** Per-fuel aggregated curtailment MW over the 30-day window. */
  windMwTotal: number;
  solarMwTotal: number;
  geoMwTotal: number;
}

function normaliseFuel(code: string | undefined): "wind" | "solar" | "geo" | null {
  if (!code) return null;
  const c = code.toLowerCase();
  if (c.startsWith("wind")) return "wind";
  if (c.startsWith("solar")) return "solar";
  if (c.startsWith("geo")) return "geo";
  return null;
}

export function parseEmiGenerationCsv(csv: string): NzParsed {
  const rows = parseDelimitedRows(csv, ",");
  // Accumulate halfhour-level per (timestamp, fuel).
  const halfHoursWind = new Map<string, number>();
  const halfHoursSolar = new Map<string, number>();
  const halfHoursGeo = new Map<string, number>();
  for (const row of rows) {
    if (!FUEL_CODES.has(row.Fuel_Code)) continue;
    const fuel = normaliseFuel(row.Fuel_Code);
    if (!fuel) continue;
    const tradingDate = row.Trading_Date;
    for (let tp = 1; tp <= 50; tp++) {
      const kwh = Number(row[`TP${tp}`] || 0);
      if (!Number.isFinite(kwh) || kwh <= 0) continue;
      const utcTimestamp = nzTradingPeriodUtc(tradingDate, tp);
      if (!utcTimestamp) continue;
      const map = fuel === "wind" ? halfHoursWind : fuel === "solar" ? halfHoursSolar : halfHoursGeo;
      map.set(utcTimestamp, (map.get(utcTimestamp) ?? 0) + kwh);
    }
  }

  function halfHoursToPoints(map: Map<string, number>): CurtailmentPoint[] {
    const hours = new Map<string, number>();
    for (const [ts, kwh] of map) {
      const d = new Date(ts);
      d.setUTCMinutes(0, 0, 0);
      const hour = d.toISOString();
      const curtailMw = (kwh / 1000) * CURTAILMENT_RATE;
      hours.set(hour, (hours.get(hour) ?? 0) + curtailMw);
    }
    return Array.from(hours.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw }));
  }

  const windPoints = halfHoursToPoints(halfHoursWind);
  const solarPoints = halfHoursToPoints(halfHoursSolar);
  const geoPoints = halfHoursToPoints(halfHoursGeo);

  // Combined for backward compat
  const combined = new Map<string, number>();
  for (const p of [...windPoints, ...solarPoints, ...geoPoints])
    combined.set(p.utcTimestamp, (combined.get(p.utcTimestamp) ?? 0) + p.mw);
  const points = Array.from(combined.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw }));

  return {
    points,
    windMwTotal: windPoints.reduce((s, p) => s + p.mw, 0),
    solarMwTotal: solarPoints.reduce((s, p) => s + p.mw, 0),
    geoMwTotal: geoPoints.reduce((s, p) => s + p.mw, 0),
  };
}

export function buildNewZealandPerFuelData(parsed: NzParsed): { wind: RegionData; solar: RegionData; geo: RegionData } {
  const { points, windMwTotal, solarMwTotal, geoMwTotal } = parsed;
  const denom = windMwTotal + solarMwTotal + geoMwTotal;
  const fuelShare = denom > 0
    ? { wind: windMwTotal / denom, solar: solarMwTotal / denom, hydro: geoMwTotal / denom }
    : undefined;

  const lastUpdated = points.at(-1)?.utcTimestamp ?? new Date().toISOString();
  const noteBase = fuelShare
    ? `NZ EMI Generation_MD wind+solar+geothermal × 1.3% curtailment proxy (observed 30d split: wind ${(fuelShare.wind * 100).toFixed(0)}% / solar ${(fuelShare.solar * 100).toFixed(0)}% / geothermal ${((fuelShare.hydro ?? 0) * 100).toFixed(0)}%)`
    : "NZ EMI Generation_MD wind+solar+geothermal CSV × 1.3% calibrated curtailment proxy";

  function makePerFuelPoints(fuelMwFraction: number): CurtailmentPoint[] {
    return points.map(p => ({ ...p, mw: p.mw * fuelMwFraction }));
  }

  const totalMw = windMwTotal + solarMwTotal + geoMwTotal;
  const windFrac = totalMw > 0 ? windMwTotal / totalMw : 0;
  const solarFrac = totalMw > 0 ? solarMwTotal / totalMw : 0;
  const geoFrac = totalMw > 0 ? geoMwTotal / totalMw : 0;

  // Reconstruct per-fuel point lists from fractions applied to combined profile
  // (simpler than storing separately in parseEmiGenerationCsv)
  const windPts = makePerFuelPoints(windFrac);
  const solarPts = makePerFuelPoints(solarFrac);
  const geoPts = makePerFuelPoints(geoFrac);

  // Per-fuel regions deliberately do NOT carry the country-level fuelShare:
  // each region's totalTWh is already the per-fuel slice, and attaching the
  // shared mix would make dominantFuel(region) collapse all three regions
  // to whichever fuel happens to dominate the country mix (geothermal here)
  // — the Mar 2026 "all three NZ pillars same colour" bug. The mix info
  // remains visible in sourceNote.
  return {
    wind: {
      regionId: "new-zealand-wind",
      profile: timeOfDayAverageGW(windPts),
      latestProfile: latestCompleteUtcDayProfileGW(windPts),
      totalTWh: totalTWh30d(windPts),
      peakGW: peakGW(windPts),
      lastUpdated,
      lastSuccessAt: lastUpdated,
      sourceNote: noteBase + " — wind share",
    },
    solar: {
      regionId: "new-zealand-solar",
      profile: timeOfDayAverageGW(solarPts),
      latestProfile: latestCompleteUtcDayProfileGW(solarPts),
      totalTWh: totalTWh30d(solarPts),
      peakGW: peakGW(solarPts),
      lastUpdated,
      lastSuccessAt: lastUpdated,
      sourceNote: noteBase + " — solar share",
    },
    geo: {
      regionId: "new-zealand-geo",
      profile: timeOfDayAverageGW(geoPts),
      latestProfile: latestCompleteUtcDayProfileGW(geoPts),
      totalTWh: totalTWh30d(geoPts),
      peakGW: peakGW(geoPts),
      lastUpdated,
      lastSuccessAt: lastUpdated,
      sourceNote: noteBase + " — geothermal share",
    },
  };
}

/** @deprecated Use buildNewZealandPerFuelData */
export function buildNewZealandData(parsed: NzParsed): RegionData {
  const { points, windMwTotal, solarMwTotal, geoMwTotal } = parsed;
  const hydroBucketMw = geoMwTotal;
  const denom = windMwTotal + solarMwTotal + hydroBucketMw;
  const fuelShare = denom > 0
    ? { wind: windMwTotal / denom, solar: solarMwTotal / denom, hydro: hydroBucketMw / denom }
    : undefined;
  return {
    regionId: "new-zealand",
    profile: timeOfDayAverageGW(points),
    latestProfile: latestCompleteUtcDayProfileGW(points),
    totalTWh: totalTWh30d(points),
    peakGW: peakGW(points),
    lastUpdated: points.at(-1)?.utcTimestamp ?? new Date().toISOString(),
    lastSuccessAt: points.at(-1)?.utcTimestamp ?? new Date().toISOString(),
    sourceNote: fuelShare
      ? `NZ EMI Generation_MD wind+solar+geothermal × 1.3% curtailment proxy (observed 30d split: wind ${(fuelShare.wind * 100).toFixed(0)}% / solar ${(fuelShare.solar * 100).toFixed(0)}% / geothermal-as-hydro ${(fuelShare.hydro * 100).toFixed(0)}%)`
      : "NZ EMI Generation_MD wind+solar+geothermal CSV × 1.3% calibrated curtailment proxy",
    ...(fuelShare ? { fuelShare } : {}),
  };
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

const run = async (): Promise<{ wind: RegionData; solar: RegionData; geo: RegionData }> => {
  const now = new Date();
  // EMI Generation_MD CSVs are published with a ~1–1.5 month lag, so the
  // current and previous calendar months are usually 404. Look back five
  // months so we reliably catch the two most-recent published files.
  const LOOKBACK = 5;
  const months = Array.from({ length: LOOKBACK }, (_, i) =>
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)),
  );
  const allPoints: CurtailmentPoint[] = [];
  let windMwTotal = 0;
  let solarMwTotal = 0;
  let geoMwTotal = 0;
  let monthsFetched = 0;
  for (const date of months) {
    if (monthsFetched >= 2) break;  // two months of data is enough for 30d window
    const key = monthKey(date);
    try {
      const parsed = parseEmiGenerationCsv(await fetchText(`${BASE_URL}/${key}_Generation_MD.csv`, { timeoutMs: 60000, retries: 1 }));
      allPoints.push(...parsed.points);
      windMwTotal += parsed.windMwTotal;
      solarMwTotal += parsed.solarMwTotal;
      geoMwTotal += parsed.geoMwTotal;
      monthsFetched++;
    } catch (err) {
      console.warn(`nz emi month skipped ${key}: ${(err as Error).message}`);
    }
  }
  if (!allPoints.length) throw new Error("NZ EMI returned no usable Generation_MD rows");
  return buildNewZealandPerFuelData({ points: allPoints, windMwTotal, solarMwTotal, geoMwTotal });
};

function adaptCachedNzToPerFuel(
  cached: { wind: RegionData; solar: RegionData; geo: RegionData } | RegionData,
): { wind: RegionData; solar: RegionData; geo: RegionData } {
  if (cached && "wind" in cached && "solar" in cached && "geo" in cached) {
    return cached as { wind: RegionData; solar: RegionData; geo: RegionData };
  }
  const old = cached as RegionData;
  const windShare = old.fuelShare?.wind ?? 0.6;
  const solarShare = old.fuelShare?.solar ?? 0.1;
  const geoShare = old.fuelShare?.hydro ?? 0.3;
  return {
    wind: { ...old, regionId: "new-zealand-wind", totalTWh: old.totalTWh * windShare, peakGW: old.peakGW * windShare },
    solar: { ...old, regionId: "new-zealand-solar", totalTWh: old.totalTWh * solarShare, peakGW: old.peakGW * solarShare },
    geo: { ...old, regionId: "new-zealand-geo", totalTWh: old.totalTWh * geoShare, peakGW: old.peakGW * geoShare },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  withFallback<{ wind: RegionData; solar: RegionData; geo: RegionData }>("new-zealand", run, {
    regionTier: "live" as const,
    tagLive: (r) => r,
    tagCached: (c) => adaptCachedNzToPerFuel(c as { wind: RegionData; solar: RegionData; geo: RegionData } | RegionData),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("new-zealand loader failed", err);
      process.exit(1);
    });
}
