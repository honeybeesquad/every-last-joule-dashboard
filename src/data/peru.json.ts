import { fetchJSON } from "../lib/fetch.js";
import { timeOfDayAverageGW, totalTWh30d, peakGW, latestCompleteUtcDayProfileGW } from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import {
  buildTypicalHydroSeasonalRegion,
  HYDRO_SEASONAL_SHARES,
} from "../lib/typical-profiles.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";
import { pathToFileURL } from "url";

/**
 * Peru curtailment loader.
 *
 * Peru's curtailment is dominated by Andean hydro spill, with a secondary
 * solar+wind component in the southern Atacama-adjacent region (Rubí, Tacna,
 * Panamericana, Wayra wind). The previous v1 loader fetched only the COES
 * generation-by-fuel-type series and applied a flat 2% proxy rate, which
 * captured the solar+wind share but missed the dominant hydro story and
 * produced a sub-0.02 GW profile that looked broken on the dashboard.
 *
 * This v2 loader:
 *   1. Primary signal: bimodal hydro-seasonal fallback anchored to
 *      published 2024 Peru "vertimiento" figures (~0.8 TWh/yr aggregate,
 *      peaking Jan-Apr during Sierra rainy season and again Nov-Dec).
 *      Uses HYDRO_SEASONAL_SHARES.peru. The solar+wind share rides in via
 *      MIXED_SPLITS.peru (src/lib/fuel.ts: 70% hydro / 20% solar / 10% wind).
 *
 *   2. Secondary signal: still probes the COES generation dashboard so that
 *      if their Graficos endpoint ever exposes actual dispatch-down data,
 *      the loader can be re-pointed at the live feed. Today it's just a
 *      health-check for source accessibility, with the result logged to the
 *      sourceNote.
 */

const COES_URL = "https://www.coes.org.pe/Portal/portalinformacion/Generacion";
const REGION_ID = "peru";
const ANNUAL_TWH = 0.8;

interface CoesDatum { Nombre: string; Valor: number }
interface CoesSeries { Name: string; Data: CoesDatum[] }
interface CoesResponse { GraficoTipoCombustible?: { Series?: CoesSeries[] } }

function formatCoesDate(date: Date): string {
  return `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`;
}

async function probeCoes(): Promise<string> {
  // Soft probe — we still hit COES for source freshness, but fall back to
  // the seasonal hydro profile regardless. Returns a short status note.
  const now = new Date();
  const start = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
  const body = new URLSearchParams({
    fechaInicial: formatCoesDate(start),
    fechaFinal: formatCoesDate(now),
    indicador: "0",
  }).toString();

  try {
    const raw = await fetchJSON<CoesResponse>(COES_URL, {
      method: "POST",
      body,
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
      timeoutMs: 25000,
      retries: 0,
    });
    const series = raw.GraficoTipoCombustible?.Series ?? [];
    const solar = series.find((s) => /SOLAR/i.test(s.Name));
    const wind = series.find((s) => /E[ÓO]LICA/i.test(s.Name));
    return `COES reachable (solar: ${solar ? "yes" : "no"}, wind: ${wind ? "yes" : "no"}) but no dispatch-down series exposed`;
  } catch (err) {
    return `COES probe failed: ${(err as Error).message}`;
  }
}

/** Deprecated helper kept for backwards-compat with the earlier test fixtures. */
export function parseCoesGeneration(raw: CoesResponse): CurtailmentPoint[] {
  const series = raw.GraficoTipoCombustible?.Series ?? [];
  const renewableSeries = series.filter((entry) => /SOLAR|E[ÓO]LICA/i.test(entry.Name));
  if (renewableSeries.length === 0) {
    throw new Error("COES response missing SOLAR/EOLICA series");
  }
  const hourly = new Map<string, number>();
  for (const entry of renewableSeries) {
    for (const point of entry.Data ?? []) {
      const ts = point.Nombre;
      const match = ts.match(/^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
      if (!match) continue;
      const [, y, m, d, h] = match;
      const utc = Date.UTC(Number(y), Number(m) - 1, Number(d), Number(h) + 5, 0, 0);
      const key = new Date(utc).toISOString();
      const v = Number(point.Valor);
      if (Number.isFinite(v)) hourly.set(key, (hourly.get(key) ?? 0) + Math.max(0, v) * 0.5);
    }
  }
  return Array.from(hourly.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw: mw * 0.02 }));
}

const run = async (): Promise<RegionData> => {
  const coesStatus = await probeCoes();
  return buildTypicalHydroSeasonalRegion(
    REGION_ID,
    ANNUAL_TWH,
    HYDRO_SEASONAL_SHARES.peru,
    `Peru bimodal hydro-dominant curtailment anchored to ~0.8 TWh/yr across hydro (70%), solar south (20%, Rubí/Tacna/Panamericana), wind (10%, Wayra I/II); MIXED_SPLITS.peru carries the fuel split. ${coesStatus}.`,
    "2024",
  );
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
