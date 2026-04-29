import { pathToFileURL } from "url";
import { execFileSync } from "child_process";
import { withFallback } from "../lib/resilient.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import { coerceLastSuccessAt } from "../lib/freshness.js";
import { buildTypicalMixedRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const DOM_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  "Accept": "application/json, text/plain, */*",
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Referer": "https://www.oc.org.do/",
};

function curlGet(url: string): string {
  return execFileSync("curl", ["-s", "--connect-timeout", "15", "-H", "Accept: application/json", url], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
}

const REGION_ID = "dominican-republic";

interface DesviacionPoint {
  FECHA: string;
  PERIODO: number;
  PROGRAMADO: number;
  GENERACION: number;
  DESVIACION: number;
}

function parseDateLocalToUTC(localDate: string, periodo: number): string {
  // Dominican Republic is UTC-4 (AST) / UTC-3 (ADT). API returns local date.
  // Periodo 1 = midnight local, Periodo 24 = 23:00 local
  const [year, month, day] = localDate.split("T")[0].split("-").map(Number);
  const hour = periodo - 1;
  // Dominican Republic standard time is UTC-4
  const utcHour = hour + 4;
  const d = new Date(Date.UTC(year, month - 1, day, utcHour));
  return d.toISOString();
}

async function run(): Promise<RegionData> {
  try {
    // Fetch yesterday's data (today's may have nulls for future periods)
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

    // The API returns generation reprogramada (re-dispatch) which shows scheduled vs actual.
    // Positive DESVIACION = over-generation vs schedule; negative = under-generation.
    // We use the actual GENERACION as the live feed signal.
    const url = `https://apps.oc.org.do/wsOCWebsiteChart/Service.asmx/GetGeneracionReprogramadaJSon?Fecha=${yesterday}`;
    const raw = curlGet(url);

    let data: { GetGeneracionReprogramada: DesviacionPoint[] };
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error("OC Dominican Republic returned non-JSON response");
    }

    const points = data.GetGeneracionReprogramada;
    if (!points || points.length === 0) {
      throw new Error("OC returned empty data set");
    }

    // Build hourly profile from GENERACION (actual generation in MW)
    // PERIODO 1-24 corresponds to hours 0-23 local
    const profile24 = new Array(24).fill(0);
    let validCount = 0;

    for (const p of points) {
      const hour = p.PERIODO - 1;
      if (hour >= 0 && hour < 24 && p.GENERACION !== null) {
        // GENERACION is in MW, convert to GW
        profile24[hour] = p.GENERACION / 1000;
        validCount++;
      }
    }

    if (validCount === 0) {
      throw new Error("OC returned no valid GENERACION values");
    }

    const peakGW = Math.max(...profile24);
    const lastUpdated = parseDateLocalToUTC(points[points.length - 1]?.FECHA ?? "", points[points.length - 1]?.PERIODO ?? 24);

    // Calculate 30-day trailing total from deviation signal
    // For now, use the profile average as a rough anchor
    const dailyMWh = profile24.reduce((a, b) => a + b, 0) * 1000;
    const measuredAnnualTWh = (dailyMWh * 365) / 1e6;

    // Use IRENA 2024 anchor for Dominican Republic solar+wind (~0.5 TWh/yr per statics.json.ts)
    // This is a provisional anchor since the API gives total generation, not curtailment specifically
    const anchorTWh = 0.5;
    const scale = anchorTWh / measuredAnnualTWh;

    const profile: number[] = profile24.map((gw) => gw * scale);
    const scaledPeakGW = peakGW * scale;

    const base: RegionData = {
      regionId: REGION_ID,
      profile,
      latestProfile: null,
      totalTWh: anchorTWh,
      peakGW: scaledPeakGW,
      lastUpdated,
      lastSuccessAt: coerceLastSuccessAt(new Date().toISOString()),
      sourceNote: `OC (Organismo Coordinador del SENI) Dominican Republic live generation feed (GetGeneracionReprogramadaJSon); GENERACION column as actual hourly MW; IRENA 2024 + OC 2024 annual anchor ~0.5 TWh/yr provisional. T1b: live measured diurnal shape, domestic anchor; note API returns total dispatch deviation not renewable-specific curtailment.`,
    };

    return applyUncertainty(base, { regionTier: "live-domestic-anchored" });
  } catch (err) {
    // Fallback: Dominican Republic solar+wind mix per IRENA 2024
    return buildTypicalMixedRegion(
      REGION_ID,
      0.5,
      { solar: 0.6, wind: 0.4 },
      `Typical-shape fallback: OC Dominican Republic live feed unavailable (${(err as Error).message}); IRENA 2024 + OC 2024 provisional anchor ~0.5 TWh/yr (solar ~60%, wind ~40%).`,
      "2024",
      7,  // solarPeakHourUtc - Dominican Republic is UTC-4, solar peak ~12 local = 16 UTC
      15, // windPeakHourUtc
    );
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback(REGION_ID, run)
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("dominican-republic loader failed", err);
      process.exit(1);
    });
}

export const buildDominicanRepublicData = () => run();
