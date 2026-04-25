import { XMLParser } from "fast-xml-parser";
import { fetchText } from "../lib/fetch.js";
import { timeOfDayAverageGW, totalTWh30d, peakGW, latestCompleteUtcDayProfileGW } from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";
import { pathToFileURL } from "url";

// Ontario wind curtailment is real and persistent (~1-2 TWh/yr historically);
// solar curtailment is smaller but meaningful during spring shoulder-demand
// windows (~0.2-0.3 TWh/yr estimated). We proxy both via IESO Gen Output
// Capability XML since IESO doesn't publish direct curtailment feeds.
const WIND_CURTAILMENT_RATE = 0.04;
const SOLAR_CURTAILMENT_RATE = 0.02;
const IESO_BASE = "https://reports-public.ieso.ca/public/GenOutputCapability";

interface OntarioDoc {
  IMODocument?: {
    IMODocBody?: {
      Date?: string;
      Generators?: {
        Generator?: OntarioGenerator | OntarioGenerator[];
      };
    };
  };
}

interface OntarioGenerator {
  FuelType?: string;
  Outputs?: {
    Output?: OntarioOutput | OntarioOutput[];
  };
}

interface OntarioOutput {
  Hour?: number;
  EnergyMW?: number;
}

export interface OntarioParsed {
  points: CurtailmentPoint[];
  windMwTotal: number;
  solarMwTotal: number;
}

export function parseOntarioXml(xml: string): OntarioParsed {
  const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: true, removeNSPrefix: true });
  const doc = parser.parse(xml) as OntarioDoc;
  const body = doc.IMODocument?.IMODocBody;
  const reportDate = body?.Date;
  if (!reportDate) return { points: [], windMwTotal: 0, solarMwTotal: 0 };

  const generators = Array.isArray(body?.Generators?.Generator)
    ? body?.Generators?.Generator
    : [body?.Generators?.Generator].filter(Boolean);

  const totals = new Map<string, number>();
  let windMwTotal = 0;
  let solarMwTotal = 0;

  for (const generator of generators) {
    if (!generator) continue;
    const fuel = generator.FuelType;
    // IESO FuelType values of interest: "WIND", "SOLAR".
    const rate = fuel === "WIND"
      ? WIND_CURTAILMENT_RATE
      : fuel === "SOLAR"
        ? SOLAR_CURTAILMENT_RATE
        : null;
    if (rate === null) continue;

    const outputs = Array.isArray(generator.Outputs?.Output)
      ? generator.Outputs?.Output
      : [generator.Outputs?.Output].filter(Boolean);

    for (const output of outputs) {
      const hour = Number(output?.Hour);
      const energyMw = Number(output?.EnergyMW);
      if (!Number.isFinite(hour) || !Number.isFinite(energyMw)) continue;
      if (hour < 1 || hour > 24) continue;

      const utcTimestamp = new Date(
        `${reportDate}T${String(hour - 1).padStart(2, "0")}:00:00Z`,
      ).toISOString();
      const curtailedMw = Math.max(0, energyMw) * rate;
      totals.set(utcTimestamp, (totals.get(utcTimestamp) ?? 0) + curtailedMw);
      if (fuel === "WIND") windMwTotal += curtailedMw;
      else solarMwTotal += curtailedMw;
    }
  }

  const points = Array.from(totals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw }));
  return { points, windMwTotal, solarMwTotal };
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

const run = async (): Promise<RegionData> => {
  const now = new Date();
  const urls = [`${IESO_BASE}/PUB_GenOutputCapability.xml`];

  for (let daysAgo = 1; daysAgo < 30; daysAgo++) {
    const date = new Date(now.getTime() - daysAgo * 24 * 3600 * 1000);
    urls.push(`${IESO_BASE}/PUB_GenOutputCapability_${formatDate(date)}.xml`);
  }

  const xmlDocs = await Promise.all(
    urls.map(async (url) => {
      try {
        return await fetchText(url, { timeoutMs: 45000, retries: 1 });
      } catch (err) {
        console.warn(`ieso fetch skipped: ${url}: ${(err as Error).message}`);
        return null;
      }
    }),
  );

  const parsedDocs = xmlDocs.map((xml) => (xml ? parseOntarioXml(xml) : { points: [], windMwTotal: 0, solarMwTotal: 0 }));
  const points = parsedDocs.flatMap((p) => p.points);
  if (points.length === 0) throw new Error("IESO returned no usable wind or solar output points");

  const windMwTotal = parsedDocs.reduce((s, p) => s + p.windMwTotal, 0);
  const solarMwTotal = parsedDocs.reduce((s, p) => s + p.solarMwTotal, 0);
  const denom = windMwTotal + solarMwTotal;
  const fuelShare = denom > 0
    ? { wind: windMwTotal / denom, solar: solarMwTotal / denom }
    : { wind: 1, solar: 0 };

  return {
    regionId: "ontario",
    profile: timeOfDayAverageGW(points),
    latestProfile: latestCompleteUtcDayProfileGW(points),
    totalTWh: totalTWh30d(points),
    peakGW: peakGW(points),
    lastUpdated: points.at(-1)?.utcTimestamp ?? now.toISOString(),
    lastSuccessAt: points.at(-1)?.utcTimestamp ?? now.toISOString(),
    sourceNote: `IESO hourly wind × 4% + solar × 2% calibrated curtailment (observed 30d split: wind ${(fuelShare.wind * 100).toFixed(0)}% / solar ${(fuelShare.solar * 100).toFixed(0)}%)`,
    fuelShare,
  };
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<RegionData>("ontario", run, {
    regionTier: "live" as const,
    tagLive: (r) => ({ ...r, sourceStatus: "live" as const }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" as const }),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("ontario loader failed", err);
      process.exit(1);
    });
}
