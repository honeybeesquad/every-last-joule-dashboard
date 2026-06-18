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
 * Anchor: ~2.1 TWh/yr Patagonia wind curtailment (CAMMESA/IRENA 2024).
 * Based on ~5% of Patagonian wind generation.
 * Source: CAMMESA annual reports + IRENA LatAm 2024 estimates.
 */
const WIND_CURTAILMENT_RATE = 0.05;

/**
 * Argentina solar curtailment rate.
 * Anchor: ~0.3 TWh/yr Cuyo/NOA solar curtailment (CAMMESA 2024).
 * Based on ~2% of PV generation.
 */
const SOLAR_CURTAILMENT_RATE = 0.02;

interface CammesaRenewablePoint {
  momento: string;        // "2026-06-18T12:00:00.000-03:00"
  eolica: number;         // wind MW
  fotovoltaica: number;   // solar MW
  hidraulica: number;     // hydro MW
  biocombustible: number; // biomass MW
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
 * Returns array of { momento, eolica, fotovoltaica, ... } points.
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
 * Fetch CAMMESA wind curtailment for the last N days.
 * Returns CurtailmentPoint[] from wind generation × rate.
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
        // Parse the momento timestamp (ISO with timezone offset like -03:00)
        const utcDate = new Date(pt.momento);
        if (isNaN(utcDate.getTime())) continue;
        const utcTs = utcDate.toISOString();

        // Wind curtailment MW = wind generation MW × rate
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

async function run({ probe = true } = {}): Promise<RegionData> {
  if (probe) {
    try {
      const points = await fetchCammesaWindCurtailment(30);

      if (points.length === 0) {
        throw new Error("CAMMESA renewables API returned no wind generation data");
      }

      const lastTs = points[points.length - 1].utcTimestamp;
      const sourceNote =
        `CAMMESA live wind generation (cdsrenovables.cammesa.com) ` +
        `× ${(WIND_CURTAILMENT_RATE * 100).toFixed(0)}% calibrated curtailment rate ` +
        `(CAMMESA/IRENA 2024 anchor ~2.1 TWh/yr Patagonia wind curtailment). ` +
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

      // "anchored" tier: live generation shape × published curtailment rate
      return applyUncertainty(result, { regionTier: "estimated" });
    } catch (err) {
      console.error(`[argentina] CAMMESA live fetch failed: ${(err as Error).message}`);
      // Fall through to fallback
    }
  }

  // Fallback: typical wind profile for Patagonia
  // Peak hour UTC = 3 (Patagonia wind peaks overnight, UTC-3 midnight ≈ 3 UTC)
  return buildTypicalWindRegion(
    REGION_ID,
    3,     // peakHour UTC (Patagonia wind nocturnal peak)
    2.1,   // annualTWh anchor — ~2.1 TWh/yr Patagonia wind curtailment
    `Typical-shape fallback: CAMMESA live feed unavailable${probe ? " (probe failed — API geoblocked to Argentine IPs)" : " (test mode)"}. ` +
    `Calibration anchor ~2.1 TWh/yr Patagonia wind curtailment (CAMMESA/IRENA 2024).`,
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
