import { fetchJSON } from "../lib/fetch.js";
import { timeOfDayAverageGW, totalTWh30d, peakGW, latestCompleteUtcDayProfileGW } from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";
import { pathToFileURL } from "url";

const COES_URL = "https://www.coes.org.pe/Portal/portalinformacion/Generacion";
const CURTAILMENT_RATE = 0.02;

interface CoesDatum {
  Nombre: string;
  Valor: number;
}

interface CoesSeries {
  Name: string;
  Data: CoesDatum[];
}

interface CoesResponse {
  GraficoTipoCombustible?: {
    Series?: CoesSeries[];
  };
}

function toUtcHourKey(localTimestamp: string): string | null {
  const match = localTimestamp.match(
    /^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})$/,
  );
  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match;
  const utcMs = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour) + 5,
    Number(minute),
    Number(second),
  );
  const date = new Date(utcMs);
  date.setUTCMinutes(0, 0, 0);
  return date.toISOString();
}

export function parseCoesGeneration(raw: CoesResponse): CurtailmentPoint[] {
  const series = raw.GraficoTipoCombustible?.Series ?? [];
  const renewableSeries = series.filter((entry) => /SOLAR|E[ÓO]LICA/i.test(entry.Name));
  if (renewableSeries.length === 0) {
    throw new Error("COES response missing SOLAR/EOLICA series");
  }

  const hourly = new Map<string, number>();

  for (const entry of renewableSeries) {
    for (const point of entry.Data ?? []) {
      const hourKey = toUtcHourKey(point.Nombre);
      const value = Number(point.Valor);
      if (!hourKey || !Number.isFinite(value)) continue;
      hourly.set(hourKey, (hourly.get(hourKey) ?? 0) + Math.max(0, value) * 0.5);
    }
  }

  return Array.from(hourly.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([utcTimestamp, renewableMw]) => ({
      utcTimestamp,
      mw: renewableMw * CURTAILMENT_RATE,
    }));
}

function formatCoesDate(date: Date): string {
  return `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`;
}

const run = async (): Promise<RegionData> => {
  const now = new Date();
  const start = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
  const body = new URLSearchParams({
    fechaInicial: formatCoesDate(start),
    fechaFinal: formatCoesDate(now),
    indicador: "0",
  }).toString();

  const raw = await fetchJSON<CoesResponse>(COES_URL, {
    method: "POST",
    body,
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
    timeoutMs: 45000,
    retries: 1,
  });

  const points = parseCoesGeneration(raw);

  return {
    regionId: "peru",
    profile: timeOfDayAverageGW(points),
    latestProfile: latestCompleteUtcDayProfileGW(points),
    totalTWh: totalTWh30d(points),
    peakGW: peakGW(points),
    lastUpdated: points.at(-1)?.utcTimestamp ?? now.toISOString(),
    sourceNote: "COES generation dashboard solar+wind × 2% calibrated curtailment proxy",
  };
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
