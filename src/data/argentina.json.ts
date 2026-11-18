import { readFileSync } from "fs";
import { join } from "path";
import { pathToFileURL } from "url";
import { fetchJSON } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { relayFreshness, RELAY_STALENESS_THRESHOLD_DAYS } from "../lib/freshness.js";
import { timeOfDayAverageGW, totalTWh30d } from "../lib/profile.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";
import { unpublishedEmptyRegion } from "../lib/waste-status.js";

const REGION_ID = "argentina";

/** CAMMESA cdsrenovables rows are 5-minute wind MW. Omitting this made each row an hour (12×). */
export const CAMMESA_INTERVAL_HOURS = 5 / 60;
/** A shorter file is a shape extended to 30 days, not a 30-day sum. Same cutoff as unpublishedGenerationRegion. */
const SHORT_WINDOW_DAYS = 25;

const CAMMESA_RENEWABLES_URL =
  "https://cdsrenovables.cammesa.com/exhisto/RenovablesService/GetChartTotalTRDataSource/";

interface CammesaRenewablePoint {
  momento: string;
  eolica: number;
  fotovoltaica: number;
  hidraulica: number;
  biocombustible: number;
}

/** Format date as DD-MM-YYYY for CAMMESA API. */
function toCammesaDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

/**
 * Fetch CAMMESA renewables data for a single date.
 */
async function fetchCammesaRenewablesForDate(date: Date): Promise<CammesaRenewablePoint[]> {
  const dateStr = toCammesaDate(date);
  const url = `${CAMMESA_RENEWABLES_URL}?desde=${dateStr}&hasta=${dateStr}`;
  const data = await fetchJSON<CammesaRenewablePoint[]>(url, {
    method: "GET",
    headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" },
    timeoutMs: 15000,
    retries: 2,
  });
  return Array.isArray(data) ? data : [];
}

/**
 * Fetch CAMMESA wind generation (eolica MW) for the last N days via the live API.
 * Waste stays unpublished: restricciones need a registered agent.
 */
async function fetchCammesaWindCurtailment(days: number): Promise<CurtailmentPoint[]> {
  const points: CurtailmentPoint[] = [];
  const now = new Date();

  for (let offset = 0; offset < days; offset++) {
    const d = new Date(now.getTime() - offset * 24 * 3600 * 1000);
    let genPoints: CammesaRenewablePoint[];
    try {
      genPoints = await fetchCammesaRenewablesForDate(d);
    } catch (err) {
      console.warn(`[argentina] CAMMESA fetch failed for ${toCammesaDate(d)}: ${(err as Error).message}`);
      continue;
    }

    for (const pt of genPoints) {
      if (!pt.momento || pt.eolica == null) continue;
      try {
        const utcDate = new Date(pt.momento);
        if (isNaN(utcDate.getTime())) continue;
        const utcTs = utcDate.toISOString();

        const windMw = pt.eolica || 0;
        if (windMw > 0) {
          points.push({
            utcTimestamp: utcTs,
            mw: Math.max(0, windMw),
            intervalHours: CAMMESA_INTERVAL_HOURS,
          });
        }
      } catch {
        // Skip bad timestamps
      }
    }
  }

  return points;
}

/**
 * Read CAMMESA data from the committed relay CSV.
 * Returns CurtailmentPoint[] with time-of-day average profile.
 */
function readCsvData(): CurtailmentPoint[] | null {
  const csvPath = join(process.cwd(), "data", "historical", "argentina-cammesa.csv");
  try {
    const csv = readFileSync(csvPath, "utf-8");
    const lines = csv.trim().split("\n");
    if (lines.length < 2) return null;

    // Skip header
    const points: CurtailmentPoint[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",");
      if (cols.length < 2) continue;
      const utcTs = cols[0].trim();
      const eolicaMw = parseFloat(cols[1]);
      if (!Number.isFinite(eolicaMw) || eolicaMw <= 0) continue;

      points.push({ utcTimestamp: utcTs, mw: eolicaMw, intervalHours: CAMMESA_INTERVAL_HOURS });
    }

    if (points.length < 24) return null;
    return points;
  } catch {
    return null;
  }
}

function windowSpanDays(points: CurtailmentPoint[]): number {
  let min = Infinity;
  let max = -Infinity;
  for (const p of points) {
    const t = Date.parse(p.utcTimestamp);
    if (!Number.isFinite(t)) continue;
    if (t < min) min = t;
    if (t > max) max = t;
  }
  if (!Number.isFinite(min) || max < min) return 0;
  return (max - min) / 86_400_000;
}

function latestTimestamp(points: CurtailmentPoint[]): string {
  let max = -Infinity;
  let iso = points[0]?.utcTimestamp ?? new Date().toISOString();
  for (const p of points) {
    const t = Date.parse(p.utcTimestamp);
    if (t > max) {
      max = t;
      iso = p.utcTimestamp;
    }
  }
  return iso;
}

/**
 * 30-day generation TWh. A window of at least 25 days sums MW × 5 minutes.
 * A shorter file (the committed June relay is about six days) uses the
 * diurnal mean extended across 30 days, so the short file is not filed as
 * the whole month and is not counted as if each 5-minute row were an hour.
 */
export function argentinaGenerationTWh(points: CurtailmentPoint[]): number {
  const stamped = points.map((p) => ({
    ...p,
    intervalHours: p.intervalHours ?? CAMMESA_INTERVAL_HOURS,
  }));
  if (windowSpanDays(stamped) >= SHORT_WINDOW_DAYS) return totalTWh30d(stamped);
  const profile = timeOfDayAverageGW(stamped);
  return (profile.reduce((sum, gw) => sum + gw, 0) * 30) / 1000;
}

function regionFromGeneration(points: CurtailmentPoint[], sourceNote: string): RegionData {
  const lastTs = latestTimestamp(points);
  const spanDays = windowSpanDays(points);
  const short = spanDays < SHORT_WINDOW_DAYS;
  const note = short
    ? `${sourceNote} Window is ${spanDays.toFixed(1)} days, so generationTotalTWh is the observed diurnal mean extended across 30 days, not a sum of the short file.`
    : sourceNote;
  const result: RegionData = {
    regionId: REGION_ID,
    profile: Array(24).fill(0),
    latestProfile: null,
    totalTWh: 0,
    peakGW: 0,
    lastUpdated: lastTs,
    lastSuccessAt: lastTs,
    sourceNote: note,
    sourceStatus: relayFreshness(lastTs, new Date(), RELAY_STALENESS_THRESHOLD_DAYS),
    wasteStatus: "unpublished",
    generationProfile: timeOfDayAverageGW(points),
    generationTotalTWh: argentinaGenerationTWh(points),
  };
  return applyUncertainty(result, { regionTier: "estimated" });
}

async function run({ probe = true } = {}): Promise<RegionData> {
  // 1. Try live CAMMESA API (only works from Argentine IPs)
  if (probe) {
    try {
      const points = await fetchCammesaWindCurtailment(30);
      if (points.length > 0) {
        const lastTs = latestTimestamp(points);
        return regionFromGeneration(
          points,
          `CAMMESA live wind generation (cdsrenovables.cammesa.com). ` +
            `Waste unpublished — restricciones need agent registration. ` +
            `${points.length} points. Latest: ${lastTs}.`,
        );
      }
    } catch (err) {
      console.error(`[argentina] CAMMESA live fetch failed: ${(err as Error).message}`);
      // Fall through to CSV fallback
    }
  }

  // 2. Try committed CSV (relay data from Abed, available at Vercel build time)
  const csvPoints = readCsvData();
  if (csvPoints && csvPoints.length > 0) {
    const lastTs = latestTimestamp(csvPoints);
    return regionFromGeneration(
      csvPoints,
      `CAMMESA relay CSV (argentina-cammesa.csv, ${csvPoints.length} points). ` +
        `Generation measured. Waste unpublished — live API geoblocked. Latest: ${lastTs}.`,
    );
  }

  // 3. Fallback: typical wind profile for Patagonia
  return applyUncertainty(
    unpublishedEmptyRegion(
      REGION_ID,
      `CAMMESA live feed unavailable${probe ? " (probe failed — API geoblocked to Argentine IPs, no relay CSV)" : " (test mode)"}. Not TSO-collected this build. Waste unpublished.`,
    ),
    { regionTier: "estimated", profileKind: "wind" },
  );
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback(REGION_ID, () => run(), { regionTier: "estimated" })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("argentina loader failed", err);
      process.exit(1);
    });
}

export const buildArgentinaData = () => run({ probe: false });
