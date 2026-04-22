import { XMLParser } from "fast-xml-parser";
import { fetchText } from "../lib/fetch.js";
import { timeOfDayAverageGW, totalTWh30d, peakGW } from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import type { RegionData, CurtailmentPoint } from "../lib/types.js";

const ZONES = [
  { id: "germany", domain: "10Y1001A1001A82H", psrType: "B19", rate: 0.02,
    sourceNote: "ENTSO-E wind onshore × 2% calibrated curtailment rate (Germany 2024 redispatch book figures)" },
  { id: "iberia",  domain: "10YES-REE------0", psrType: "B16", rate: 0.02,
    sourceNote: "ENTSO-E solar × 2% calibrated curtailment rate (Iberia 2024)" },
  { id: "finland", domain: "10YFI-1--------U", psrType: "B19", rate: 0.05,
    sourceNote: "ENTSO-E wind onshore × 5% calibrated curtailment rate (Finland 2024 Nord Pool neg-price)" },
] as const;

const API = "https://web-api.tp.entsoe.eu/api";

/** Pure parser: XML string in, CurtailmentPoint[] out (pre-calibration). Exported for unit tests. */
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
    const period = ts.Period;
    if (!period) continue;

    const startStr = period.timeInterval?.start;
    if (!startStr) continue;

    const startTime = new Date(startStr).getTime();
    const resolution = period.resolution; // e.g., "PT15M"
    if (resolution !== "PT15M") {
      // For v0 we assume PT15M as per spec, but could handle others.
    }

    const points = Array.isArray(period.Point) 
      ? period.Point 
      : [period.Point].filter(Boolean);

    for (const p of points) {
      const position = parseInt(p.position, 10);
      const quantity = parseFloat(p.quantity);

      if (isNaN(position) || isNaN(quantity)) continue;

      // Position 1 -> start; Position N -> start + (N-1) * 15min
      const timestamp = new Date(startTime + (position - 1) * 15 * 60 * 1000).toISOString();
      
      const current = pointsMap.get(timestamp) ?? 0;
      pointsMap.set(timestamp, current + quantity);
    }
  }

  return Array.from(pointsMap.entries())
    .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw }))
    .sort((a, b) => a.utcTimestamp.localeCompare(b.utcTimestamp));
}

/** Apply calibration rate to raw generation points to produce curtailment proxy. */
function applyCalibration(points: CurtailmentPoint[], rate: number): CurtailmentPoint[] {
  return points.map(p => ({ utcTimestamp: p.utcTimestamp, mw: Math.max(0, p.mw * rate) }));
}

/** Build RegionData for one zone. Exported for tests. */
export function buildZoneData(id: string, rawPoints: CurtailmentPoint[], rate: number, sourceNote: string): RegionData {
  const points = applyCalibration(rawPoints, rate);
  return {
    regionId: id,
    profile: timeOfDayAverageGW(points),
    totalTWh: totalTWh30d(points),
    peakGW: peakGW(points),
    lastUpdated: rawPoints.at(-1)?.utcTimestamp ?? new Date().toISOString(),
    sourceNote,
  };
}

async function fetchZone(zone: typeof ZONES[number]): Promise<RegionData> {
  const token = process.env.ENTSOE_API_TOKEN;
  if (!token) throw new Error("ENTSOE_API_TOKEN not set");

  const now = new Date();
  const start = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:T]/g, "").slice(0, 12);   // YYYYMMDDHHMM

  const params = new URLSearchParams({
    securityToken: token,
    documentType: "A75",
    processType: "A16",
    in_Domain: zone.domain,
    psrType: zone.psrType,
    periodStart: fmt(start),
    periodEnd: fmt(now),
  });
  const url = `${API}?${params.toString()}`;
  const xml = await fetchText(url);
  const rawPoints = parseEntsoeXml(xml);
  return buildZoneData(zone.id, rawPoints, zone.rate, zone.sourceNote);
}

const run = async (): Promise<Record<string, RegionData>> => {
  const results = await Promise.all(ZONES.map(fetchZone));
  const out: Record<string, RegionData> = {};
  for (let i = 0; i < ZONES.length; i++) out[ZONES[i].id] = results[i];
  return out;
};

withFallback<Record<string, RegionData>>("entsoe", run, {
  tagLive: (r) => {
    const tagged: Record<string, RegionData> = {};
    for (const [k, v] of Object.entries(r)) tagged[k] = { ...v, sourceStatus: "live" };
    return tagged;
  },
  tagCached: (c) => {
    const tagged: Record<string, RegionData> = {};
    for (const [k, v] of Object.entries(c)) tagged[k] = { ...v, sourceStatus: "cached" };
    return tagged;
  },
})
  .then((data) => process.stdout.write(JSON.stringify(data)))
  .catch((err) => {
    console.error("entsoe loader failed", err);
    process.exit(1);
  });
