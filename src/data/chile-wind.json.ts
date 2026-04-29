import { pathToFileURL } from "url";
import { fetchLatestWorkbook, parseCoordinadorWindXlsx } from "./chile-cen-reductions.js";
import { hourlyAverage } from "../lib/csv.js";
import { latestCompleteUtcDayProfileGW, peakGW, timeOfDayAverageGW, totalTWh30d } from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";

/**
 * Chile wind curtailment loader — CEN monthly ERV reduction workbook.
 *
 * CEN publishes monthly "Reducciones de Generacion Renovable" workbooks after
 * month close. The wind sheet is `Resumen-DiarioHorario-Eolico` after accent
 * normalisation, and rows with `PE-` plant codes provide hourly MWh reductions.
 * We sum those rows into regional hourly curtailed MW.
 */

const REGION_ID = "chile-wind";

function buildRegionData(points: CurtailmentPoint[], sourceNote: string): RegionData {
  return {
    regionId: REGION_ID,
    profile: timeOfDayAverageGW(points),
    latestProfile: latestCompleteUtcDayProfileGW(points),
    totalTWh: totalTWh30d(points),
    peakGW: peakGW(points),
    lastUpdated: points.at(-1)?.utcTimestamp ?? new Date().toISOString(),
    lastSuccessAt: points.at(-1)?.utcTimestamp ?? new Date().toISOString(),
    sourceNote,
    fuelShare: { wind: 1 },
  };
}

const run = async (): Promise<RegionData> => {
  const { url, bytes } = await fetchLatestWorkbook();
  const points = hourlyAverage(parseCoordinadorWindXlsx(bytes));
  if (points.length === 0) throw new Error("Chile XLSX contained no parseable wind reduction points");
  return buildRegionData(points, `Coordinador Chile direct monthly XLSX wind reductions from ${url}`);
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<RegionData>(REGION_ID, run, {
    regionTier: "live" as const,
    tagLive: (r) => ({ ...r, sourceStatus: "live" as const }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" as const }),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("chile-wind loader failed", err);
      process.exit(1);
    });
}

export const buildChileWindData = () => run();
