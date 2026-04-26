import { fetchText } from "../lib/fetch.js";
import { parseDelimitedRows } from "../lib/csv.js";
import {
  latestCompleteUtcDayProfileGW,
  peakGW,
  timeOfDayAverageGW,
  totalTWh30d,
} from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";
import { pathToFileURL } from "url";

const ESKOM_PAGE_URL = "https://www.eskom.co.za/dataportal/renewables-performance/total-hourly-renewable-generation/";
const FALLBACK_CSV_URL = "https://www.eskom.co.za/dataportal/wp-content/uploads/2026/04/Total_Hourly_Generation.csv";
// SAREM 2025 / Eskom MTSAO Oct 2025 document 4,363 GWh renewable curtailment
// in 2024, roughly 12% of renewable output. The live CSV supplies the hourly
// renewable-generation shape; this rate calibrates it to the curtailment anchor.
const CURTAILMENT_RATE = 0.12;

export interface EskomPageMeta {
  title: string;
  csvUrl: string;
}

function absoluteUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return new URL(url, ESKOM_PAGE_URL).toString();
}

export function parseEskomDataPortal(html: string): EskomPageMeta {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (!titleMatch) throw new Error("Eskom data portal missing <title>");
  const csvMatch = html.match(/https?:\/\/[^"'<> ]+Total_Hourly_Generation\.csv|\/dataportal\/wp-content\/uploads\/[^"'<> ]+Total_Hourly_Generation\.csv/i);
  return {
    title: titleMatch[1].trim(),
    csvUrl: csvMatch ? absoluteUrl(csvMatch[0].replace(/&amp;/g, "&")) : FALLBACK_CSV_URL,
  };
}

function parseNumber(value: string | undefined): number {
  const n = Number((value ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function parseEskomTotalHourlyGeneration(csv: string, curtailmentRate = CURTAILMENT_RATE): CurtailmentPoint[] {
  return parseDelimitedRows(csv)
    .map((row): CurtailmentPoint | null => {
      const timestamp = row["Date Time Hour Beginning"];
      if (!timestamp) return null;
      const utcTimestamp = new Date(`${timestamp.replace(" ", "T")}+02:00`).toISOString();
      const renewableMw =
        parseNumber(row.Wind) +
        parseNumber(row.PV) +
        parseNumber(row.CSP) +
        parseNumber(row.Other_RE);
      return {
        utcTimestamp,
        mw: Math.max(0, renewableMw * curtailmentRate),
        intervalHours: 1,
      };
    })
    .filter((point): point is CurtailmentPoint => point !== null);
}

function trailingPoints(points: CurtailmentPoint[], days = 30): CurtailmentPoint[] {
  const sorted = [...points].sort((a, b) => a.utcTimestamp.localeCompare(b.utcTimestamp));
  const latest = sorted.at(-1);
  if (!latest) return [];
  const cutoff = new Date(new Date(latest.utcTimestamp).getTime() - days * 24 * 3600 * 1000);
  return sorted.filter((point) => new Date(point.utcTimestamp) >= cutoff);
}

function buildRegion(points: CurtailmentPoint[], lastUpdated: string, sourceNote: string): RegionData {
  const base: RegionData = {
    regionId: "south-africa",
    profile: timeOfDayAverageGW(points),
    latestProfile: latestCompleteUtcDayProfileGW(points),
    totalTWh: totalTWh30d(points),
    peakGW: peakGW(points),
    lastUpdated,
    lastSuccessAt: lastUpdated,
    sourceNote,
    fuelShare: { wind: 0.55, solar: 0.45 },
  };
  return applyUncertainty(base, { regionTier: "live" });
}

const run = async (): Promise<RegionData> => {
  const html = await fetchText(ESKOM_PAGE_URL, { timeoutMs: 45000, retries: 1 });
  const meta = parseEskomDataPortal(html);
  const csv = await fetchText(meta.csvUrl, { timeoutMs: 45000, retries: 1 });
  const points = trailingPoints(parseEskomTotalHourlyGeneration(csv));
  if (points.length === 0) throw new Error("Eskom Total_Hourly_Generation CSV contained no renewable points");
  const lastUpdated = points.at(-1)!.utcTimestamp;
  return buildRegion(
    points,
    lastUpdated,
    `Eskom Data Portal total hourly renewable generation CSV (${meta.csvUrl}); live wind+PV+CSP+other-RE generation shape multiplied by 12% curtailment calibration from SAREM 2025 / Eskom MTSAO Oct 2025 4,363 GWh renewable-curtailment anchor.`,
  );
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<RegionData>("south-africa", run, {
    tagLive: (r) => ({ ...r, sourceStatus: "live" as const }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" as const }),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("south-africa loader failed", err);
      process.exit(1);
    });
}
