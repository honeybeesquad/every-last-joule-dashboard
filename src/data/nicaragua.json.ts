/**
 * Nicaragua solar — CNDC (Centro Nacional de Despacho de Carga) hourly
 * generation by type, captured nightly.
 *
 * MEASURED     hourly solar generation from CNDC's public chart endpoint
 *              `graficos/consultarGeneracionPorTipo`. It returns the current
 *              Nicaragua-time day only (UTC−6, no daylight saving), with no
 *              date parameter, so a day is lost unless someone reads it before
 *              local midnight. `.github/workflows/nicaragua-capture.yml` does
 *              that at 23:40 local and merges the day into
 *              `data/historical/nicaragua-cndc-solar-hourly.csv`; this loader
 *              reads the committed CSV.
 * UNPUBLISHED  waste. CNDC publishes generation, not curtailment. Missing ≠ zero.
 *
 * A captured day counts when it has local hours 00:00–19:00, which cover every
 * daylight hour; hours 20–23 may be absent and read as zero. Until seven such
 * days exist (the capture began 2026-11-18), the loader serves an empty
 * unpublished record that says so, as the grid marker it replaces did.
 *
 * Timestamp convention: a row for 04:00 appears about 20 minutes after 04:00,
 * so the stamp could mark either end of its hour. We read it as the start; a
 * one-hour shift does not change a day's solar energy.
 *
 * Probe notes: docs/research/2026-11-18-no-public-series-probe.md.
 * Stays `tier: "estimated"` / T3 / official-lead. Not T1a.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { relayFreshness, RELAY_STALENESS_THRESHOLD_DAYS } from "../lib/freshness.js";
import { withFallback } from "../lib/resilient.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";
import { unpublishedEmptyRegion, unpublishedGenerationRegion } from "../lib/waste-status.js";

const REGION_ID = "nicaragua";
export const CNDC_URL = "https://www.cndc.org.ni/graficos/consultarGeneracionPorTipo";
export const CSV_PATH = join("data", "historical", "nicaragua-cndc-solar-hourly.csv");
export const CSV_HEADER = "date_local,hour_local,solar_mw,captured_at";

/** Nicaragua is a flat UTC−6 with no daylight saving. */
const NI_OFFSET_HOURS = -6;

/** Local hours 00–19 must be present: every hour that can carry daylight. */
const REQUIRED_LOCAL_HOURS = 20;

/** Days used for the profile, and the fewest that make it worth serving. */
const WINDOW_DAYS = 14;
const MIN_DAYS = 7;

/**
 * Plausibility ceiling for one hourly solar reading, MW. Nicaragua's 2024
 * solar generation was ~0.03 TWh (Our World in Data), i.e. tens of MW of
 * capacity. A reading in the hundreds means another type or a total was read.
 */
const MAX_PLAUSIBLE_SOLAR_MW = 400;

export interface CapturedHour {
  dateLocal: string; // YYYY-MM-DD, Nicaragua time
  hourLocal: number; // 0–23, start of hour
  solarMw: number;
  capturedAt: string; // ISO UTC of the capture run
}

interface CndcRow {
  fecha_hora?: string;
  tipo?: string;
  valor?: string | number | null;
}

/**
 * Solar rows of one CNDC response. Throws on a malformed payload, an
 * implausible or negative value, a duplicate hour, or rows spanning two dates.
 * A null or blank value is skipped as missing.
 */
export function parseCndcSolar(payload: unknown, capturedAt: string): CapturedHour[] {
  const rows = (payload as { GeneracionTipo?: unknown } | null)?.GeneracionTipo;
  if (!Array.isArray(rows)) throw new Error("nicaragua: GeneracionTipo is not an array");
  const out: CapturedHour[] = [];
  const seen = new Set<number>();
  let day: string | null = null;
  for (const row of rows as CndcRow[]) {
    if ((row?.tipo ?? "").trim().toUpperCase() !== "SOLAR") continue;
    const m = /^(\d{4}-\d{2}-\d{2}) (\d{2}):00:00$/.exec(row.fecha_hora ?? "");
    if (!m) throw new Error(`nicaragua: bad fecha_hora ${String(row.fecha_hora)}`);
    if (day && day !== m[1]) throw new Error(`nicaragua: payload spans ${day} and ${m[1]}`);
    day = m[1];
    const hour = Number(m[2]);
    if (hour > 23) throw new Error(`nicaragua: bad hour ${m[2]}`);
    if (seen.has(hour)) throw new Error(`nicaragua: duplicate SOLAR hour ${hour} on ${day}`);
    seen.add(hour);
    if (row.valor === null || row.valor === undefined || String(row.valor).trim() === "") continue;
    const mw = Number(row.valor);
    if (!Number.isFinite(mw) || mw < 0) throw new Error(`nicaragua: bad SOLAR value ${String(row.valor)} at ${day} ${hour}:00`);
    if (mw > MAX_PLAUSIBLE_SOLAR_MW) {
      throw new Error(`nicaragua: SOLAR ${mw} MW exceeds ${MAX_PLAUSIBLE_SOLAR_MW} MW ceiling`);
    }
    out.push({ dateLocal: day, hourLocal: hour, solarMw: mw, capturedAt });
  }
  return out;
}

export function parseCsv(text: string): CapturedHour[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];
  if (lines[0].trim() !== CSV_HEADER) throw new Error(`nicaragua: unexpected CSV header ${lines[0]}`);
  return lines.slice(1).map((line, i) => {
    const [dateLocal, hour, mw, capturedAt] = line.split(",");
    const row = { dateLocal, hourLocal: Number(hour), solarMw: Number(mw), capturedAt };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateLocal) || !Number.isInteger(row.hourLocal) || row.hourLocal < 0 || row.hourLocal > 23 || !Number.isFinite(row.solarMw)) {
      throw new Error(`nicaragua: bad CSV row ${i + 2}: ${line}`);
    }
    return row;
  });
}

/**
 * Merge new captures into existing rows: a later capture of the same date and
 * hour replaces the earlier one (a run late in the day sees more settled
 * values). Sorted by date then hour.
 */
export function mergeCaptures(existing: CapturedHour[], incoming: CapturedHour[]): CapturedHour[] {
  const byKey = new Map<string, CapturedHour>();
  for (const r of [...existing, ...incoming]) {
    const key = `${r.dateLocal} ${r.hourLocal}`;
    const prev = byKey.get(key);
    if (!prev || r.capturedAt >= prev.capturedAt) byKey.set(key, r);
  }
  return [...byKey.values()].sort((a, b) => (a.dateLocal === b.dateLocal ? a.hourLocal - b.hourLocal : a.dateLocal.localeCompare(b.dateLocal)));
}

export function toCsv(rows: CapturedHour[]): string {
  return [CSV_HEADER, ...rows.map((r) => `${r.dateLocal},${r.hourLocal},${r.solarMw},${r.capturedAt}`)].join("\n") + "\n";
}

/** UTC hour-start points for the latest complete captured days. */
export function completeDays(rows: CapturedHour[], windowDays = WINDOW_DAYS): { days: string[]; points: CurtailmentPoint[] } {
  const byDay = new Map<string, Map<number, number>>();
  for (const r of rows) {
    if (!byDay.has(r.dateLocal)) byDay.set(r.dateLocal, new Map());
    byDay.get(r.dateLocal)!.set(r.hourLocal, r.solarMw);
  }
  const complete = [...byDay.keys()]
    .sort()
    .filter((d) => Array.from({ length: REQUIRED_LOCAL_HOURS }, (_, h) => h).every((h) => byDay.get(d)!.has(h)))
    .slice(-windowDays);
  const points: CurtailmentPoint[] = [];
  for (const d of complete) {
    const [y, mo, dd] = d.split("-").map(Number);
    const hours = byDay.get(d)!;
    for (let h = 0; h < 24; h++) {
      // Hours 20–23 may be absent: no sun, zero.
      points.push({ utcTimestamp: new Date(Date.UTC(y, mo - 1, dd, h - NI_OFFSET_HOURS)).toISOString(), mw: hours.get(h) ?? 0, intervalHours: 1 });
    }
  }
  return { days: complete, points };
}

export function buildNicaraguaRegion(rows: CapturedHour[], now: Date = new Date()): RegionData {
  const { days, points } = completeDays(rows);
  const status = relayFreshness(days.length ? `${days.at(-1)}T23:59:59-06:00` : null, now, RELAY_STALENESS_THRESHOLD_DAYS);
  if (days.length < MIN_DAYS) {
    return {
      ...unpublishedEmptyRegion(
        REGION_ID,
        `CNDC hourly solar generation is captured nightly from 2026-11-18; ${days.length} complete day(s) so far, ` +
          `${MIN_DAYS} needed before a profile is served. Waste unpublished: CNDC publishes generation, not curtailment.`,
        now.toISOString(),
      ),
      sourceStatus: "degraded",
      sourceProvenance: "official-lead",
    };
  }
  const note =
    `CNDC hourly solar generation, ${days.length} captured days ${days[0]} → ${days.at(-1)} (Nicaragua time). ` +
    "Waste unpublished: CNDC publishes generation, not curtailment.";
  return { ...unpublishedGenerationRegion(REGION_ID, "solar", points, note), sourceStatus: status };
}

function run(): RegionData {
  const path = join(process.cwd(), CSV_PATH);
  const rows = existsSync(path) ? parseCsv(readFileSync(path, "utf-8")) : [];
  return buildNicaraguaRegion(rows);
}

export const buildNicaraguaData = () => run();

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback(REGION_ID, async () => run(), { regionTier: "estimated" })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => { console.error("nicaragua loader failed", err); process.exit(1); });
}
