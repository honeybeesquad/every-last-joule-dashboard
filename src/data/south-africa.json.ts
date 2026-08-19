import { fetchText } from "../lib/fetch.js";
import { parseDelimitedRows } from "../lib/csv.js";
import {
  latestCompleteUtcDayProfileGW,
  peakGW,
  timeOfDayAverageGW,
  totalTWh30d,
} from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import { splitRegion } from "../lib/split-region.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";
import { pathToFileURL } from "url";

/**
 * Eskom (South Africa) renewable curtailment loader.
 *
 * Source: Eskom Data Portal — Total Hourly Renewable Generation CSV.
 * Columns: Wind, PV (utility solar), CSP (concentrated solar thermal),
 * Other_RE. Each is hourly MW of generation; the split output emits wind
 * and PV+CSP children and applies a 12% calibrated curtailment rate to each
 * emitted fuel independently.
 *
 * The 12% rate derives from SAREM 2025 / Eskom MTSAO Oct 2025: 4,363 GWh
 * renewable curtailment in 2024 against ~36 TWh total renewable generation
 * (≈12.1%).
 *
 * Per-fuel split (Pattern-PF, PR #19): the CSV has separate Wind and
 * PV+CSP columns. These are tracked independently so south-africa-solar
 * (PV + CSP) and south-africa-wind (Wind) appear at distinct centroids
 * and in the correct hotspot columns. CSP is grouped with PV as solar
 * (both are solar thermal technologies). The 12% rate is applied to each
 * fuel's generation before summing into the curtailment proxy, preserving
 * the correct proportional split between solar and wind curtailment.
 */

const ESKOM_PAGE_URL = "https://www.eskom.co.za/dataportal/renewables-performance/total-hourly-renewable-generation/";
const CURTAILMENT_RATE = 0.12;

export interface EskomPageMeta {
  title: string;
  /** URL scraped from the portal page, or "" if no CSV link was found. */
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
    csvUrl: csvMatch ? absoluteUrl(csvMatch[0].replace(/&amp;/g, "&")) : "",
  };
}

/**
 * The Eskom data portal page's own link to the current CSV goes stale
 * (observed 2026-08-19: portal linked .../2026/07/... which 404s while the
 * live file had already rolled to .../2026/08/...). Build an ordered,
 * deduplicated list of candidates: the scraped URL first (if any), then the
 * predictable `uploads/YYYY/MM/Total_Hourly_Generation.csv` path for the
 * current UTC month and the preceding `monthsBack` months, so a stale portal
 * link or an early-month rollover doesn't take the loader down.
 */
export function buildEskomCsvCandidates(
  scrapedUrl: string,
  now: Date = new Date(),
  monthsBack = 3,
): string[] {
  const candidates: string[] = [];
  if (scrapedUrl) candidates.push(scrapedUrl);

  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  for (let back = 0; back <= monthsBack; back++) {
    const d = new Date(Date.UTC(year, month - back, 1));
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    candidates.push(
      `https://www.eskom.co.za/dataportal/wp-content/uploads/${d.getUTCFullYear()}/${mm}/Total_Hourly_Generation.csv`,
    );
  }

  return Array.from(new Set(candidates));
}

function parseNumber(value: string | undefined): number {
  const n = Number((value ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export interface EskomParsed {
  windPoints: CurtailmentPoint[];
  solarPoints: CurtailmentPoint[];
  windMwhTotal: number;
  solarMwhTotal: number;
}

export function parseEskomTotalHourlyGeneration(csv: string): EskomParsed {
  const rows = parseDelimitedRows(csv);
  const windByTs = new Map<string, number>();
  const solarByTs = new Map<string, number>();
  let windMwhTotal = 0;
  let solarMwhTotal = 0;

  for (const row of rows) {
    const timestamp = row["Date Time Hour Beginning"];
    if (!timestamp) continue;
    const utcTimestamp = new Date(`${timestamp.replace(" ", "T")}+02:00`).toISOString();

    const windMw = Math.max(0, parseNumber(row.Wind));
    const pvMw = Math.max(0, parseNumber(row.PV));
    const cspMw = Math.max(0, parseNumber(row.CSP));

    if (windMw <= 0 && pvMw <= 0 && cspMw <= 0) continue;

    const windCurtMw = windMw * CURTAILMENT_RATE;
    const solarCurtMw = (pvMw + cspMw) * CURTAILMENT_RATE;

    windByTs.set(utcTimestamp, (windByTs.get(utcTimestamp) ?? 0) + windCurtMw);
    solarByTs.set(utcTimestamp, (solarByTs.get(utcTimestamp) ?? 0) + solarCurtMw);
    windMwhTotal += windCurtMw;
    solarMwhTotal += solarCurtMw;
  }

  const windPoints: CurtailmentPoint[] = Array.from(windByTs.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw, intervalHours: 1 }));

  const solarPoints: CurtailmentPoint[] = Array.from(solarByTs.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw, intervalHours: 1 }));

  return { windPoints, solarPoints, windMwhTotal, solarMwhTotal };
}

/**
 * Try each candidate CSV URL in order, accepting the first that both fetches
 * and parses to at least one usable (wind or solar) point. `fetchFn` is
 * injectable so this is testable without live network access; it defaults to
 * the real `fetchText`. Throws (does not silently succeed) if every
 * candidate fails, so `withFallback` still degrades honestly.
 */
export async function resolveEskomCsv(
  candidates: string[],
  fetchFn: (url: string) => Promise<string> = (url) => fetchText(url, { timeoutMs: 45000, retries: 1 }),
): Promise<{ url: string; parsed: EskomParsed }> {
  const errors: string[] = [];

  for (const url of candidates) {
    try {
      const csv = await fetchFn(url);
      const parsed = parseEskomTotalHourlyGeneration(csv);
      if (parsed.windPoints.length > 0 || parsed.solarPoints.length > 0) {
        return { url, parsed };
      }
      errors.push(`${url}: parsed but no usable (non-zero) points`);
    } catch (err) {
      errors.push(`${url}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  throw new Error(
    `Eskom CSV unresolved after ${candidates.length} candidate(s): ${errors.join("; ")}`,
  );
}

function trailingPoints(points: CurtailmentPoint[], days = 30): CurtailmentPoint[] {
  const sorted = [...points].sort((a, b) => a.utcTimestamp.localeCompare(b.utcTimestamp));
  const latest = sorted.at(-1);
  if (!latest) return [];
  const cutoff = new Date(new Date(latest.utcTimestamp).getTime() - days * 24 * 3600 * 1000);
  return sorted.filter((point) => new Date(point.utcTimestamp) >= cutoff);
}

function buildRegion(
  regionId: "south-africa-solar" | "south-africa-wind",
  points: CurtailmentPoint[],
  fuel: "solar" | "wind",
  lastUpdated: string,
): RegionData {
  const base: RegionData = {
    regionId,
    profile: timeOfDayAverageGW(points),
    latestProfile: latestCompleteUtcDayProfileGW(points),
    totalTWh: totalTWh30d(points),
    peakGW: peakGW(points),
    lastUpdated,
    lastSuccessAt: lastUpdated,
    sourceNote: `Eskom Data Portal ${fuel === "solar" ? "PV+CSP" : "Wind"} × 12% calibrated curtailment (SAREM 2025 / Eskom MTSAO Oct 2025 4,363 GWh renewable-curtailment anchor; fuel type: ${fuel})`,
    fuelShare: { [fuel]: 1 },
  };
  return applyUncertainty(base, { regionTier: "live" });
}

function isRegionData(value: unknown): value is RegionData {
  return typeof value === "object" && value !== null
    && typeof (value as RegionData).regionId === "string"
    && Array.isArray((value as RegionData).profile);
}

function forceFuel(data: RegionData, fuel: "solar" | "wind"): RegionData {
  return { ...data, fuelShare: { [fuel]: 1 } };
}

function normalizeCachedSouthAfrica(cached: unknown): Record<string, RegionData> {
  if (isRegionData(cached)) {
    const solar = cached.fuelShare?.solar ?? 0.45;
    const wind = cached.fuelShare?.wind ?? 0.55;
    return {
      "south-africa-solar": forceFuel(splitRegion(cached, "south-africa-solar", solar, "Legacy South Africa aggregate cache split by prior solar share"), "solar"),
      "south-africa-wind": forceFuel(splitRegion(cached, "south-africa-wind", wind, "Legacy South Africa aggregate cache split by prior wind share"), "wind"),
    };
  }
  return cached as Record<string, RegionData>;
}

const run = async (): Promise<Record<string, RegionData>> => {
  const html = await fetchText(ESKOM_PAGE_URL, { timeoutMs: 45000, retries: 1 });
  const meta = parseEskomDataPortal(html);
  const candidates = buildEskomCsvCandidates(meta.csvUrl);
  const { url: resolvedUrl, parsed } = await resolveEskomCsv(candidates);
  console.warn(`south-africa loader: resolved CSV at ${resolvedUrl} (${candidates.length} candidate(s) considered)`);
  const { windPoints, solarPoints } = parsed;

  const wind30d = trailingPoints(windPoints);
  const solar30d = trailingPoints(solarPoints);

  if (wind30d.length === 0 && solar30d.length === 0) {
    throw new Error("Eskom Total_Hourly_Generation CSV contained no renewable points");
  }

  const lastUpdated = [...wind30d, ...solar30d].at(-1)?.utcTimestamp ?? new Date().toISOString();

  const out: Record<string, RegionData> = {};
  if (wind30d.length > 0) {
    out["south-africa-wind"] = buildRegion("south-africa-wind", wind30d, "wind", lastUpdated);
  }
  if (solar30d.length > 0) {
    out["south-africa-solar"] = buildRegion("south-africa-solar", solar30d, "solar", lastUpdated);
  }
  return out;
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<Record<string, RegionData>>("south-africa", run, {
    tagLive: (r) => {
      const tagged: Record<string, RegionData> = {};
      for (const [k, v] of Object.entries(r)) tagged[k] = { ...v, sourceStatus: "live" as const };
      return tagged;
    },
    tagCached: (c) => {
      const tagged: Record<string, RegionData> = {};
      for (const [k, v] of Object.entries(normalizeCachedSouthAfrica(c))) tagged[k] = { ...v, sourceStatus: "cached" as const };
      return tagged;
    },
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("south-africa loader failed", err);
      process.exit(1);
    });
}
