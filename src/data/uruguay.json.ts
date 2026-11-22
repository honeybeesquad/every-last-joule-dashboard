import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "url";
import { fetchBytes as fetchBytesWithAbort, fetchText } from "../lib/fetch.js";
import { softStopMs } from "../lib/loader-deadline.js";
import { latestCompleteUtcDayProfileGW, peakGW, timeOfDayAverageGW, totalTWh30d, trailingDays } from "../lib/profile.js";
import { withFallback, type LoaderBudget } from "../lib/resilient.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";

const REGION_ID = "uruguay";
const CONTROL_PANEL_URL = "https://adme.com.uy/controlpanel.php";
const INFO_CONSIGNAS_URL = "https://www.adme.com.uy/info_consignas.php";
const RESTRICTIONS_URL = "https://www.adme.com.uy/panelControl/ro_excel.php";

/**
 * Fallback list of ADME renewable plants for cases where `info_consignas.php`
 * is unreachable. STALENESS RISK: this list will silently drop any new
 * wind/solar plants ADME adds after 2026-04-29 until the file is refreshed.
 * The primary path through `info_consignas.php` parses live and is preferred;
 * this set only kicks in on parse failure. Refresh by:
 *   curl https://www.adme.com.uy/info_consignas.php | grep -oE 'consignas_[a-z0-9_-]+' | sort -u
 * and reconciling against this set. Last refreshed: 2026-04-29; Juan Pablo Terra and
 * El Naranjal added 2026-11-21 from the 2026-09 workbook's header.
 */
export const FALLBACK_RENEWABLE_PLANTS = new Set([
  "18 de julio",
  "albisu",
  "alto cielo",
  "arapey solar",
  "artilleros",
  "caracoles i",
  "caracoles ii",
  "carape i",
  "carape ii",
  "casalko",
  "cerro grande",
  "colonia arias",
  "cuchilla del peralta i",
  "del litoral",
  "dicano",
  "el naranjal", // solar, Salto; in the 2026-09 workbook, missing from the 2026-04-29 list
  "engraw export & import co",
  "fenima",
  "florida i",
  "florida ii",
  "juan pablo terra", // UTE wind, Artigas; second-largest restricted plant in 2026-09, missing from the 2026-04-29 list
  "julieta",
  "kiyu",
  "la jacinta",
  "libertad",
  "luz de loma",
  "luz de mar",
  "luz de rio",
  "maldonado",
  "maldonado ii",
  "maria luz",
  "melowind",
  "menafra solar",
  "minas i",
  "natelu",
  "nuevo manantial central 1",
  "nuevo manantial central 2 (ms)",
  "nuevo pastorale i",
  "palomas",
  "pampa",
  "peralta i gcee",
  "peralta ii gcee",
  "petilcoran",
  "raditon",
  "rosario",
  "solis de mataojo",
  "talas de maciel ii",
  "talas del maciel i",
  "ute pta fv",
  "valentines",
  "ventus i",
  "villa rodriguez",
  "yarnel",
]);

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&ntilde;/g, "ñ")
    .replace(/&Ntilde;/g, "Ñ")
    .replace(/&oacute;/g, "ó")
    .replace(/&Oacute;/g, "Ó")
    .replace(/&iacute;/g, "í")
    .replace(/&Iacute;/g, "Í")
    .replace(/&uacute;/g, "ú")
    .replace(/&Uacute;/g, "Ú")
    .replace(/&eacute;/g, "é")
    .replace(/&Eacute;/g, "É")
    .replace(/&aacute;/g, "á")
    .replace(/&Aacute;/g, "Á")
    .replace(/&lowbar;/g, "_")
    .replace(/&colon;/g, ":")
    .replace(/&percnt;/g, "%")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

export function normalizePlantName(value: string): string {
  return decodeHtml(value)
    .replace(/<[^>]*>/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // "P.E." / "P. E." / "PE" (parque eólico) and "P.F." (parque fotovoltaico) as
    // whole words only: until 2026-11-21 these also ate the "Pe" of "Peralta"
    // and "Petilcoran", so fallback names never matched those columns.
    .replace(/\bp\s*\.\s*[ef]\b\s*\.?/gi, "")
    .replace(/\bp[ef](?![a-z])/gi, "")
    .replace(/\beolico\b/gi, "")
    .replace(/\bsolar\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function parseNumber(value: string | undefined): number {
  if (value == null) return 0;
  const clean = decodeHtml(value).trim().replace(/\s+/g, "");
  if (!clean || /^nc$/i.test(clean)) return 0;
  if (clean.includes(",") && clean.includes(".")) {
    return Number(clean.lastIndexOf(",") > clean.lastIndexOf(".")
      ? clean.replace(/\./g, "").replace(",", ".")
      : clean.replace(/,/g, ""));
  }
  return Number(clean.replace(",", "."));
}

export function parseAdmeConsignaPlantNames(html: string): Set<string> {
  const names = new Set<string>();
  for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const firstCell = row[1].match(/<td\b[^>]*>([\s\S]*?)<\/td>/i)?.[1];
    if (!firstCell) continue;
    const name = normalizePlantName(firstCell);
    if (!name || name === "central" || name === "mw" || name === "-") continue;
    if (/^\d+(\.\d+)?$/.test(name)) continue;
    names.add(name);
  }
  return names;
}

function unzipText(zipBytes: Uint8Array, member: string): string {
  const dir = mkdtempSync(join(tmpdir(), "adme-xlsx-"));
  const zipPath = join(dir, "source.xlsx");
  try {
    writeFileSync(zipPath, zipBytes);
    return execFileSync("unzip", ["-p", zipPath, member], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function parseSharedStrings(xml: string): string[] {
  return Array.from(xml.matchAll(/<si>([\s\S]*?)<\/si>/g)).map((match) =>
    Array.from(match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g))
      .map((part) => decodeHtml(part[1]))
      .join(""),
  );
}

function columnIndex(ref: string): number {
  const letters = ref.match(/[A-Z]+/)?.[0] ?? "";
  let out = 0;
  for (const letter of letters) out = out * 26 + letter.charCodeAt(0) - 64;
  return out - 1;
}

function parseWorksheet(xml: string, sharedStrings: string[]): Map<number, Map<number, string>> {
  const rows = new Map<number, Map<number, string>>();
  for (const match of xml.matchAll(/<c\s+([^>]*?[^/])>([\s\S]*?)<\/c>/g)) {
    const attrs = match[1];
    const ref = attrs.match(/r="([A-Z]+\d+)"/)?.[1];
    if (!ref) continue;
    const row = Number(ref.match(/\d+/)?.[0]);
    const col = columnIndex(ref);
    const type = attrs.match(/t="([^"]+)"/)?.[1];
    let value = match[2].match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
    if (type === "s") value = sharedStrings[Number(value)] ?? value;
    if (!rows.has(row)) rows.set(row, new Map());
    rows.get(row)?.set(col, value);
  }
  return rows;
}

function parseUruguayLocalHour(value: string): string | null {
  const match = value.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, dd, mm, yyyy, hh, min] = match;
  // Uruguay has no daylight saving time at present; local time is UTC-3.
  return new Date(Date.UTC(
    Number(yyyy),
    Number(mm) - 1,
    Number(dd),
    Number(hh) + 3,
    Number(min),
  )).toISOString();
}

const ZIP_LOCAL_HEADER = [0x50, 0x4b, 0x03, 0x04]; // "PK\x03\x04"

/**
 * ADME's `ro_excel.php` runs with PHP `display_errors` on: every response is
 * `text/html`, 6–12 MB of PHP warnings, then the xlsx bytes. Probed from a NZ
 * residential network on 2026-11-21 (GET is the only method it accepts; no
 * header or parameter turns the warnings off). Returns the xlsx from the first
 * zip local-file header, and the warning text before it.
 */
export function splitAdmeWorkbookResponse(body: Uint8Array): { xlsx: Uint8Array; prefix: string } {
  for (let i = 0; i + 3 < body.length; i++) {
    if (body[i] === ZIP_LOCAL_HEADER[0] && body[i + 1] === ZIP_LOCAL_HEADER[1]
      && body[i + 2] === ZIP_LOCAL_HEADER[2] && body[i + 3] === ZIP_LOCAL_HEADER[3]) {
      // The whole prefix: the `$valores` warning can come after megabytes of others.
      return { xlsx: body.subarray(i), prefix: new TextDecoder("latin1").decode(body.subarray(0, i)) };
    }
  }
  throw new Error("ADME restrictions response held no xlsx (no zip signature)");
}

/**
 * A month ADME has not yet filled in still gets a workbook, with every plant
 * column at zero, and the warnings in front of it name `$valores` (2026-10 and
 * 2026-11 on 2026-11-21, while 2026-09 and earlier warned only of missing
 * array keys). The control panel's `ultimo_mes` names such a month, so it is
 * not a reliable latest-published month.
 */
export function isUnpublishedAdmeMonth(prefix: string): boolean {
  return /Undefined variable \$valores/.test(prefix);
}

/**
 * True when every plant cell in the workbook is zero or blank: the shape of a
 * month ADME has not filled in (all 127 columns, all 744 hours, for 2026-10).
 * A published month has non-zero cells somewhere (1,219 in 2026-09), so this
 * backs up the `$valores` signal should ADME turn its warnings off.
 */
export function isEmptyAdmeWorkbook(zipBytes: Uint8Array): boolean {
  const sharedStrings = parseSharedStrings(unzipText(zipBytes, "xl/sharedStrings.xml"));
  const rows = parseWorksheet(unzipText(zipBytes, "xl/worksheets/sheet1.xml"), sharedStrings);
  for (const [rowNumber, row] of rows) {
    if (rowNumber === 1) continue;
    for (const [col, value] of row) if (col > 0 && parseNumber(value) !== 0) return false;
  }
  return true;
}

export function parseAdmeRestrictionsXlsx(zipBytes: Uint8Array, renewablePlants: Set<string>): CurtailmentPoint[] {
  const sharedStrings = parseSharedStrings(unzipText(zipBytes, "xl/sharedStrings.xml"));
  const rows = parseWorksheet(unzipText(zipBytes, "xl/worksheets/sheet1.xml"), sharedStrings);
  const header = rows.get(1);
  if (!header) throw new Error("ADME restrictions workbook missing header row");

  const selectedColumns = Array.from(header.entries())
    .filter(([col, name]) => col > 0 && renewablePlants.has(normalizePlantName(name)))
    .map(([col]) => col);

  if (selectedColumns.length === 0) {
    throw new Error("ADME restrictions workbook had no renewable plant columns after name matching");
  }

  const points: CurtailmentPoint[] = [];
  for (const rowNumber of Array.from(rows.keys()).sort((a, b) => a - b)) {
    if (rowNumber === 1) continue;
    const row = rows.get(rowNumber);
    const timestamp = parseUruguayLocalHour(row?.get(0) ?? "");
    if (!row || !timestamp) continue;
    const mw = selectedColumns.reduce((sum, col) => sum + Math.max(0, parseNumber(row.get(col))), 0);
    points.push({ utcTimestamp: timestamp, mw });
  }

  return points.sort((a, b) => a.utcTimestamp.localeCompare(b.utcTimestamp));
}

function previousMonth({ year, month }: { year: number; month: number }): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

function latestCompleteMonth(controlPanelHtml: string): { year: number; month: number } {
  const years = Array.from(controlPanelHtml.matchAll(/name="ultimo_anio"\s+value="(\d{4})"/g)).map((m) => Number(m[1]));
  const months = Array.from(controlPanelHtml.matchAll(/name="ultimo_mes"\s+value="(\d{1,2})"/g)).map((m) => Number(m[1]));
  const pairs = years.map((year, i) => ({ year, month: months[i] })).filter((p) =>
    Number.isFinite(p.year) && Number.isFinite(p.month) && p.month >= 1 && p.month <= 12,
  );
  if (pairs.length === 0) {
    const now = new Date();
    // The month before this one, 1-based (getUTCMonth is 0-based, so 0 means January → last December).
    const m = now.getUTCMonth();
    return m === 0 ? { year: now.getUTCFullYear() - 1, month: 12 } : { year: now.getUTCFullYear(), month: m };
  }
  return pairs.sort((a, b) => (b.year - a.year) || (b.month - a.month))[0];
}

export function buildUruguayRegionData(points: CurtailmentPoint[], sourceNote: string): RegionData {
  const window = trailingDays(points, 30);
  if (window.length === 0) throw new Error("ADME restrictions workbook contained no parseable hourly rows");
  const lastUpdated = window.at(-1)?.utcTimestamp ?? new Date().toISOString();
  return {
    regionId: REGION_ID,
    profile: timeOfDayAverageGW(window),
    latestProfile: latestCompleteUtcDayProfileGW(window),
    totalTWh: totalTWh30d(window),
    peakGW: peakGW(window),
    lastUpdated,
    lastSuccessAt: lastUpdated,
    sourceNote,
    fuelShare: { wind: 0.96, solar: 0.04 },
  };
}

/**
 * Per-request cap on an ADME workbook. ADME builds each 6–12 MB response on
 * the fly (PHP warnings ahead of the workbook): standalone it answers in
 * 2–3 s, but in the production build of 2026-11-22 07:10 UTC the first
 * request passed the old flat 40 s cap and the region fell back to its May
 * snapshot.
 */
export const ADME_REQUEST_CAP_MS = 90_000;

/**
 * When the month walk must stop: at the loader's soft stop (a share of
 * withFallback's live deadline, counted from when withFallback started the
 * loader, so the control-panel requests count against it), or 150 s from now
 * when no deadline is set.
 */
export function admeWalkDeadline(budget: LoaderBudget, now = Date.now()): number {
  return budget.deadlineMs > 0 ? budget.startedAt + softStopMs(budget.deadlineMs) : now + 150_000;
}

/** The timeout for the next workbook request, or null once the walk is out of time. */
export function admeRequestTimeoutMs(deadline: number, now = Date.now()): number | null {
  const remaining = deadline - now;
  return remaining > 0 ? Math.min(remaining, ADME_REQUEST_CAP_MS) : null;
}

async function fetchWorkbook(url: string, deadline: number): Promise<Uint8Array> {
  const timeoutMs = admeRequestTimeoutMs(deadline);
  if (timeoutMs === null) throw new Error(`ADME month walk out of time before ${url}`);
  const started = Date.now();
  // The shared fetch helper: withFallback's deadline aborts it, so a request
  // never outlives the loader.
  const bytes = await fetchBytesWithAbort(url, { timeoutMs, retries: 0, headers: { "user-agent": "Mozilla/5.0" } });
  console.warn(`ADME workbook ${(bytes.length / 1e6).toFixed(1)} MB in ${((Date.now() - started) / 1000).toFixed(1)} s: ${url}`);
  return bytes;
}

async function run(budget: LoaderBudget = { deadlineMs: 0, startedAt: Date.now() }): Promise<RegionData> {
  const [controlPanelHtml, consignasHtml] = await Promise.all([
    fetchText(CONTROL_PANEL_URL, { timeoutMs: 30000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } }),
    fetchText(INFO_CONSIGNAS_URL, { timeoutMs: 30000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } }),
  ]);
  const latest = latestCompleteMonth(controlPanelHtml);
  const plants = parseAdmeConsignaPlantNames(consignasHtml);
  // Normalised like the header and the consignas names, or "menafra solar" never meets "Menafra Solar".
  for (const name of FALLBACK_RENEWABLE_PLANTS) plants.add(normalizePlantName(name));

  // Walk back from the month the control panel names to the newest one ADME
  // has filled in; three steps covers the two-month lag seen on 2026-11-21.
  const deadline = admeWalkDeadline(budget);
  let month = latest;
  for (let step = 0; step < 4; step++, month = previousMonth(month)) {
    const mm = String(month.month).padStart(2, "0");
    const url = `${RESTRICTIONS_URL}?anod=${month.year}&mesd=${mm}&anoh=${month.year}&mesh=${mm}`;
    const { xlsx, prefix } = splitAdmeWorkbookResponse(await fetchWorkbook(url, deadline));
    if (isUnpublishedAdmeMonth(prefix) || isEmptyAdmeWorkbook(xlsx)) {
      console.warn(`ADME ${month.year}-${mm} not published yet; trying the month before`);
      continue;
    }
    const points = parseAdmeRestrictionsXlsx(xlsx, plants);
    return buildUruguayRegionData(points, `ADME control-panel hourly Restricciones Operativas workbook (${month.year}-${mm}, the newest month ADME has published); renewable plant columns matched from info_consignas.php and fallback plant registry. Source: ${url}`);
  }
  throw new Error(`ADME has published no Restricciones Operativas month from ${latest.year}-${String(latest.month).padStart(2, "0")} back four months`);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<RegionData>(REGION_ID, run, {
    regionTier: "live" as const,
    tagLive: (r) => ({ ...r, sourceStatus: "live" as const }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" as const }),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("uruguay loader failed", err);
      process.exit(1);
    });
}

export const buildUruguayData = () => run();
