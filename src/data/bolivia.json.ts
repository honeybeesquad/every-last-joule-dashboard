/**
 * Bolivia solar — CNDC (Comité Nacional de Despacho de Carga) 15-minute
 * generation by source.
 *
 * MEASURED     15-minute solar generation from CNDC's public REST route
 *              `wp-json/cndc/v1/rt/generacion?fecha=YYYY-MM-DD`. Each day is an
 *              array of `{ codigo, fecha, valores }` series; `valores` holds
 *              96 MW values from 00:00 Bolivia time (UTC−4, no daylight
 *              saving) in 15-minute steps, and solar is `codigo: "SOLAR"`.
 * UNPUBLISHED  waste. CNDC publishes generation and reservoir data, not
 *              curtailment or spill. The former 0.1 TWh/yr static
 *              (IRENA-derived) was modelled, not a CNDC figure, and is dropped
 *              with the owner's sign-off (2026-11-18).
 *
 * CNDC marks an unmeasured quarter-hour with -1, not null: every series on
 * every day carries -1 at step 94 (23:30), and the current day's unfilled
 * tail is all -1. A missing value (-1 or null) at night (00:00–04:59,
 * 20:00–23:59 local, when Bolivia has no sun in any season) is read as zero;
 * one in 05:00–19:59 makes the day incomplete and it is skipped.
 *
 * The route answered for 2025-01-01 and later; 2024-01-01 came back `[]`.
 * CNDC's old `gene/dat/gene.php` endpoint is 404 since the 2026 redesign.
 *
 * Probe notes: docs/research/2026-11-18-no-public-series-probe.md.
 * Stays `tier: "estimated"` / T3 / official-lead. Not T1a.
 */

import { pathToFileURL } from "node:url";

import { mapWithConcurrency } from "../lib/concurrency.js";
import { completeLocalDays } from "../lib/local-days.js";
import { fetchJSON } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";
import { unpublishedGenerationRegion } from "../lib/waste-status.js";

const REGION_ID = "bolivia";
const BASE_URL = "https://www.cndc.bo/wp-json/cndc/v1/rt/generacion";

/** Bolivia is a flat UTC−4 with no daylight saving. */
const BO_OFFSET_HOURS = -4;

/** Days requested: the 14 complete local days before today. */
const WINDOW_DAYS = 14;

/** Fewer complete days than this and the window is not worth trusting. */
const MIN_DAYS = 7;

/** Values per day: 96 quarter-hours. */
const STEPS_PER_DAY = 96;

/**
 * Plausibility ceiling for one 15-minute solar value, MW. Bolivia's solar
 * peaked near 150 MW on 2026-11-16 and generated ~0.36 TWh in 2025 (CNDC
 * annual history). A value in the hundreds of MW above that means the parser
 * has read the total or thermal series.
 */
const MAX_PLAUSIBLE_SOLAR_MW = 600;

/** CNDC's marker for a quarter-hour with no measurement. */
const NO_DATA = -1;

/** Quarter-hour steps that can carry sun: 05:00 (step 20) to 19:59 (step 79). */
const FIRST_DAYLIGHT_STEP = 20;
const LAST_DAYLIGHT_STEP = 79;

interface CndcSeries {
  codigo?: unknown;
  fecha?: unknown;
  valores?: unknown;
}

/** The `days` complete local days that end yesterday (Bolivia time), oldest first. */
export function windowDays(now: Date, days = WINDOW_DAYS): string[] {
  return completeLocalDays(now, BO_OFFSET_HOURS, days);
}

/**
 * 15-minute solar points for one local day. Returns [] for an empty day
 * (`[]`, outside CNDC's history) and throws on a payload that is not the
 * expected series list, so a format change fails the run.
 */
export function parseCndcDay(localDay: string, payload: unknown): CurtailmentPoint[] {
  if (!Array.isArray(payload)) throw new Error(`bolivia ${localDay}: payload is not an array`);
  if (payload.length === 0) return [];
  const solar = (payload as CndcSeries[]).filter((s) => String(s?.codigo ?? "").trim().toUpperCase() === "SOLAR");
  if (solar.length !== 1) throw new Error(`bolivia ${localDay}: expected one SOLAR series, found ${solar.length}`);
  const series = solar[0];
  if (!String(series.fecha ?? "").startsWith(localDay)) {
    throw new Error(`bolivia ${localDay}: SOLAR series is for ${String(series.fecha)}`);
  }
  const values = series.valores;
  if (!Array.isArray(values) || values.length !== STEPS_PER_DAY) {
    throw new Error(`bolivia ${localDay}: SOLAR has ${Array.isArray(values) ? values.length : "no"} values, expected ${STEPS_PER_DAY}`);
  }
  const [y, mo, d] = localDay.split("-").map(Number);
  const points: CurtailmentPoint[] = [];
  for (let i = 0; i < STEPS_PER_DAY; i++) {
    const raw = values[i];
    const blank = raw === null || raw === undefined || String(raw).trim() === "";
    const mw = blank ? NO_DATA : Number(raw);
    if (!Number.isFinite(mw) || (mw < 0 && mw !== NO_DATA)) {
      throw new Error(`bolivia ${localDay}: bad SOLAR value ${String(raw)} at step ${i}`);
    }
    const daylight = i >= FIRST_DAYLIGHT_STEP && i <= LAST_DAYLIGHT_STEP;
    // Missing in daylight: the day is incomplete. Missing at night: no sun, zero.
    if (mw === NO_DATA && daylight) return [];
    if (mw > MAX_PLAUSIBLE_SOLAR_MW) {
      throw new Error(`bolivia ${localDay}: SOLAR ${mw} MW exceeds ${MAX_PLAUSIBLE_SOLAR_MW} MW ceiling`);
    }
    const startMs = Date.UTC(y, mo - 1, d, -BO_OFFSET_HOURS, i * 15);
    points.push({ utcTimestamp: new Date(startMs).toISOString(), mw: mw === NO_DATA ? 0 : mw, intervalHours: 0.25 });
  }
  return points;
}

export function buildBoliviaRegion(daily: CurtailmentPoint[][], localDays: string[]): RegionData {
  const completeDays = localDays.filter((_, i) => daily[i]?.length === STEPS_PER_DAY);
  if (completeDays.length < MIN_DAYS) {
    throw new Error(`bolivia: only ${completeDays.length} complete CNDC days (need ${MIN_DAYS})`);
  }
  const points = daily.filter((d) => d.length === STEPS_PER_DAY).flat();
  const note =
    `CNDC 15-minute solar generation, ${completeDays.length} complete days ` +
    `${completeDays[0]} → ${completeDays.at(-1)} (Bolivia time). ` +
    "Waste unpublished: CNDC publishes generation, not curtailment or spill.";
  return unpublishedGenerationRegion(REGION_ID, "solar", points, note, { minPoints: STEPS_PER_DAY });
}

async function run(now = new Date()): Promise<RegionData> {
  const days = windowDays(now);
  const daily = await mapWithConcurrency(days, 4, async (day) => {
    let payload: unknown;
    try {
      payload = await fetchJSON<unknown>(`${BASE_URL}?fecha=${day}`, { timeoutMs: 20000, retries: 1 });
    } catch (err) {
      // A day that does not download (or is not JSON) is skipped; MIN_DAYS guards the window.
      console.warn(`bolivia: ${day} skipped (${(err as Error).message})`);
      return [] as CurtailmentPoint[];
    }
    // A day that downloads as JSON but is not the expected series list fails
    // the run, so a format change falls back to last-good.
    return parseCndcDay(day, payload);
  });
  return buildBoliviaRegion(daily, days);
}

export const buildBoliviaData = () => run();

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback(REGION_ID, () => run(), { regionTier: "estimated" })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => { console.error("bolivia loader failed", err); process.exit(1); });
}
