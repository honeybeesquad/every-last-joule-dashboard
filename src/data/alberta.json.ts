import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { solarProfile } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";
import { pathToFileURL } from "url";

const CURTAILMENT_RATE = 0.05;
const AESO_URL = "http://ets.aeso.ca/ets_web/ip/Market/Reports/CSDReportServlet";
const ALBERTA_SOLAR_PEAK_UTC = 18.5;
type AlbertaRegions = Record<"alberta-wind" | "alberta-solar", RegionData>;

export interface AlbertaSnapshot {
  lastUpdated: string;
  windMw: number;
  solarMw: number;
}

export function parseAesoCurrentReport(html: string): AlbertaSnapshot {
  const lastUpdatedMatch = html.match(/Last Update\s*:\s*([^<]+)/i);
  const windMatch = html.match(/<TR><TD>WIND<\/TD><TD>\d+<\/TD><TD>([\d.]+)<\/TD>/i);
  const solarMatch = html.match(/<TR><TD>SOLAR<\/TD><TD>\d+<\/TD><TD>([\d.]+)<\/TD>/i);

  if (!lastUpdatedMatch || !windMatch) {
    throw new Error("AESO current report is missing expected summary rows");
  }

  return {
    lastUpdated: lastUpdatedMatch[1].trim(),
    windMw: Number(windMatch[1]),
    solarMw: solarMatch ? Number(solarMatch[1]) : 0,
  };
}

export function buildAesoProxyProfile(windCurtMw: number, solarCurtMw: number): number[] {
  const windGW = windCurtMw / 1000;
  const windProfile = Array(24).fill(windGW);
  const annualSolarTWh = (solarCurtMw * 8760) / 1_000_000;
  const shapedSolar = solarCurtMw > 0
    ? solarProfile(ALBERTA_SOLAR_PEAK_UTC, annualSolarTWh)
    : Array(24).fill(0);

  return windProfile.map((wind, hour) => wind + shapedSolar[hour]);
}

function totalTWhFromProfile(profile: number[]): number {
  return profile.reduce((sum, gw) => sum + gw, 0) * 30 / 1000;
}

function buildRegion(
  regionId: "alberta-wind" | "alberta-solar",
  profile: number[],
  sourceNote: string,
  lastUpdated: string,
): RegionData {
  return {
    regionId,
    profile,
    latestProfile: null,
    totalTWh: totalTWhFromProfile(profile),
    peakGW: Math.max(0, ...profile),
    lastUpdated,
    lastSuccessAt: lastUpdated,
    sourceNote,
  };
}

export function buildAesoProxyRegions(snapshot: AlbertaSnapshot, lastUpdated = new Date().toISOString()): AlbertaRegions {
  const windCurt = snapshot.windMw * CURTAILMENT_RATE;
  const solarCurt = snapshot.solarMw * CURTAILMENT_RATE;
  const windProfile = Array(24).fill(windCurt / 1000);
  const combinedProfile = buildAesoProxyProfile(windCurt, solarCurt);
  const solarProfileOnly = combinedProfile.map((value, hour) => Math.max(0, value - windProfile[hour]));

  return {
    "alberta-wind": buildRegion(
      "alberta-wind",
      windProfile,
      `AESO wind snapshot × 5% curtailment proxy (snapshot ${snapshot.lastUpdated})`,
      lastUpdated,
    ),
    "alberta-solar": buildRegion(
      "alberta-solar",
      solarProfileOnly,
      `AESO solar snapshot × 5% curtailment proxy, shaped around Alberta local noon and zero overnight (snapshot ${snapshot.lastUpdated})`,
      lastUpdated,
    ),
  };
}

function splitLegacyAlbertaCache(data: RegionData | AlbertaRegions): AlbertaRegions {
  if ("alberta-wind" in data && "alberta-solar" in data) return data;

  const windShare = data.fuelShare?.wind ?? 1;
  const solarShare = data.fuelShare?.solar ?? 0;
  const averageGw = data.profile.reduce((sum, value) => sum + value, 0) / 24;
  const snapshot: AlbertaSnapshot = {
    lastUpdated: data.lastUpdated,
    windMw: (averageGw * windShare * 1000) / CURTAILMENT_RATE,
    solarMw: (averageGw * solarShare * 1000) / CURTAILMENT_RATE,
  };
  const split = buildAesoProxyRegions(snapshot, data.lastUpdated);
  for (const region of Object.values(split)) {
    region.lastSuccessAt = data.lastSuccessAt;
    region.sourceStatus = data.sourceStatus;
  }
  return split;
}

const run = async (): Promise<AlbertaRegions> => {
  const html = await fetchText(AESO_URL, { timeoutMs: 45000, retries: 1 });
  const snapshot = parseAesoCurrentReport(html);
  return buildAesoProxyRegions(snapshot);
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<AlbertaRegions | RegionData>("alberta", run, {
    regionTier: "live" as const,
    tagCached: splitLegacyAlbertaCache,
  })
    .then((data) => process.stdout.write(JSON.stringify(splitLegacyAlbertaCache(data))))
    .catch((err) => {
      console.error("alberta loader failed", err);
      process.exit(1);
    });
}
