import { XMLParser } from "fast-xml-parser";
import { fetchText } from "./fetch.js";
import { timeOfDayAverageGW, totalTWh30d, peakGW, latestCompleteUtcDayProfileGW } from "./profile.js";
import type { RegionData, CurtailmentPoint } from "./types.js";

const API = "https://web-api.tp.entsoe.eu/api";

export interface EntsoeZoneSpec {
  id: string;
  domain: string;
  psrType: string;
  rate: number;
  sourceNote: string;
}

function resolutionMs(resolution: string | undefined): number {
  if (resolution === "PT15M") return 15 * 60 * 1000;
  if (resolution === "PT30M") return 30 * 60 * 1000;
  if (resolution === "PT60M" || resolution === "PT1H") return 60 * 60 * 1000;
  return 15 * 60 * 1000;
}

export function parseEntsoeXml(xml: string): CurtailmentPoint[] {
  const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: true });
  const doc = parser.parse(xml);
  const marketDocument = doc.GL_MarketDocument;
  if (!marketDocument) return [];

  const timeSeriesList = Array.isArray(marketDocument.TimeSeries)
    ? marketDocument.TimeSeries
    : [marketDocument.TimeSeries].filter(Boolean);

  const pointsMap = new Map<string, number>();

  for (const ts of timeSeriesList) {
    const periods = Array.isArray(ts.Period) ? ts.Period : [ts.Period].filter(Boolean);
    for (const period of periods) {
      if (!period?.timeInterval?.start) continue;

      const startTime = new Date(period.timeInterval.start).getTime();
      const stepMs = resolutionMs(period.resolution);
      const points = Array.isArray(period.Point) ? period.Point : [period.Point].filter(Boolean);

      for (const p of points) {
        const position = parseInt(p.position, 10);
        const quantity = parseFloat(p.quantity);
        if (!Number.isFinite(position) || !Number.isFinite(quantity)) continue;

        const timestamp = new Date(startTime + (position - 1) * stepMs).toISOString();
        pointsMap.set(timestamp, (pointsMap.get(timestamp) ?? 0) + quantity);
      }
    }
  }

  return Array.from(pointsMap.entries())
    .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw }))
    .sort((a, b) => a.utcTimestamp.localeCompare(b.utcTimestamp));
}

export function buildZoneData(
  id: string,
  rawPoints: CurtailmentPoint[],
  rate: number,
  sourceNote: string,
): RegionData {
  const points = rawPoints.map((p) => ({
    utcTimestamp: p.utcTimestamp,
    mw: Math.max(0, p.mw * rate),
  }));

  return {
    regionId: id,
    profile: timeOfDayAverageGW(points),
    latestProfile: latestCompleteUtcDayProfileGW(points),
    totalTWh: totalTWh30d(points),
    peakGW: peakGW(points),
    lastUpdated: rawPoints.at(-1)?.utcTimestamp ?? new Date().toISOString(),
    sourceNote,
  };
}

export async function fetchEntsoeZone(zone: EntsoeZoneSpec): Promise<RegionData> {
  const token = process.env.ENTSOE_API_TOKEN;
  if (!token) throw new Error("ENTSOE_API_TOKEN not set");

  const now = new Date();
  const start = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:T]/g, "").slice(0, 12);

  const params = new URLSearchParams({
    securityToken: token,
    documentType: "A75",
    processType: "A16",
    in_Domain: zone.domain,
    psrType: zone.psrType,
    periodStart: fmt(start),
    periodEnd: fmt(now),
  });

  const xml = await fetchText(`${API}?${params.toString()}`);
  const rawPoints = parseEntsoeXml(xml);
  return buildZoneData(zone.id, rawPoints, zone.rate, zone.sourceNote);
}
