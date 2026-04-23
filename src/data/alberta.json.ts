import { fetchText } from "../lib/fetch.js";
import { timeOfDayAverageGW, totalTWh30d, peakGW } from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";
import { pathToFileURL } from "url";

const CURTAILMENT_RATE = 0.05;
const AESO_URL = "http://ets.aeso.ca/ets_web/ip/Market/Reports/CSDReportServlet";

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

function buildFlatHistory(lastUpdatedIso: string, curtailedMw: number): CurtailmentPoint[] {
  const end = new Date(lastUpdatedIso).getTime();
  const points: CurtailmentPoint[] = [];
  for (let offset = 30 * 24 - 1; offset >= 0; offset--) {
    points.push({
      utcTimestamp: new Date(end - offset * 3600 * 1000).toISOString(),
      mw: curtailedMw,
    });
  }
  return points;
}

const run = async (): Promise<RegionData> => {
  const html = await fetchText(AESO_URL, { timeoutMs: 45000, retries: 1 });
  const snapshot = parseAesoCurrentReport(html);
  const points = buildFlatHistory(new Date().toISOString(), snapshot.windMw * CURTAILMENT_RATE);

  return {
    regionId: "alberta",
    profile: timeOfDayAverageGW(points),
    totalTWh: totalTWh30d(points),
    peakGW: peakGW(points),
    lastUpdated: new Date().toISOString(),
    sourceNote:
      `AESO Current Supply Demand wind snapshot × 5% calibrated curtailment proxy; historical public archive not wired yet (snapshot ${snapshot.lastUpdated})`,
  };
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<RegionData>("alberta", run, {
    tagLive: (r) => ({ ...r, sourceStatus: "live" as const }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" as const }),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("alberta loader failed", err);
      process.exit(1);
    });
}
