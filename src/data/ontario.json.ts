import { XMLParser } from "fast-xml-parser";
import { fetchText } from "../lib/fetch.js";
import { timeOfDayAverageGW, totalTWh30d, peakGW } from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";
import { pathToFileURL } from "url";

const CURTAILMENT_RATE = 0.04;
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

export function parseOntarioXml(xml: string): CurtailmentPoint[] {
  const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: true, removeNSPrefix: true });
  const doc = parser.parse(xml) as OntarioDoc;
  const body = doc.IMODocument?.IMODocBody;
  const reportDate = body?.Date;
  if (!reportDate) return [];

  const generators = Array.isArray(body?.Generators?.Generator)
    ? body?.Generators?.Generator
    : [body?.Generators?.Generator].filter(Boolean);

  const totals = new Map<string, number>();

  for (const generator of generators) {
    if (generator?.FuelType !== "WIND") continue;
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
      totals.set(utcTimestamp, (totals.get(utcTimestamp) ?? 0) + Math.max(0, energyMw));
    }
  }

  return Array.from(totals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([utcTimestamp, windMw]) => ({
      utcTimestamp,
      mw: windMw * CURTAILMENT_RATE,
    }));
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

  const points = xmlDocs.flatMap((xml) => (xml ? parseOntarioXml(xml) : []));
  if (points.length === 0) throw new Error("IESO returned no usable wind output points");

  return {
    regionId: "ontario",
    profile: timeOfDayAverageGW(points),
    totalTWh: totalTWh30d(points),
    peakGW: peakGW(points),
    lastUpdated: points.at(-1)?.utcTimestamp ?? now.toISOString(),
    sourceNote: "IESO hourly wind output × 4% calibrated curtailment proxy (Ontario 2024 wind actuals)",
  };
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<RegionData>("ontario", run, {
    tagLive: (r) => ({ ...r, sourceStatus: "live" as const }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" as const }),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("ontario loader failed", err);
      process.exit(1);
    });
}
