import { fetchText } from "../lib/fetch.js";
import { timeOfDayAverageGW, totalTWh30d, peakGW, latestCompleteUtcDayProfileGW } from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";
import { pathToFileURL } from "url";

const SOLAR_RATE = 0.05;
const WIND_RATE = 0.05;
const AESO_URL = "http://ets.aeso.ca/ets_web/ip/Market/Reports/CSDReportServlet";

export interface AlbertaSnapshot {
  lastUpdated: string;
  windMw: number;
  solarMw: number;
}

/** Pure parser: extracts the WIND/SOLAR generation totals from the AESO CSD report. */
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

/**
 * AESO publishes a *snapshot* (current generation MW), not a time series.
 * We synthesize a flat 30-day x 24-hour series from that single value
 * so downstream calc helpers (timeOfDayAverageGW, totalTWh30d) don't
 * special-case alberta. Each fuel gets its own flat history at its own
 * curtailed MW rate.
 */
function buildFlatHistory(endIso: string, curtailedMw: number): CurtailmentPoint[] {
  const end = new Date(endIso).getTime();
  const points: CurtailmentPoint[] = [];
  for (let offset = 30 * 24 - 1; offset >= 0; offset--) {
    points.push({
      utcTimestamp: new Date(end - offset * 3600 * 1000).toISOString(),
      mw: curtailedMw,
    });
  }
  return points;
}

/** Build a per-fuel RegionData record. fuelShare is hard-set to 100%/0% for the fuel. */
export function buildPerFuelRegion(
  regionId: "alberta-solar" | "alberta-wind",
  snapshotMw: number,
  rate: number,
  endIso: string,
  sourceNote: string,
): RegionData {
  const curtailedMw = snapshotMw * rate;
  const points = buildFlatHistory(endIso, curtailedMw);
  return {
    regionId,
    profile: timeOfDayAverageGW(points),
    latestProfile: latestCompleteUtcDayProfileGW(points),
    totalTWh: totalTWh30d(points),
    peakGW: peakGW(points),
    lastUpdated: endIso,
    lastSuccessAt: endIso,
    sourceNote,
    fuelShare: regionId === "alberta-solar" ? { solar: 1, wind: 0 } : { solar: 0, wind: 1 },
  };
}

export interface AlbertaOutput {
  "alberta-solar": RegionData;
  "alberta-wind": RegionData;
}

const run = async (): Promise<AlbertaOutput> => {
  const html = await fetchText(AESO_URL, { timeoutMs: 45000, retries: 1 });
  const snapshot = parseAesoCurrentReport(html);
  const endIso = new Date().toISOString();

  return {
    "alberta-solar": buildPerFuelRegion(
      "alberta-solar",
      snapshot.solarMw,
      SOLAR_RATE,
      endIso,
      `AESO Current Supply Demand solar snapshot × 5% calibrated curtailment proxy (snapshot ${snapshot.lastUpdated})`,
    ),
    "alberta-wind": buildPerFuelRegion(
      "alberta-wind",
      snapshot.windMw,
      WIND_RATE,
      endIso,
      `AESO Current Supply Demand wind snapshot × 5% calibrated curtailment proxy (snapshot ${snapshot.lastUpdated})`,
    ),
  };
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<AlbertaOutput>("alberta", run, {
    regionTier: "live" as const,
    tagLive: (r) => ({ ...r, sourceStatus: "live" as const }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" as const }),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("alberta loader failed", err);
      process.exit(1);
    });
}
