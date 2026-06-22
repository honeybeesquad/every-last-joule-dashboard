import { readFileSync } from "fs";
import { join } from "path";
import { pathToFileURL } from "url";
import { fetchJSON } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { timeOfDayAverageGW, totalTWh30d, peakGW, latestCompleteUtcDayProfileGW } from "../lib/profile.js";
import { buildTypicalWindRegion } from "../lib/typical-profiles.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";

const REGION_ID = "argentina";

/**
 * CAMMESA renewables endpoint.
 * GET with query params: desde=DD-MM-YYYY&hasta=DD-MM-YYYY
 * Returns array of { momento, eolica, fotovoltaica, hidraulica, biocombustible }
 * NOTE: geoblocked to Argentine IP addresses. From non-AR hosts this will timeout.
 */
const CAMMESA_RENEWABLES_URL =
  "https://cdsrenovables.cammesa.com/exhisto/RenovablesService/GetChartTotalTRDataSource/";

/**
 * Argentina wind curtailment rate.
 * Anchor: ~0.5 TWh/yr Patagonia wind curtailment (IRENA/Ember LatAm 2024 estimate).
 * Based on ~5% of Patagonian wind generation.
 * Source: IRENA LatAm 2024 estimates.
 */
const WIND_CURTAILMENT_RATE = 0.05;

/**
 * Argentina solar curtailment rate.
 * Anchor: ~0.3 TWh/yr Cuyo/NOA solar curtailment (CAMMESA 2024).
 * Based on ~2% of PV generation.
 */
const SOLAR_CURTAILMENT_RATE = 0.02;

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
 * Fetch CAMMESA wind curtailment for the last N days via the live API.
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

        const windCurtMw = (pt.eolica || 0) * WIND_CURTAILMENT_RATE;
        if (windCurtMw > 0) {
          points.push({ utcTimestamp: utcTs, mw: Math.max(0, windCurtMw) });
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
      if (cols.length < 6) continue;
      const utcTs = cols[0].trim();
      const eolicaMw = parseFloat(cols[1]);
      if (!Number.isFinite(eolicaMw) || eolicaMw <= 0) continue;

      const windCurtMw = eolicaMw * WIND_CURTAILMENT_RATE;
      points.push({ utcTimestamp: utcTs, mw: windCurtMw });
    }

    if (points.length < 24) return null;
    return points;
  } catch {
    return null;
  }
}

async function run({ probe = true } = {}): Promise<RegionData> {
  // 1. Try live CAMMESA API (only works from Argentine IPs)
  if (probe) {
    try {
      const points = await fetchCammesaWindCurtailment(30);
      if (points.length > 0) {
        const lastTs = points[points.length - 1].utcTimestamp;
        const sourceNote =
          `CAMMESA live wind generation (cdsrenovables.cammesa.com) ` +
          `× ${(WIND_CURTAILMENT_RATE * 100).toFixed(0)}% calibrated curtailment rate ` +
          `(IRENA/Ember LatAm 2024 anchor ~0.5 TWh/yr Patagonia wind curtailment). ` +
          `${points.length} points across 30 days. Latest: ${lastTs}.`;

        const result: RegionData = {
          regionId: REGION_ID,
          profile: timeOfDayAverageGW(points),
          latestProfile: latestCompleteUtcDayProfileGW(points),
          totalTWh: totalTWh30d(points),
          peakGW: peakGW(points),
          lastUpdated: lastTs,
          lastSuccessAt: new Date().toISOString(),
          sourceNote,
        };

        return applyUncertainty(result, { regionTier: "estimated" });
      }
    } catch (err) {
      console.error(`[argentina] CAMMESA live fetch failed: ${(err as Error).message}`);
      // Fall through to CSV fallback
    }
  }

  // 2. Try committed CSV (relay data from Abed, available at Vercel build time)
  const csvPoints = readCsvData();
  if (csvPoints && csvPoints.length > 0) {
    const lastTs = csvPoints[csvPoints.length - 1].utcTimestamp;
    const sourceNote =
      `CAMMESA relay CSV (argentina-cammesa.csv, ${csvPoints.length} points) ` +
      `× ${(WIND_CURTAILMENT_RATE * 100).toFixed(0)}% calibrated wind curtailment rate ` +
      `(IRENA/Ember LatAm 2024 anchor ~0.5 TWh/yr). Live API geoblocked — using relay data. ` +
      `Latest: ${lastTs}.`;

    const result: RegionData = {
      regionId: REGION_ID,
      profile: timeOfDayAverageGW(csvPoints),
      latestProfile: null,
      totalTWh: totalTWh30d(csvPoints),
      peakGW: peakGW(csvPoints),
      lastUpdated: lastTs,
      lastSuccessAt: lastTs,
      sourceNote,
    };

    return applyUncertainty(result, { regionTier: "estimated" });
  }

  // 3. Fallback: typical wind profile for Patagonia
  return buildTypicalWindRegion(
    REGION_ID,
    3,     // peakHour UTC (Patagonia wind nocturnal peak)
    0.5,   // annualTWh anchor — ~0.5 TWh/yr Patagonia wind curtailment
    `Typical-shape fallback: CAMMESA live feed unavailable${probe ? " (probe failed — API geoblocked to Argentine IPs, no relay CSV)" : " (test mode)"}. ` +
    `Calibration anchor ~0.5 TWh/yr Patagonia wind curtailment (IRENA/Ember LatAm 2024).`,
    "2024",
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
