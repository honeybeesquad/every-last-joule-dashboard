import { fetchText } from "../lib/fetch.js";
import { parseDelimitedRows } from "../lib/csv.js";
import {
  latestCompleteUtcDayProfileGW,
  peakGW,
  timeOfDayAverageGW,
  totalTWh30d,
} from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";
import { pathToFileURL } from "url";

const IEMOP_RTD_URL = "https://www.iemop.ph/market-data/rtd-prices-and-schedules/";
const CURTAILMENT_RATE = 0.02;

function parseIemopTimestamp(value: string): string | null {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, m, d, y, h, min] = match;
  const hour = String(h).padStart(2, "0");
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T${hour}:${min}:00.000Z`;
}

export interface IemopParsed {
  solarPoints: CurtailmentPoint[];
  windPoints: CurtailmentPoint[];
  solarMwhTotal: number;
  windMwhTotal: number;
}

export function parseIemopRTD(csv: string): IemopParsed {
  const rows = parseDelimitedRows(csv);
  const solarByTs = new Map<string, number>();
  const windByTs = new Map<string, number>();
  let solarMwhTotal = 0;
  let windMwhTotal = 0;

  for (const row of rows) {
    const timestamp = row["RUN_TIME"];
    if (!timestamp) continue;
    const utcTimestamp = parseIemopTimestamp(timestamp);
    if (!utcTimestamp) continue;

    const resourceName = row["RESOURCE_NAME"] ?? "";
    const resourceType = row["RESOURCE_TYPE"] ?? "";
    const schedMw = Math.max(0, Number(row["SCHED_MW"]) ?? 0);

    if (resourceType !== "G") continue;

    const isSolar = /\b(sol|pv|spv|solar|tho|csp|thermal|ray)\b/i.test(resourceName);
    const isWind = /\b(wind|wnd|wst)\b/i.test(resourceName);

    if (!isSolar && !isWind) continue;

    const curtailed = schedMw * CURTAILMENT_RATE;

    if (isSolar) {
      solarByTs.set(utcTimestamp, (solarByTs.get(utcTimestamp) ?? 0) + curtailed);
      solarMwhTotal += curtailed;
    } else {
      windByTs.set(utcTimestamp, (windByTs.get(utcTimestamp) ?? 0) + curtailed);
      windMwhTotal += curtailed;
    }
  }

  const solarPoints: CurtailmentPoint[] = Array.from(solarByTs.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw, intervalHours: 1 }));

  const windPoints: CurtailmentPoint[] = Array.from(windByTs.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw, intervalHours: 1 }));

  return { solarPoints, windPoints, solarMwhTotal, windMwhTotal };
}

function buildRegion(
  regionId: "philippines-solar" | "philippines-wind",
  points: CurtailmentPoint[],
  fuel: "solar" | "wind",
  lastUpdated: string,
): RegionData {
  const base: RegionData = {
    regionId,
    profile: timeOfDayAverageGW(points),
    latestProfile: latestCompleteUtcDayProfileGW(points),
    totalTWh: totalTWh30d(points),
    peakGW: peakGW(points),
    lastUpdated,
    lastSuccessAt: lastUpdated,
    sourceNote: `IEMOP RTD dispatch schedule (${fuel}) × ${CURTAILMENT_RATE * 100}% curtailment calibration; WESM Luzon/Visayas/Mindanao grids; fuel type: ${fuel}`,
    fuelShare: { [fuel]: 1 },
  };
  return applyUncertainty(base, { regionTier: "live" });
}

function isRegionData(value: unknown): value is RegionData {
  return typeof value === "object" && value !== null
    && typeof (value as RegionData).regionId === "string"
    && Array.isArray((value as RegionData).profile);
}

function forceFuel(data: RegionData, fuel: "solar" | "wind"): RegionData {
  return { ...data, fuelShare: { [fuel]: 1 } };
}

function normalizeCachedPhilippines(cached: unknown): Record<string, RegionData> {
  if (isRegionData(cached)) {
    const solar = cached.fuelShare?.solar ?? 0.5;
    const wind = cached.fuelShare?.wind ?? 0.5;
    return {
      "philippines-solar": forceFuel({ ...cached, regionId: "philippines-solar" }, "solar"),
      "philippines-wind": forceFuel({ ...cached, regionId: "philippines-wind" }, "wind"),
    };
  }
  return cached as Record<string, RegionData>;
}

function trailingPoints(points: CurtailmentPoint[], days = 30): CurtailmentPoint[] {
  const sorted = [...points].sort((a, b) => a.utcTimestamp.localeCompare(b.utcTimestamp));
  const latest = sorted.at(-1);
  if (!latest) return [];
  const cutoff = new Date(new Date(latest.utcTimestamp).getTime() - days * 24 * 3600 * 1000);
  return sorted.filter((point) => new Date(point.utcTimestamp) >= cutoff);
}

const run = async (): Promise<Record<string, RegionData>> => {
  const html = await fetchText(IEMOP_RTD_URL, { timeoutMs: 45000, retries: 1 });

  const zipUrlMatch = html.match(/https:\/\/www\.iemop\.ph\/market-data\/rtd-prices-and-schedules\/\?[^"'<> ]+sort=desc[^"'<> ]*/i);
  const zipUrl = zipUrlMatch
    ? zipUrlMatch[0].replace(/&amp;/g, "&")
    : IEMOP_RTD_URL + "?sort=desc&page=1";

  const zipBuffer = await fetchText(zipUrl, { timeoutMs: 120000, retries: 1 });

  const jszip = await import("jszip").then((m) => m.default);
  const zip = await jszip.loadAsync(Buffer.from(zipBuffer));

  const hourFiles = zip.file(/RTD_\d{8}\d{4}\.zip$/i) ?? [];

  const allSolarPoints: CurtailmentPoint[] = [];
  const allWindPoints: CurtailmentPoint[] = [];

  for (const hourFile of hourFiles) {
    try {
      const innerZipBuffer = await hourFile.async("nodebuffer");
      const jszipInner = await import("jszip").then((m) => m.default);
      const innerZip = await jszipInner.loadAsync(innerZipBuffer);

      const csvFiles = innerZip.file(/RTD_\d{8}\d{4}\.csv$/i) ?? [];
      for (const csvFile of csvFiles) {
        const csv = await csvFile.async("string");
        const parsed = parseIemopRTD(csv);
        allSolarPoints.push(...parsed.solarPoints);
        allWindPoints.push(...parsed.windPoints);
      }
    } catch {
      // individual hourly files may fail; skip
    }
  }

  if (allSolarPoints.length === 0 && allWindPoints.length === 0) {
    throw new Error("IEMOP RTD contained no renewable dispatch points");
  }

  const wind30d = trailingPoints(allWindPoints);
  const solar30d = trailingPoints(allSolarPoints);

  const allPoints = [...wind30d, ...solar30d];
  const lastUpdated = allPoints
    .sort((a, b) => a.utcTimestamp.localeCompare(b.utcTimestamp))
    .at(-1)?.utcTimestamp ?? new Date().toISOString();

  const out: Record<string, RegionData> = {};
  if (wind30d.length > 0) {
    out["philippines-wind"] = buildRegion("philippines-wind", wind30d, "wind", lastUpdated);
  }
  if (solar30d.length > 0) {
    out["philippines-solar"] = buildRegion("philippines-solar", solar30d, "solar", lastUpdated);
  }
  return out;
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<Record<string, RegionData>>("philippines", run, {
    tagLive: (r) => {
      const tagged: Record<string, RegionData> = {};
      for (const [k, v] of Object.entries(r)) tagged[k] = { ...v, sourceStatus: "live" as const };
      return tagged;
    },
    tagCached: (c) => {
      const tagged: Record<string, RegionData> = {};
      for (const [k, v] of Object.entries(normalizeCachedPhilippines(c))) tagged[k] = { ...v, sourceStatus: "cached" as const };
      return tagged;
    },
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("philippines loader failed", err);
      process.exit(1);
    });
}

export const buildPhilippinesData = (data: IemopParsed, lastUpdated: string): Record<string, RegionData> => {
  const out: Record<string, RegionData> = {};
  if (data.solarPoints.length > 0) {
    out["philippines-solar"] = buildRegion("philippines-solar", data.solarPoints, "solar", lastUpdated);
  }
  if (data.windPoints.length > 0) {
    out["philippines-wind"] = buildRegion("philippines-wind", data.windPoints, "wind", lastUpdated);
  }
  return out;
};