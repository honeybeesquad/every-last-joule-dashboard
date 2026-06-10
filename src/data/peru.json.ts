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
const PERU_UTC_OFFSET_HOURS = -5;

interface CoesDatum { Nombre: string; Valor: number }
interface CoesSeries { Name: string; Data: CoesDatum[] }
interface CoesResponse {
  GraficoPorEmpresa?: { SeriesAdicional?: CoesSeries[] };
  GraficoTipoCombustible?: { Series?: CoesSeries[] };
}

function formatCoesDate(date: Date): string {
  return `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`;
}

function parseCoesTimestamp(value: string): string | null {
  const match = value.match(/^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, y, m, d, h, min] = match;
  return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), Number(h) + 5, Number(min), 0)).toISOString();
}

function parseCoesLocalDate(value: string): { y: number; m: number; d: number } | null {
  const match = value.match(/^(\d{4})\/(\d{2})\/(\d{2})/);
  if (!match) return null;
  const [, y, m, d] = match;
  return { y: Number(y), m: Number(m), d: Number(d) };
}

function inferLocalDate(raw: CoesResponse): { y: number; m: number; d: number } | null {
  const series = raw.GraficoTipoCombustible?.Series ?? [];
  for (const entry of series) {
    for (const pt of entry.Data ?? []) {
      const parsed = parseCoesLocalDate(pt.Nombre);
      if (parsed) return parsed;
    }
  }
  return null;
}

function localSolarWeights(): number[] {
  const shape = Array.from({ length: 24 }, (_, localHour) => {
    const center = localHour + 0.5;
    const daylight = Math.cos(((center - 12.5) / 12) * Math.PI);
    return daylight <= 1e-12 ? 0 : daylight ** 1.8;
  });
  const sum = shape.reduce((a, b) => a + b, 0);
  return shape.map((value) => value / sum);
}

const SOLAR_WEIGHTS = localSolarWeights();

function localHourToUtcIso(localDate: { y: number; m: number; d: number }, localHour: number): string {
  return new Date(Date.UTC(
    localDate.y,
    localDate.m - 1,
    localDate.d,
    localHour - PERU_UTC_OFFSET_HOURS,
    0,
    0,
  )).toISOString();
}

export function parseDailySolarGenerationMwh(raw: CoesResponse): number {
  const companySeries = raw.GraficoPorEmpresa?.SeriesAdicional ?? [];
  let total = 0;
  for (const entry of companySeries) {
    for (const pt of entry.Data ?? []) {
      if (!/^SOLAR$/i.test(pt.Nombre.trim())) continue;
      const val = Math.max(0, Number(pt.Valor));
      if (Number.isFinite(val)) total += val;
    }
  }
  return total;
}

function solarCurtailmentPointsFromDailyMwh(
  localDate: { y: number; m: number; d: number },
  generationMwh: number,
): CurtailmentPoint[] {
  const curtailedMwh = generationMwh * CURTAILMENT_RATE;
  return SOLAR_WEIGHTS.map((weight, localHour) => ({
    utcTimestamp: localHourToUtcIso(localDate, localHour),
    mw: curtailedMwh * weight,
    intervalHours: 1,
  }));
}

export interface PeruParsed {
  hydroPoints: CurtailmentPoint[];
  solarPoints: CurtailmentPoint[];
  windPoints: CurtailmentPoint[];
}

export function parseCoesGeneration(
  raw: CoesResponse,
  localDate: { y: number; m: number; d: number } | null = inferLocalDate(raw),
): PeruParsed {
  const hydroPoints: CurtailmentPoint[] = [];
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
      } else if (/E[ÓO]LICA/i.test(entry.Name)) {
        windPoints.push({ utcTimestamp: utc, mw: curtailed, intervalHours: HALF_HOUR });
      }
    }
  }
  const dailySolarMwh = parseDailySolarGenerationMwh(raw);
  const solarPoints = localDate && dailySolarMwh > 0
    ? solarCurtailmentPointsFromDailyMwh(localDate, dailySolarMwh)
    : [];
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
    sourceNote: fuel === "solar"
      ? `COES RER Energía Dejada de Inyectar reports document southern solar curtailment (Repartición 71.63 MWh approved Feb 2026; Majes Solar 3.904 MWh approved Nov 2025). Live magnitude uses COES daily solar generation by company distributed over a daylight-only southern Peru solar profile × ${CURTAILMENT_RATE * 100}% calibration; fuel type: ${fuel}`
      : `COES SINAC generation-by-fuel endpoint; ${fuel} half-hourly × ${CURTAILMENT_RATE * 100}% curtailment calibration (derived from ~0.8 TWh/yr published vertimiento anchor); fuel type: ${fuel}`,
    fuelShare: { [fuel]: 1 },
  };
  return applyUncertainty(base, {
    regionTier: fuel === "solar" ? "live-domestic-anchored" : "live",
  });
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
  const peruNow = new Date(now.getTime() + PERU_UTC_OFFSET_HOURS * 60 * 60 * 1000);
  const latestCompleteLocalDay = new Date(Date.UTC(
    peruNow.getUTCFullYear(),
    peruNow.getUTCMonth(),
    peruNow.getUTCDate() - 1,
  ));
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
    const parsed = parseCoesGeneration(raw, {
      y: date.getUTCFullYear(),
      m: date.getUTCMonth() + 1,
      d: date.getUTCDate(),
    });
    hydroPoints.push(...parsed.hydroPoints);
    solarPoints.push(...parsed.solarPoints);
    windPoints.push(...parsed.windPoints);
  };

  for (let day = 29; day >= 0; day--) {
    const date = new Date(Date.UTC(
      latestCompleteLocalDay.getUTCFullYear(),
      latestCompleteLocalDay.getUTCMonth(),
      latestCompleteLocalDay.getUTCDate() - day,
    ));
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
