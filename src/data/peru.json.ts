import { fetchJSON } from "../lib/fetch.js";
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

const COES_URL = "https://www.coes.org.pe/Portal/portalinformacion/Generacion";
const REGION_ID = "peru";
// COES publishes live half-hourly generation by fuel, not a public dispatch-
// down series. The 2% factor maps hydro+solar+wind generation to the
// published ~0.8 TWh/yr vertimiento anchor while retaining live daily shape.
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
  // COES timestamps are Peru local time (PET, UTC-5).
  return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), Number(h) + 5, Number(min), 0)).toISOString();
}

function isRenewableSeries(name: string): boolean {
  return /H[ÍI]DRICO|SOLAR|E[ÓO]LICA/i.test(name);
}

export function parseCoesGeneration(raw: CoesResponse, curtailmentRate = CURTAILMENT_RATE): CurtailmentPoint[] {
  const series = raw.GraficoTipoCombustible?.Series ?? [];
  const renewableSeries = series.filter((entry) => isRenewableSeries(entry.Name));
  if (renewableSeries.length === 0) {
    throw new Error("COES response missing HIDRICO/SOLAR/EOLICA series");
  }
  const halfHourly = new Map<string, number>();
  for (const entry of renewableSeries) {
    for (const point of entry.Data ?? []) {
      const utcTimestamp = parseCoesTimestamp(point.Nombre);
      if (!utcTimestamp) continue;
      const value = Number(point.Valor);
      if (Number.isFinite(value)) {
        halfHourly.set(utcTimestamp, (halfHourly.get(utcTimestamp) ?? 0) + Math.max(0, value) * curtailmentRate);
      }
    }
  }
  return Array.from(halfHourly.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw, intervalHours: HALF_HOUR }));
}

async function fetchCoesDay(date: Date): Promise<CurtailmentPoint[]> {
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
  return parseCoesGeneration(raw);
}

async function fetchRecentCoesPoints(days = 30): Promise<CurtailmentPoint[]> {
  const now = new Date();
  const points: CurtailmentPoint[] = [];
  for (let day = days - 1; day >= 0; day--) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day));
    try {
      points.push(...await fetchCoesDay(date));
    } catch {
      // Individual COES days occasionally publish late; keep the rest of
      // the window rather than throwing away a usable live shape.
    }
  }
  return points;
}

function buildRegion(points: CurtailmentPoint[], lastUpdated: string): RegionData {
  const base: RegionData = {
    regionId: REGION_ID,
    profile: timeOfDayAverageGW(points),
    latestProfile: latestCompleteUtcDayProfileGW(points),
    totalTWh: totalTWh30d(points),
    peakGW: peakGW(points),
    lastUpdated,
    lastSuccessAt: lastUpdated,
    sourceNote:
      "COES SINAC generation-by-fuel endpoint; live hydro+solar+wind half-hourly shape multiplied by 2% curtailment calibration derived from the ~0.8 TWh/yr published vertimiento anchor. COES does not expose a separate unauthenticated dispatch-down series.",
    fuelShare: { hydro: 0.7, solar: 0.2, wind: 0.1 },
  };
  return applyUncertainty(base, { regionTier: "live" });
}

const run = async (): Promise<RegionData> => {
  const points = await fetchRecentCoesPoints();
  if (points.length === 0) throw new Error("COES generation endpoint returned no renewable points");
  return buildRegion(points, points.at(-1)!.utcTimestamp);
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<RegionData>("peru", run, {
    tagLive: (r) => ({ ...r, sourceStatus: "live" as const }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" as const }),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("peru loader failed", err);
      process.exit(1);
    });
}

export const buildPeruData = () => run();
