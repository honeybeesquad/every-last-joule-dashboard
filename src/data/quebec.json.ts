/**
 * Quebec hydro + wind — Hydro-Québec open data, "Sources de l'électricité
 * produite au Québec" (Données Québec dataset
 * `sources-production-electricite-quebec`, published for HackQC).
 *
 * MEASURED     hourly generation in MW by source (hydraulique, eolien, ...)
 *              from production.json, a rolling yesterday-plus-today file that
 *              Hydro-Québec refreshes every hour. Hydro and wind are
 *              telemetered ("puissances télémesurées").
 * UNPUBLISHED  waste. Hydro-Québec publishes neither a wind-curtailment series
 *              nor an hourly spill-energy figure. Spilled FLOWS (m³/s) exist in
 *              the separate hydrometric dataset; turning them into energy is a
 *              modelling step, not a measurement — see
 *              docs/research/2026-11-18-hydro-quebec-spill-flows.md.
 *
 * Replaces the "Hydro-Quebec fallback": a typical seasonal hydro shape scaled
 * to a ~0.3 TWh/yr export-absorbed surplus anchor that had no published
 * source. That anchor is dropped — missing ≠ zero.
 *
 * Stays `tier: "estimated"` / T3-modelled / official-lead. Not T1a.
 */

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";
import { unpublishedGenerationRegion } from "../lib/waste-status.js";

export const PRODUCTION_URL =
  "https://www.hydroquebec.com/data/documents-donnees/donnees-ouvertes/json/production.json";

/** Hydro-Québec timestamps are Quebec local time (Eastern, with DST). */
const QUEBEC_TZ = "America/Toronto";

/**
 * Plausibility ceilings, MW. Hydro-Québec's hydro fleet plus contracted
 * Churchill Falls output is under 45 GW and the winter record demand is
 * ~42 GW; Quebec has ~4 GW of wind under contract. A reading above these
 * means the parser is on the wrong field, not a record hour.
 */
const MAX_PLAUSIBLE_HYDRO_MW = 50_000;
const MAX_PLAUSIBLE_WIND_MW = 8_000;

/** Minimum hourly readings before the window is worth trusting. */
const MIN_ROWS = 24;

export interface HqProductionFile {
  dateStart?: string;
  dateEnd?: string;
  recentHour?: string;
  details?: Array<{ date?: string; valeurs?: Record<string, number | null | undefined> }>;
}

export interface QuebecGeneration {
  hydro: CurtailmentPoint[];
  wind: CurtailmentPoint[];
}

export interface QuebecData {
  hydro: RegionData;
  wind: RegionData;
}

// ─── Time handling ──────────────────────────────────────────────────────────

const offsetFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: QUEBEC_TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Offset of Quebec local time from UTC at `utcMs`, in ms (negative: behind UTC). */
function quebecOffsetMs(utcMs: number): number {
  const parts = Object.fromEntries(
    offsetFormatter.formatToParts(new Date(utcMs)).map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - utcMs;
}

/**
 * Convert a Hydro-Québec local timestamp (`YYYY-MM-DDTHH:MM:SS`, no offset) to
 * ISO 8601 UTC. Returns null when the string does not parse.
 */
export function quebecLocalToUtcIso(local: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(local.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const wallMs = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s ?? 0));
  if (Number.isNaN(wallMs)) return null;
  // Two passes settle the offset across a DST change.
  let utcMs = wallMs - quebecOffsetMs(wallMs);
  utcMs = wallMs - quebecOffsetMs(utcMs);
  return new Date(utcMs).toISOString();
}

// ─── Parsing ────────────────────────────────────────────────────────────────

function readMw(
  valeurs: Record<string, number | null | undefined>,
  key: "hydraulique" | "eolien",
  ceiling: number,
  utcTimestamp: string,
): number | null {
  const raw = valeurs[key];
  // A missing field is "not yet published", not zero: the file pre-fills the
  // rest of today with `{ total: 0 }` placeholders.
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  if (raw < 0) {
    throw new Error(`Hydro-Québec reported negative ${key} generation (${raw} MW) at ${utcTimestamp}`);
  }
  if (raw > ceiling) {
    throw new Error(
      `Hydro-Québec ${key} read ${raw} MW at ${utcTimestamp}, above the ${ceiling} MW plausibility ceiling`,
    );
  }
  return raw;
}

/**
 * Parse production.json into hourly hydro and wind GENERATION points (MW, not
 * curtailment). Throws when the file is malformed or too short, so
 * `withFallback` serves the last-good snapshot instead.
 */
export function parseProduction(file: HqProductionFile): QuebecGeneration {
  if (!file || !Array.isArray(file.details)) {
    throw new Error("Hydro-Québec production.json has no details array — format changed");
  }
  const hydro = new Map<string, number>();
  const wind = new Map<string, number>();
  const seenLocal = new Set<string>();
  for (const row of file.details) {
    if (!row?.date || !row.valeurs) continue;
    let utcTimestamp = quebecLocalToUtcIso(row.date);
    if (!utcTimestamp) continue;
    // On the November fall-back night the local hour 01:30 occurs twice: once
    // in daylight time, then again an hour later in standard time. The second
    // occurrence is the later UTC instant, so it must not overwrite the first.
    if (seenLocal.has(row.date)) {
      utcTimestamp = new Date(Date.parse(utcTimestamp) + 3_600_000).toISOString();
    }
    seenLocal.add(row.date);
    const h = readMw(row.valeurs, "hydraulique", MAX_PLAUSIBLE_HYDRO_MW, utcTimestamp);
    const w = readMw(row.valeurs, "eolien", MAX_PLAUSIBLE_WIND_MW, utcTimestamp);
    if (h !== null) hydro.set(utcTimestamp, h);
    if (w !== null) wind.set(utcTimestamp, w);
  }
  const toPoints = (m: Map<string, number>): CurtailmentPoint[] =>
    Array.from(m.entries())
      .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw }))
      .sort((a, b) => a.utcTimestamp.localeCompare(b.utcTimestamp));
  const out = { hydro: toPoints(hydro), wind: toPoints(wind) };

  if (out.hydro.length < MIN_ROWS) {
    throw new Error(`Hydro-Québec production.json yielded ${out.hydro.length} hydro hours, need ${MIN_ROWS}`);
  }
  if (out.wind.length < MIN_ROWS) {
    throw new Error(`Hydro-Québec production.json yielded ${out.wind.length} wind hours, need ${MIN_ROWS}`);
  }
  if (out.hydro.every((p) => p.mw === 0)) {
    throw new Error("Hydro-Québec hydro generation is zero across the whole window — feed broken");
  }
  return out;
}

// ─── Region assembly ────────────────────────────────────────────────────────

function describeWindow(points: CurtailmentPoint[]): string {
  return `${points.length} hourly readings ${points[0].utcTimestamp} to ${points[points.length - 1].utcTimestamp}`;
}

/**
 * Build the two region records. Waste is unpublished: `profile` and
 * `totalTWh` stay zero and generation goes in `generationProfile`.
 */
export function buildQuebecRegions(gen: QuebecGeneration): QuebecData {
  const hydroNote =
    `Hydro-Québec open data, sources of electricity produced in Quebec (production.json, hydraulique MW), ` +
    `${describeWindow(gen.hydro)}. Generation measured. Waste unpublished — Hydro-Québec publishes no hourly ` +
    `spill-energy series; spilled flows (m³/s) in its hydrometric dataset are not energy. Replaces the ` +
    `former ~0.3 TWh/yr modelled surplus anchor, which had no published source. Missing ≠ zero. Not T1a.`;
  const windNote =
    `Hydro-Québec open data, sources of electricity produced in Quebec (production.json, eolien MW — ` +
    `independent producers under contract), ${describeWindow(gen.wind)}. Generation measured. Waste unpublished — ` +
    `no wind-curtailment series is published. Missing ≠ zero. Not T1a.`;
  return {
    hydro: unpublishedGenerationRegion("quebec", "hydro-seasonal", gen.hydro, hydroNote),
    wind: unpublishedGenerationRegion("quebec-wind", "wind", gen.wind, windNote),
  };
}

// ─── Fetch ──────────────────────────────────────────────────────────────────

async function run(): Promise<QuebecData> {
  const text = await fetchText(PRODUCTION_URL, { timeoutMs: 20000, retries: 1 });
  return buildQuebecRegions(parseProduction(JSON.parse(text) as HqProductionFile));
}

/** Build from a saved copy of production.json. Used by the tests. */
export function buildQuebecDataFromFile(path: string): QuebecData {
  return buildQuebecRegions(parseProduction(JSON.parse(readFileSync(path, "utf-8")) as HqProductionFile));
}

/** Live build: performs a real fetch, so tests use the fixture helper above. */
export const buildQuebecData = () => run();

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback<QuebecData>("quebec", () => run(), { regionTier: "estimated" })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("quebec loader failed", err);
      process.exit(1);
    });
}
