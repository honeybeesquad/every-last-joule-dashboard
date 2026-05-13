import { fetchJSON } from "../lib/fetch.js";
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

const COES_URL = "https://www.coes.org.pe/Portal/portalinformacion/Generacion";
const CURTAILMENT_RATE = 0.02;
const HALF_HOUR = 0.5;

interface CoesDatum { Nombre: string; Valor: number }
interface CoesSeries { Name: string; Data: CoesDatum[] }
interface CoesResponse { GraficoTipoCombustible?: { Series?: CoesSeries[] } }

function formatCoesDate(date: Date): string {
  return `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`;
}

function parseCoesTimestamp(value: string): string | null {
  const match = value.match(/^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, y, m, d, h, min] = match;
  return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), Number(h) + 5, Number(min), 0)).toISOString();
}

export interface PeruParsed {
  hydroPoints: CurtailmentPoint[];
  solarPoints: CurtailmentPoint[];
  windPoints: CurtailmentPoint[];
}

export function parseCoesGeneration(raw: CoesResponse): PeruParsed {
  const hydroPoints: CurtailmentPoint[] = [];
  const solarPoints: CurtailmentPoint[] = [];
  const windPoints: CurtailmentPoint[] = [];
  const series = raw.GraficoTipoCombustible?.Series ?? [];
  for (const entry of series) {
    for (const pt of entry.Data ?? []) {
      const utc = parseCoesTimestamp(pt.Nombre);
      if (!utc) continue;
      const val = Math.max(0, Number(pt.Valor));
      if (!Number.isFinite(val)) continue;
      const curtailed = val * CURTAILMENT_RATE;
      if (/H[ÍI]DRICO/i.test(entry.Name)) {
        hydroPoints.push({ utcTimestamp: utc, mw: curtailed, intervalHours: HALF_HOUR });
      } else if (/SOLAR/i.test(entry.Name)) {
        solarPoints.push({ utcTimestamp: utc, mw: curtailed, intervalHours: HALF_HOUR });
      } else if (/E[ÓO]LICA/i.test(entry.Name)) {
        windPoints.push({ utcTimestamp: utc, mw: curtailed, intervalHours: HALF_HOUR });
      }
    }
  }
  return { hydroPoints, solarPoints, windPoints };
}

function buildRegion(
  regionId: string,
  points: CurtailmentPoint[],
  fuel: "hydro" | "solar" | "wind",
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
    sourceNote: `COES SINAC generation-by-fuel endpoint; ${fuel} half-hourly × ${CURTAILMENT_RATE * 100}% curtailment calibration (derived from ~0.8 TWh/yr published vertimiento anchor); fuel type: ${fuel}`,
    fuelShare: { [fuel]: 1 },
  };
  return applyUncertainty(base, { regionTier: "live" });
}

function isRegionData(value: unknown): value is RegionData {
  return typeof value === "object" && value !== null
    && typeof (value as RegionData).regionId === "string"
    && Array.isArray((value as RegionData).profile);
}

function forceFuel(data: RegionData, fuel: "hydro" | "solar" | "wind"): RegionData {
  return { ...data, fuelShare: { [fuel]: 1 } };
}

function normalizeCachedPeru(cached: unknown): Record<string, RegionData> {
  if (isRegionData(cached)) {
    const hydro = cached.fuelShare?.hydro ?? 0.7;
    const solar = cached.fuelShare?.solar ?? 0.2;
    const wind = cached.fuelShare?.wind ?? 0.1;
    return {
      "peru-hydro": forceFuel(splitRegion(cached, "peru-hydro", hydro, "Legacy Peru aggregate cache split by prior hydro share"), "hydro"),
      "peru-solar": forceFuel(splitRegion(cached, "peru-solar", solar, "Legacy Peru aggregate cache split by prior solar share"), "solar"),
      "peru-wind": forceFuel(splitRegion(cached, "peru-wind", wind, "Legacy Peru aggregate cache split by prior wind share"), "wind"),
    };
  }
  return cached as Record<string, RegionData>;
}

const run = async (): Promise<Record<string, RegionData>> => {
  const now = new Date();
  const hydroPoints: CurtailmentPoint[] = [];
  const solarPoints: CurtailmentPoint[] = [];
  const windPoints: CurtailmentPoint[] = [];

  const fetchDay = async (date: Date): Promise<void> => {
    const body = new URLSearchParams({
      fechaInicial: formatCoesDate(date),
      fechaFinal: formatCoesDate(date),
      indicador: "0",
    }).toString();
    const raw = await fetchJSON<CoesResponse>(COES_URL, {
      method: "POST",
      body,
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
      timeoutMs: 25000,
      retries: 0,
    });
    const series = raw.GraficoTipoCombustible?.Series ?? [];
    for (const entry of series) {
      const pts = entry.Data ?? [];
      for (const pt of pts) {
        const utc = parseCoesTimestamp(pt.Nombre);
        if (!utc) continue;
        const val = Math.max(0, Number(pt.Valor));
        if (!Number.isFinite(val)) continue;
        const curtailed = val * CURTAILMENT_RATE;
        if (/H[ÍI]DRICO/i.test(entry.Name)) {
          hydroPoints.push({ utcTimestamp: utc, mw: curtailed, intervalHours: HALF_HOUR });
        } else if (/SOLAR/i.test(entry.Name)) {
          solarPoints.push({ utcTimestamp: utc, mw: curtailed, intervalHours: HALF_HOUR });
        } else if (/E[ÓO]LICA/i.test(entry.Name)) {
          windPoints.push({ utcTimestamp: utc, mw: curtailed, intervalHours: HALF_HOUR });
        }
      }
    }
  };

  for (let day = 29; day >= 0; day--) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day));
    try { await fetchDay(date); } catch { /* individual days may publish late */ }
  }

  if (hydroPoints.length === 0 && solarPoints.length === 0 && windPoints.length === 0) {
    throw new Error("COES generation endpoint returned no renewable points");
  }
  if (solarPoints.length === 0) {
    throw new Error("COES generation endpoint returned no solar points");
  }

  const allPoints = [...hydroPoints, ...solarPoints, ...windPoints];
  const lastUpdated = allPoints
    .sort((a, b) => a.utcTimestamp.localeCompare(b.utcTimestamp))
    .at(-1)?.utcTimestamp ?? new Date().toISOString();

  const out: Record<string, RegionData> = {};
  if (hydroPoints.length > 0) out["peru-hydro"] = buildRegion("peru-hydro", hydroPoints, "hydro", lastUpdated);
  if (solarPoints.length > 0) out["peru-solar"] = buildRegion("peru-solar", solarPoints, "solar", lastUpdated);
  if (windPoints.length > 0) out["peru-wind"] = buildRegion("peru-wind", windPoints, "wind", lastUpdated);
  return out;
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<Record<string, RegionData>>("peru", run, {
    tagLive: (r) => {
      const tagged: Record<string, RegionData> = {};
      for (const [k, v] of Object.entries(r)) tagged[k] = { ...v, sourceStatus: "live" as const };
      return tagged;
    },
    tagCached: (c) => {
      const tagged: Record<string, RegionData> = {};
      for (const [k, v] of Object.entries(normalizeCachedPeru(c))) tagged[k] = { ...v, sourceStatus: "cached" as const };
      return tagged;
    },
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("peru loader failed", err);
      process.exit(1);
    });
}

export const buildPeruData = () => run();
