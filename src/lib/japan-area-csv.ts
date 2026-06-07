import { fetchHttp1Bytes } from "./fetch.js";
import { latestCompleteUtcDayProfileGW, peakGW, timeOfDayAverageGW, totalTWh30d } from "./profile.js";
import type { CurtailmentPoint, RegionData } from "./types.js";

/** Japan Standard Time offset from UTC, hours. */
const JST_OFFSET_HOURS = 9;
/** 30-minute interval expressed as a fraction of an hour, for totalTWh30d. */
const INTERVAL_HOURS = 0.5;
/** Trailing window length, days — matches the Tohoku/other live-loader convention. */
const WINDOW_DAYS = 30;

export type DateFormat = "slash" | "yyyymmdd";

/**
 * Per-area loader configuration. The OCCTO-standard monthly area
 * supply-demand CSV (`eria_jukyu_YYYYMM_NN.csv`) is published by every
 * Japanese TSO with direct measured 太陽光出力制御量 (solar curtailment) +
 * 風力出力制御量 (wind curtailment) columns. Layouts vary (20 vs 22 cols,
 * Shift-JIS vs UTF-8, slash vs yyyymmdd dates, quoted fields) so the parser
 * resolves columns by NAME and the per-area knobs live here.
 */
export interface JapanAreaConfig {
  regionId: string;
  /** Two-digit area code, e.g. "03" for TEPCO. */
  areaCode: string;
  /** Host + directory, NO trailing slash; the file is appended. */
  baseUrl: string;
  cadence: "monthly";
  dateFormat: DateFormat;
}

/** A parsed 30-min sample carrying the solar/wind split for fuelShare. */
export interface AreaPoint extends CurtailmentPoint {
  solarMw: number;
  windMw: number;
}

export interface AreaParsed {
  points: AreaPoint[];
  solarCurtMwSum: number;
  windCurtMwSum: number;
  sampleCount: number;
}

const stripCell = (s: string): string => s.trim().replace(/^"|"$/g, "");

/**
 * Decode area-CSV bytes. All TSOs publish Shift-JIS except TEPCO (UTF-8).
 * Auto-detect: decode Shift-JIS first; if the curtailment header marker is
 * absent (mojibake or genuinely UTF-8), decode UTF-8.
 */
export function decodeAreaCsv(buf: Uint8Array): string {
  const sjis = new TextDecoder("shift-jis").decode(buf);
  if (sjis.includes("太陽光出力制御量")) return sjis;
  return new TextDecoder("utf-8").decode(buf);
}

/** Convert a JST date+time to an ISO-8601 UTC string, or undefined if malformed. */
export function jstToIsoUtc(dateRaw: string, timeRaw: string, fmt: DateFormat): string | undefined {
  let yyyy: number, mm: number, dd: number;
  if (fmt === "slash") {
    const m = dateRaw.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (!m) return undefined;
    [yyyy, mm, dd] = [Number(m[1]), Number(m[2]), Number(m[3])];
  } else {
    const m = dateRaw.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (!m) return undefined;
    [yyyy, mm, dd] = [Number(m[1]), Number(m[2]), Number(m[3])];
  }
  const tm = timeRaw.match(/^(\d{1,2}):(\d{2})$/);
  if (!tm) return undefined;
  const utcMs = Date.UTC(yyyy, mm - 1, dd, Number(tm[1]) - JST_OFFSET_HOURS, Number(tm[2]), 0, 0);
  if (!Number.isFinite(utcMs)) return undefined;
  return new Date(utcMs).toISOString();
}

/**
 * Parse a decoded area-CSV. Locates the header by the presence of
 * 太陽光出力制御量, resolves both curtailment columns by name (robust to
 * 20- vs 22-col layouts and quoted fields), and accumulates 30-min samples.
 * Non-data rows (banners, blanks, footers) are skipped because their first
 * cell does not parse as a date.
 */
export function parseAreaCsv(decoded: string, cfg: { dateFormat: DateFormat }): AreaParsed {
  const lines = decoded.split(/\r?\n/);
  let headerIdx = -1, solarCol = -1, windCol = -1;
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes("太陽光出力制御量")) continue;
    headerIdx = i;
    const headers = lines[i].split(",").map(stripCell);
    for (let c = 0; c < headers.length; c++) {
      if (headers[c] === "太陽光出力制御量") solarCol = c;
      if (headers[c] === "風力出力制御量") windCol = c;
    }
    break;
  }
  const empty: AreaParsed = { points: [], solarCurtMwSum: 0, windCurtMwSum: 0, sampleCount: 0 };
  if (headerIdx < 0 || solarCol < 0) return empty;

  const points: AreaPoint[] = [];
  let solarCurtMwSum = 0, windCurtMwSum = 0, sampleCount = 0;
  const minCols = Math.max(solarCol, windCol) + 1;
  for (let i = headerIdx + 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const cells = lines[i].split(",").map(stripCell);
    if (cells.length < minCols) continue;
    const utcTimestamp = jstToIsoUtc(cells[0] ?? "", cells[1] ?? "", cfg.dateFormat);
    if (!utcTimestamp) continue;
    const solarMw = Math.max(0, Number(cells[solarCol]) || 0);
    const windMw = windCol >= 0 ? Math.max(0, Number(cells[windCol]) || 0) : 0;
    solarCurtMwSum += solarMw;
    windCurtMwSum += windMw;
    sampleCount += 1;
    points.push({ utcTimestamp, mw: solarMw + windMw, intervalHours: INTERVAL_HOURS, solarMw, windMw });
  }
  return { points, solarCurtMwSum, windCurtMwSum, sampleCount };
}

/**
 * Merge parsed months, keep the trailing WINDOW_DAYS, and build RegionData
 * with a data-driven fuelShare. Pure (no network) so it is unit-testable.
 * Throws when the window is empty — the loader relies on withFallback serving
 * the committed last-good snapshot rather than emitting a tier-incoherent
 * typical shape. `confidenceTier` is intentionally left unset so withFallback's
 * enrichWithTier stamps the canonical tier from REGIONS.
 */
export function mergeWindowBuild(
  months: AreaParsed[],
  regionId: string,
  sourceNote: string,
  now: Date,
): RegionData {
  const cutoffMs = now.getTime() - WINDOW_DAYS * 24 * 3600 * 1000;
  const windowed = months
    .flatMap((m) => m.points)
    .filter((p) => new Date(p.utcTimestamp).getTime() >= cutoffMs)
    .sort((a, b) => a.utcTimestamp.localeCompare(b.utcTimestamp));

  if (windowed.length === 0) {
    throw new Error(`${regionId}: no usable curtailment rows in the trailing ${WINDOW_DAYS} days`);
  }

  const solar = windowed.reduce((s, p) => s + p.solarMw, 0);
  const wind = windowed.reduce((s, p) => s + p.windMw, 0);
  const total = solar + wind;
  const fuelShare = total > 0 ? { solar: solar / total, wind: wind / total } : { solar: 1, wind: 0 };
  const lastTs = windowed.at(-1)?.utcTimestamp ?? now.toISOString();

  return {
    regionId,
    profile: timeOfDayAverageGW(windowed),
    latestProfile: latestCompleteUtcDayProfileGW(windowed),
    totalTWh: totalTWh30d(windowed),
    peakGW: peakGW(windowed),
    lastUpdated: lastTs,
    lastSuccessAt: lastTs,
    sourceNote,
    fuelShare,
  };
}

function formatYyyyMm(d: Date): string {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function fetchAreaMonth(cfg: JapanAreaConfig, yyyymm: string, timeoutMs = 30000): Promise<AreaParsed> {
  const url = `${cfg.baseUrl}/eria_jukyu_${yyyymm}_${cfg.areaCode}.csv`;
  const buf = await fetchHttp1Bytes(url, timeoutMs);
  return parseAreaCsv(decodeAreaCsv(buf), cfg);
}

/**
 * Fetch the current and previous calendar month, merge, and build the trailing
 * 30-day RegionData. Each month's failure is logged and skipped; throws only if
 * BOTH yield no windowed rows (→ withFallback serves last-good).
 */
export async function runJapanAreaLoader(cfg: JapanAreaConfig, sourceNote: string): Promise<RegionData> {
  const now = new Date();
  const prevD = new Date(now);
  prevD.setUTCDate(1);
  prevD.setUTCMonth(prevD.getUTCMonth() - 1);
  const months = [formatYyyyMm(prevD), formatYyyyMm(now)];

  const parsed: AreaParsed[] = [];
  for (const m of months) {
    try {
      parsed.push(await fetchAreaMonth(cfg, m));
    } catch (err) {
      console.warn(`${cfg.regionId} ${m} fetch failed: ${(err as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return mergeWindowBuild(parsed, cfg.regionId, sourceNote, now);
}
