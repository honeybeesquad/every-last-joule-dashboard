import { XMLParser } from "fast-xml-parser";
import { fetchText } from "./fetch.js";
import { timeOfDayAverageGW, totalTWh30d, peakGW, latestCompleteUtcDayProfileGW } from "./profile.js";
import type { RegionData, CurtailmentPoint } from "./types.js";

const API = "https://web-api.tp.entsoe.eu/api";

type EntsoeFuel = "solar" | "wind" | "hydro";

export interface EntsoeTechnologySpec {
  psrType: string;
  fuel: EntsoeFuel;
  rate: number;
}

export interface EntsoeSingleZoneSpec {
  id: string;
  domain: string;
  psrType: string;
  rate: number;
  sourceNote: string;
}

export interface EntsoeMultiZoneSpec {
  id: string;
  domain: string;
  technologies: readonly EntsoeTechnologySpec[];
  sourceNote: string;
}

export type EntsoeZoneSpec = EntsoeSingleZoneSpec | EntsoeMultiZoneSpec;

export function inferFromPsrType(psrType: string): EntsoeFuel {
  if (psrType === "B16") return "solar";
  if (psrType === "B18" || psrType === "B19") return "wind";
  if (psrType === "B11" || psrType === "B12" || psrType === "B14") return "hydro";
  return "solar";
}

function resolutionMs(resolution: string | undefined): number {
  if (resolution === "PT15M") return 15 * 60 * 1000;
  if (resolution === "PT30M") return 30 * 60 * 1000;
  if (resolution === "PT60M" || resolution === "PT1H") return 60 * 60 * 1000;
  return 15 * 60 * 1000;
}

function resolutionHours(resolution: string | undefined): number {
  return resolutionMs(resolution) / (60 * 60 * 1000);
}

export function parseEntsoeXml(xml: string): CurtailmentPoint[] {
  const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: true });
  const doc = parser.parse(xml);
  const marketDocument = doc.GL_MarketDocument;
  if (!marketDocument) return [];

  const timeSeriesList = Array.isArray(marketDocument.TimeSeries)
    ? marketDocument.TimeSeries
    : [marketDocument.TimeSeries].filter(Boolean);

  const pointsMap = new Map<string, { mw: number; intervalHours: number }>();

  for (const ts of timeSeriesList) {
    const periods = Array.isArray(ts.Period) ? ts.Period : [ts.Period].filter(Boolean);
    for (const period of periods) {
      if (!period?.timeInterval?.start) continue;

      const startTime = new Date(period.timeInterval.start).getTime();
      const stepMs = resolutionMs(period.resolution);
      const intervalHours = resolutionHours(period.resolution);
      const points = Array.isArray(period.Point) ? period.Point : [period.Point].filter(Boolean);

      for (const p of points) {
        const position = parseInt(p.position, 10);
        const quantity = parseFloat(p.quantity);
        if (!Number.isFinite(position) || !Number.isFinite(quantity)) continue;

        const timestamp = new Date(startTime + (position - 1) * stepMs).toISOString();
        const existing = pointsMap.get(timestamp);
        pointsMap.set(timestamp, {
          mw: (existing?.mw ?? 0) + quantity,
          intervalHours: existing?.intervalHours ?? intervalHours,
        });
      }
    }
  }

  return Array.from(pointsMap.entries())
    .map(([utcTimestamp, point]) => ({
      utcTimestamp,
      mw: point.mw,
      intervalHours: point.intervalHours,
    }))
    .sort((a, b) => a.utcTimestamp.localeCompare(b.utcTimestamp));
}

export function buildZoneData(
  id: string,
  rawPoints: CurtailmentPoint[],
  rate: number,
  sourceNote: string,
  fuelShare?: RegionData["fuelShare"],
): RegionData {
  const points = rawPoints.map((p) => ({
    utcTimestamp: p.utcTimestamp,
    mw: Math.max(0, p.mw * rate),
    intervalHours: p.intervalHours,
  }));

  const data: RegionData = {
    regionId: id,
    profile: timeOfDayAverageGW(points),
    latestProfile: latestCompleteUtcDayProfileGW(points),
    totalTWh: totalTWh30d(points),
    peakGW: peakGW(points),
    lastUpdated: rawPoints.at(-1)?.utcTimestamp ?? new Date().toISOString(),
    sourceNote,
  };

  if (fuelShare && Object.keys(fuelShare).length > 0) data.fuelShare = fuelShare;
  return data;
}

function normalizeTechnologies(zone: EntsoeZoneSpec): readonly EntsoeTechnologySpec[] {
  if ("technologies" in zone) return zone.technologies;
  return [{ psrType: zone.psrType, fuel: inferFromPsrType(zone.psrType), rate: zone.rate }];
}

function fuelSplitNote(fuelShare: RegionData["fuelShare"]): string {
  const parts = (["wind", "solar", "hydro"] as const)
    .filter((fuel) => (fuelShare?.[fuel] ?? 0) > 0)
    .map((fuel) => `${fuel} ${((fuelShare?.[fuel] ?? 0) * 100).toFixed(0)}%`);
  return parts.join(" / ");
}

function technologyNote(technologies: readonly EntsoeTechnologySpec[]): string {
  return technologies
    .map((tech) => `${tech.fuel} ${tech.psrType} × ${(tech.rate * 100).toFixed(tech.rate < 0.01 ? 2 : 1).replace(/\.0$/, "")}%`)
    .join(" + ");
}

export async function fetchEntsoeZone(zone: EntsoeZoneSpec): Promise<RegionData> {
  const token = process.env.ENTSOE_API_TOKEN;
  if (!token) throw new Error("ENTSOE_API_TOKEN not set");

  const now = new Date();
  const start = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:T]/g, "").slice(0, 12);
  const technologies = normalizeTechnologies(zone);

  const series = await Promise.all(technologies.map(async (technology) => {
    const params = new URLSearchParams({
      securityToken: token,
      documentType: "A75",
      processType: "A16",
      in_Domain: zone.domain,
      psrType: technology.psrType,
      periodStart: fmt(start),
      periodEnd: fmt(now),
    });

    try {
      const xml = await fetchText(`${API}?${params.toString()}`);
      const points = parseEntsoeXml(xml);
      if (points.length === 0) {
        console.warn(`ENTSO-E ${zone.id} ${technology.psrType} returned zero data; continuing`);
      }
      return { technology, points };
    } catch (err) {
      console.warn(`ENTSO-E ${zone.id} ${technology.psrType} fetch failed; continuing`, err);
      return { technology, points: [] };
    }
  }));

  const summed = new Map<string, { mw: number; intervalHours: number | undefined }>();
  const fuelTotals: Partial<Record<EntsoeFuel, number>> = {};
  let lastUpdated: string | undefined;

  for (const { technology, points } of series) {
    for (const point of points) {
      const mw = Math.max(0, point.mw * technology.rate);
      const existing = summed.get(point.utcTimestamp);
      summed.set(point.utcTimestamp, {
        mw: (existing?.mw ?? 0) + mw,
        intervalHours: existing?.intervalHours ?? point.intervalHours,
      });
      fuelTotals[technology.fuel] = (fuelTotals[technology.fuel] ?? 0) + mw * (point.intervalHours ?? 1);
      if (!lastUpdated || point.utcTimestamp > lastUpdated) lastUpdated = point.utcTimestamp;
    }
  }

  const points = Array.from(summed.entries())
    .map(([utcTimestamp, point]) => ({
      utcTimestamp,
      mw: point.mw,
      intervalHours: point.intervalHours,
    }))
    .sort((a, b) => a.utcTimestamp.localeCompare(b.utcTimestamp));

  const denom = Object.values(fuelTotals).reduce((sum, value) => sum + (value ?? 0), 0);
  const fuelShare = denom > 0
    ? Object.fromEntries(
        Object.entries(fuelTotals)
          .filter(([, value]) => (value ?? 0) > 0)
          .map(([fuel, value]) => [fuel, (value ?? 0) / denom]),
      ) as RegionData["fuelShare"]
    : undefined;
  const split = fuelSplitNote(fuelShare);
  const sourceNote = split
    ? `ENTSO-E ${technologyNote(technologies)} calibrated (observed 30d split: ${split}). ${zone.sourceNote}`
    : zone.sourceNote;

  return {
    regionId: zone.id,
    profile: timeOfDayAverageGW(points),
    latestProfile: latestCompleteUtcDayProfileGW(points),
    totalTWh: totalTWh30d(points),
    peakGW: peakGW(points),
    lastUpdated: lastUpdated ?? new Date().toISOString(),
    sourceNote,
    ...(fuelShare ? { fuelShare } : {}),
  };
}
