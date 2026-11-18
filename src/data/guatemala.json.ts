/**
 * Guatemala solar — AMM (Administrador del Mercado Mayorista) hourly
 * generation by fuel.
 *
 * MEASURED     hourly solar generation from AMM's public chart endpoint
 *              `graficaCombustible?dt=DD/MM/YYYY`. Each day is an array of
 *              `{ hora, potencia, tipo }` rows: `hora` is hour-ending 1–24 in
 *              Guatemala time (UTC−6, no daylight saving), `potencia` is MW,
 *              and solar is the `IRRADIACIÓN` fuel type.
 * UNPUBLISHED  waste. AMM publishes generation, not curtailment, and
 *              Guatemala has no published curtailment series. Missing ≠ zero.
 *
 * Probe notes: docs/research/2026-11-18-no-public-series-probe.md. The
 * endpoint answered for 2025-05-20 and later; 2025-05-16 came back `[]`.
 *
 * Stays `tier: "estimated"` / T3 / official-lead. Not T1a.
 */

import { pathToFileURL } from "node:url";

import { mapWithConcurrency } from "../lib/concurrency.js";
import { fetchJSON } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";
import { unpublishedGenerationRegion } from "../lib/waste-status.js";

const REGION_ID = "guatemala";
const BASE_URL = "https://wl12.amm.org.gt/GraficaPW/graficaCombustible";

/** Guatemala is a flat UTC−6 with no daylight saving. */
const GT_OFFSET_HOURS = -6;

/**
 * Days requested: the 14 complete local days before today. Past days do not
 * change, so a longer window only adds requests and deadline risk; the
 * 30-day figure is the window's mean day × 30.
 */
const WINDOW_DAYS = 14;

/** Fewer complete days than this and the window is not worth trusting. */
const MIN_DAYS = 7;

/**
 * Plausibility ceiling for one hourly solar reading, MW. Guatemala's solar
 * peaked near 430 MW on 2026-11-16, and 2024 solar generation was 0.28 TWh
 * (Our World in Data). A reading in the thousands means the parser has picked
 * up a demand or total row, not solar.
 */
const MAX_PLAUSIBLE_SOLAR_MW = 1500;

/**
 * Night-time readings a little below zero are plant auxiliary load and are
 * clamped to zero. Anything more negative than this is a sign flip or a
 * corrupt value, and fails the whole run (last-good is served).
 */
const MAX_AUX_LOAD_MW = 25;

export interface AmmRow {
  hora: string | number;
  potencia: number | string | null;
  tipo: string | null;
}

/** Upper-case, accent-free fuel label, so `IRRADIACIÓN` matches however it is encoded. */
export function normaliseTipo(tipo: string | null | undefined): string {
  return (tipo ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toUpperCase();
}

/** `dt` query value (DD/MM/YYYY) for a local calendar day given as YYYY-MM-DD. */
export function ammDateParam(localDay: string): string {
  const [y, m, d] = localDay.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * The `WINDOW_DAYS` local calendar days that end yesterday (Guatemala time),
 * oldest first, as YYYY-MM-DD.
 */
export function windowDays(now: Date, days = WINDOW_DAYS): string[] {
  const localNow = new Date(now.getTime() + GT_OFFSET_HOURS * 3_600_000);
  const todayUtcMidnight = Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate());
  const out: string[] = [];
  for (let i = days; i >= 1; i--) {
    out.push(new Date(todayUtcMidnight - i * 86_400_000).toISOString().slice(0, 10));
  }
  return out;
}

/**
 * Solar points for one local day. Returns [] for an empty day (AMM answers
 * `[]` outside its window) and throws on a malformed or implausible one.
 * A day must carry all 24 solar hours to count.
 */
export function parseAmmDay(localDay: string, rows: unknown): CurtailmentPoint[] {
  if (!Array.isArray(rows)) throw new Error(`guatemala ${localDay}: payload is not an array`);
  if (rows.length === 0) return [];
  const byHour = new Map<number, number>();
  let solarRows = 0;
  const seenHours = new Set<number>();
  for (const row of rows as AmmRow[]) {
    if (normaliseTipo(row?.tipo) !== "IRRADIACION") continue;
    solarRows++;
    const hourEnding = Number(row.hora);
    if (!Number.isInteger(hourEnding) || hourEnding < 1 || hourEnding > 24) {
      throw new Error(`guatemala ${localDay}: bad hora ${String(row.hora)}`);
    }
    if (seenHours.has(hourEnding)) {
      throw new Error(`guatemala ${localDay}: two solar rows for hour ${hourEnding}`);
    }
    seenHours.add(hourEnding);
    // null / blank is missing data, not zero (Number(null) would be 0).
    if (row.potencia === null || row.potencia === undefined || String(row.potencia).trim() === "") continue;
    const raw = Number(row.potencia);
    if (!Number.isFinite(raw)) {
      throw new Error(`guatemala ${localDay}: unparseable solar potencia ${JSON.stringify(row.potencia)} at hour ${hourEnding}`);
    }
    if (raw < -MAX_AUX_LOAD_MW) {
      throw new Error(`guatemala ${localDay}: solar ${raw} MW at hour ${hourEnding} is below -${MAX_AUX_LOAD_MW} MW`);
    }
    // Small negatives are plant auxiliary load at night: no solar output.
    const mw = Math.max(0, raw);
    if (mw > MAX_PLAUSIBLE_SOLAR_MW) {
      throw new Error(`guatemala ${localDay}: solar ${mw} MW exceeds ${MAX_PLAUSIBLE_SOLAR_MW} MW ceiling`);
    }
    byHour.set(hourEnding, mw);
  }
  // A non-empty day with no solar row at all means the label changed.
  if (solarRows === 0) throw new Error(`guatemala ${localDay}: no IRRADIACIÓN rows in a non-empty day`);
  if (byHour.size < 24) return [];
  const [y, m, d] = localDay.split("-").map(Number);
  const points: CurtailmentPoint[] = [];
  for (let h = 1; h <= 24; h++) {
    // Hour-ending h covers local [h-1, h); UTC = local − offset.
    const startMs = Date.UTC(y, m - 1, d, h - 1 - GT_OFFSET_HOURS);
    points.push({ utcTimestamp: new Date(startMs).toISOString(), mw: byHour.get(h)!, intervalHours: 1 });
  }
  return points;
}

export function buildGuatemalaRegion(daily: CurtailmentPoint[][], localDays?: string[]): RegionData {
  const completeDays = (localDays ?? []).filter((_, i) => daily[i]?.length === 24);
  const complete = daily.filter((d) => d.length === 24);
  if (complete.length < MIN_DAYS) {
    throw new Error(`guatemala: only ${complete.length} complete AMM days (need ${MIN_DAYS})`);
  }
  const points = complete.flat().sort((a, b) => a.utcTimestamp.localeCompare(b.utcTimestamp));
  const note =
    `AMM hourly solar generation (IRRADIACIÓN), ${complete.length} complete days ` +
    (completeDays.length ? `${completeDays[0]} → ${completeDays.at(-1)} (Guatemala time). ` : "") +
    "Waste unpublished: AMM publishes generation, not curtailment.";
  const region = unpublishedGenerationRegion(REGION_ID, "solar", points, note);
  // The helper sums points when they span ≥25 days, which would count any
  // skipped day as zero. Use the mean complete day × 30 instead.
  const meanDayMWh = points.reduce((sum, p) => sum + p.mw * (p.intervalHours ?? 1), 0) / complete.length;
  return { ...region, generationTotalTWh: (meanDayMWh * 30) / 1_000_000 };
}

/**
 * A single non-JSON body (a truncated response, a one-off HTML challenge
 * page) is skipped like a missed download. This many in one run means the
 * format changed, and the run fails rather than thinning the window.
 */
const MAX_NON_JSON_DAYS = 3;

async function run(now = new Date()): Promise<RegionData> {
  const days = windowDays(now);
  let nonJsonDays = 0;
  const daily = await mapWithConcurrency(days, 4, async (day) => {
    let rows: unknown;
    try {
      rows = await fetchJSON<unknown>(`${BASE_URL}?dt=${ammDateParam(day)}`, { timeoutMs: 20000, retries: 1 });
    } catch (err) {
      if ((err as Error).name === "SyntaxError" && ++nonJsonDays >= MAX_NON_JSON_DAYS) {
        throw new Error(`guatemala: ${nonJsonDays} days returned a non-JSON body; format changed? (${(err as Error).message})`);
      }
      // A day that does not download is skipped; MIN_DAYS guards the window.
      console.warn(`guatemala: ${day} skipped (${(err as Error).message})`);
      return [] as CurtailmentPoint[];
    }
    // A day that downloads but does not parse fails the run, so a format
    // change falls back to last-good instead of quietly thinning the window.
    return parseAmmDay(day, rows);
  });
  return buildGuatemalaRegion(daily, days);
}

export const buildGuatemalaData = (now?: Date) => run(now);

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback(REGION_ID, () => run(), { regionTier: "estimated" })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => { console.error("guatemala loader failed", err); process.exit(1); });
}
