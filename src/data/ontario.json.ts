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
  windPoints: CurtailmentPoint[];
  solarPoints: CurtailmentPoint[];
  windMwTotal: number;
  solarMwTotal: number;
}

export function parseOntarioXml(xml: string): OntarioParsed {
  const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: true, removeNSPrefix: true });
  const doc = parser.parse(xml) as OntarioDoc;
  const body = doc.IMODocument?.IMODocBody;
  const reportDate = body?.Date;
  if (!reportDate) return { points: [], windPoints: [], solarPoints: [], windMwTotal: 0, solarMwTotal: 0 };

  const generators = Array.isArray(body?.Generators?.Generator)
    ? body?.Generators?.Generator
    : [body?.Generators?.Generator].filter(Boolean);

  const totals = new Map<string, number>();
  const windTotals = new Map<string, number>();
  const solarTotals = new Map<string, number>();
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
      if (fuel === "WIND") {
        windTotals.set(utcTimestamp, (windTotals.get(utcTimestamp) ?? 0) + curtailedMw);
        windMwTotal += curtailedMw;
      } else {
        solarTotals.set(utcTimestamp, (solarTotals.get(utcTimestamp) ?? 0) + curtailedMw);
        solarMwTotal += curtailedMw;
      }
    }
  }

  const toPoints = (map: Map<string, number>) => Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw }));
  return {
    points: toPoints(totals),
    windPoints: toPoints(windTotals),
    solarPoints: toPoints(solarTotals),
    windMwTotal,
    solarMwTotal,
  };
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

type OntarioRegions = Record<"ontario-wind" | "ontario-solar", RegionData>;

function splitLegacyOntarioCache(data: RegionData | OntarioRegions): OntarioRegions {
  if ("ontario-wind" in data && "ontario-solar" in data) return data;

  const windShare = data.fuelShare?.wind ?? 1;
  const solarShare = data.fuelShare?.solar ?? 0;
  const scale = (regionId: "ontario-wind" | "ontario-solar", share: number, sourceNote: string): RegionData => ({
    ...data,
    regionId,
    profile: data.profile.map((value) => value * share),
    latestProfile: data.latestProfile ? data.latestProfile.map((value) => value * share) : null,
    totalTWh: data.totalTWh * share,
    peakGW: data.peakGW * share,
    sourceNote,
    fuelShare: undefined,
    confidenceTier: undefined,
    uncertaintyLowGW: undefined,
    uncertaintyHighGW: undefined,
  });

  return {
    "ontario-wind": scale(
      "ontario-wind",
      windShare,
      "IESO hourly wind generation capability × 4% calibrated curtailment proxy (split from legacy Ontario wind+solar cache)",
    ),
    "ontario-solar": scale(
      "ontario-solar",
      solarShare,
      "IESO hourly solar generation capability × 2% calibrated curtailment proxy (split from legacy Ontario wind+solar cache)",
    ),
  };
}

const run = async (): Promise<OntarioRegions> => {
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

  const parsedDocs = xmlDocs.map((xml) => (xml ? parseOntarioXml(xml) : { points: [], windPoints: [], solarPoints: [], windMwTotal: 0, solarMwTotal: 0 }));
  const points = parsedDocs.flatMap((p) => p.points);
  if (points.length === 0) throw new Error("IESO returned no usable wind or solar output points");

  const buildRegion = (
    regionId: "ontario-wind" | "ontario-solar",
    fuelPoints: CurtailmentPoint[],
    sourceNote: string,
  ): RegionData => ({
    regionId,
    profile: timeOfDayAverageGW(fuelPoints),
    latestProfile: latestCompleteUtcDayProfileGW(fuelPoints),
    totalTWh: totalTWh30d(fuelPoints),
    peakGW: peakGW(fuelPoints),
    lastUpdated: fuelPoints.at(-1)?.utcTimestamp ?? points.at(-1)?.utcTimestamp ?? now.toISOString(),
    lastSuccessAt: fuelPoints.at(-1)?.utcTimestamp ?? points.at(-1)?.utcTimestamp ?? now.toISOString(),
    sourceNote,
  });

  return {
    "ontario-wind": buildRegion(
      "ontario-wind",
      parsedDocs.flatMap((p) => p.windPoints),
      "IESO hourly wind generation capability × 4% calibrated curtailment proxy",
    ),
    "ontario-solar": buildRegion(
      "ontario-solar",
      parsedDocs.flatMap((p) => p.solarPoints),
      "IESO hourly solar generation capability × 2% calibrated curtailment proxy",
    ),
  };
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<OntarioRegions | RegionData>("ontario", run, {
    regionTier: "live" as const,
    tagCached: splitLegacyOntarioCache,
  })
    .then((data) => process.stdout.write(JSON.stringify(splitLegacyOntarioCache(data))))
    .catch((err) => {
      console.error("ontario loader failed", err);
      process.exit(1);
    });
}
