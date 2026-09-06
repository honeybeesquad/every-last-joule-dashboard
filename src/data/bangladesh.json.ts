/**
 * Bangladesh solar curtailment loader — PGCB hourly generation page.
 *
 * WHAT IS MEASURED AND WHAT IS NOT (read this before changing anything):
 *
 *   MEASURED  the 24-hour diurnal SHAPE. PGCB (the national transmission
 *             company) publishes a rolling ~48-hour table of hourly system
 *             generation by fuel, including a solar column, at
 *             erp.powergrid.gov.bd. That column is real, current, national
 *             metered generation and it is what shapes this region's profile.
 *
 *   MODELLED  the MAGNITUDE. PGCB publishes generation, NOT curtailment.
 *             Bangladesh has no published curtailment feed and no published
 *             national curtailment rate. The 0.1 TWh/yr annual anchor this
 *             loader scales to is the repo's own pre-existing estimate,
 *             carried over unchanged from the previous BPDB fallback. It is
 *             an estimate, not a measurement, and it is not cited to anyone.
 *
 * So the region stays `tier: "estimated"` / T3-modelled / modelled-fallback.
 * The gain over the fallback this replaces is that the profile is now the
 * shape of real Bangladeshi solar output instead of a synthetic bell curve;
 * the energy total is unchanged and still modelled. Do not describe this
 * loader as measured, live, or anchored.
 *
 * Method (this is the guide's blessed pattern for a percentage/rate applied
 * to generation — docs/methodology/tier-classification-guide.md, bad
 * conversion #3: pair the rate with the operator's own generation for the
 * same window and show the arithmetic):
 *
 *   1. Parse hourly solar generation MW from the PGCB table.
 *   2. Average it by UTC hour-of-day to get a 24-point shape.
 *   3. Scale that shape so it integrates to the 0.1 TWh/yr anchor. The
 *      scale factor IS the implied curtailment rate, and the loader reports
 *      it in `sourceNote` every build so an implausible anchor is visible
 *      rather than buried.
 *
 * The loader THROWS on any fetch, structure, or plausibility failure so
 * `withFallback` degrades to the committed last-good snapshot. It must never
 * emit a modelled shape while claiming to have read the page (the Maharashtra
 * precedent in STATUS.md).
 */

import { readFileSync } from "node:fs";
import { request as httpsRequest } from "node:https";
import type { TLSSocket } from "node:tls";
import { pathToFileURL } from "node:url";

import { latestCompleteUtcDayProfileGW, timeOfDayAverageGW } from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";

const REGION_ID = "bangladesh";
const GENERATION_URL = "https://erp.powergrid.gov.bd/web/generations/view_generations_bn";

/**
 * Annual solar curtailment anchor, TWh/yr. MODELLED — carried over unchanged
 * from the BPDB fallback this loader replaces, so this change moves no
 * dataset totals. Nobody published it; it is the repo's own estimate and it
 * wants a real citation (see the Follow-ups note on the PR that added this).
 */
const ANNUAL_ANCHOR_TWH = 0.1;

/** Bangladesh Standard Time is a flat UTC+6 with no daylight saving. */
const BST_OFFSET_HOURS = 6;

/** Bengali-script digits, in value order, for numeral transliteration. */
const BENGALI_DIGITS = "০১২৩৪৫৬৭৮৯";

/**
 * Bengali column headings the parser locates by name rather than by fixed
 * index. The June 2026 draft of this loader hardcoded index 9 for solar; the
 * table carries a `ভারত` (India) heading that spans three sub-columns, so any
 * upstream column insertion silently shifts a hardcoded index onto a
 * different fuel. Reading the header instead turns that failure into a throw.
 */
/**
 * Every heading comparison runs through NFC first.
 *
 * PGCB serves `সময়` (time) with the precomposed BENGALI LETTER YYA U+09DF,
 * while the same word typed into a source file normally lands as the
 * decomposed U+09AF U+09BC pair. They render identically and compare
 * unequal, so a raw `includes()` on the heading silently finds nothing.
 * U+09DF is a Unicode composition exclusion, so NFC decomposes it and both
 * spellings converge. Normalise BOTH sides or this breaks again.
 */
const nfc = (s: string) => s.normalize("NFC");

const HEADING_DATE = nfc("তারিখ");
const HEADING_TIME = nfc("সময়");
const HEADING_SOLAR = nfc("সৌর");
const HEADING_INDIA = nfc("ভারত");

/**
 * Plausibility ceiling for a single hourly solar reading, MW. Bangladesh had
 * roughly 0.8 GW of grid-connected solar in 2026 (BPDB) against ~14 GW of
 * system generation, so a reading in the thousands means the parser has
 * latched onto the wrong column (gas, coal, or the system total) rather than
 * a genuine record day. Cross-check before raising this.
 */
const MAX_PLAUSIBLE_SOLAR_MW = 3000;

/** Minimum hourly rows needed before the window is worth trusting. */
const MIN_ROWS = 24;

/** Minimum distinct UTC hours-of-day that must carry a reading. */
const MIN_DISTINCT_HOURS = 12;

// ─── Bengali numeral + date helpers ─────────────────────────────────────────

/**
 * Convert a Bengali-numeral string to a number. Returns NaN when the cell
 * holds no digits at all, so callers can tell "not reported" from zero
 * (tier-classification-guide bad conversion #4).
 */
export function bengaliToNumber(raw: string): number {
  let out = "";
  for (const ch of raw.trim()) {
    const bengaliIndex = BENGALI_DIGITS.indexOf(ch);
    if (bengaliIndex >= 0) out += String(bengaliIndex);
    else if (/[0-9.\-]/.test(ch)) out += ch;
  }
  if (!/[0-9]/.test(out)) return NaN;
  const value = Number(out);
  return Number.isFinite(value) ? value : NaN;
}

/**
 * Convert a `DD-MM-YYYY` + `HH:MM:SS` pair of Bengali-numeral cells (both in
 * Bangladesh Standard Time) to an ISO 8601 UTC timestamp. Returns null when
 * either cell does not parse.
 */
export function bengaliDateTimeToIso(dateCell: string, timeCell: string): string | null {
  const dateParts = dateCell.split("-");
  if (dateParts.length !== 3) return null;
  const day = bengaliToNumber(dateParts[0]);
  const month = bengaliToNumber(dateParts[1]);
  const year = bengaliToNumber(dateParts[2]);
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return null;
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2000 || year > 2100) return null;

  const timeParts = timeCell.split(":");
  const hour = bengaliToNumber(timeParts[0] ?? "");
  const minute = timeParts.length > 1 ? bengaliToNumber(timeParts[1]) : 0;
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  const minutes = Number.isInteger(minute) && minute >= 0 && minute < 60 ? minute : 0;

  const ms = Date.UTC(year, month - 1, day, hour - BST_OFFSET_HOURS, minutes);
  const parsed = new Date(ms);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

// ─── HTML table parsing ─────────────────────────────────────────────────────

function stripTags(html: string): string {
  return nfc(
    html
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function extractRows(tableHtml: string): string[][] {
  const rows: string[][] = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
    const cells: string[] = [];
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
      cells.push(stripTags(cellMatch[1]));
    }
    rows.push(cells);
  }
  return rows;
}

export interface PgcbColumns {
  date: number;
  time: number;
  solar: number;
}

/**
 * Resolve the date/time/solar column indices from the table's own header row
 * instead of trusting fixed offsets.
 *
 * The header row carries 14 headings while data rows carry 16 cells: the
 * `ভারত` (India) heading spans three sub-columns (Bheramara HVDC, Tripura,
 * Adani) that only appear on data rows. Header index therefore equals data
 * index for every column LEFT of `ভারত`, and diverges to the right of it.
 * Solar sits left of India today; this function asserts that rather than
 * assuming it, so an upstream reshuffle throws instead of silently reading
 * the wrong fuel.
 */
export function resolveColumns(rows: string[][]): PgcbColumns {
  const headerRow = rows
    .map((cells) => cells.map(nfc))
    .find((cells) => cells.some((c) => c.includes(HEADING_DATE)));
  if (!headerRow) {
    throw new Error(`PGCB table has no header row containing "${HEADING_DATE}"`);
  }

  const indexOfHeading = (needle: string) => headerRow.findIndex((c) => c.includes(needle));
  const date = indexOfHeading(HEADING_DATE);
  const time = indexOfHeading(HEADING_TIME);
  const solar = indexOfHeading(HEADING_SOLAR);
  const india = indexOfHeading(HEADING_INDIA);

  const missing = (
    [
      [HEADING_DATE, date],
      [HEADING_TIME, time],
      [HEADING_SOLAR, solar],
      [HEADING_INDIA, india],
    ] as const
  )
    .filter(([, idx]) => idx < 0)
    .map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(
      `PGCB header row is missing expected column(s) ${missing.join(", ")} — ` +
        `page structure changed; got [${headerRow.join(" | ")}]`,
    );
  }

  if (solar > india || date > india || time > india) {
    throw new Error(
      `PGCB header puts "${HEADING_SOLAR}"/"${HEADING_DATE}"/"${HEADING_TIME}" at or right of ` +
        `"${HEADING_INDIA}" (solar=${solar}, india=${india}); the India sub-columns shift data-row ` +
        `indices, so header offsets can no longer be trusted for those columns`,
    );
  }

  return { date, time, solar };
}

/**
 * Parse hourly solar GENERATION (MW, not curtailment) out of the PGCB page.
 * Throws when the table is absent, the header is unrecognised, too few rows
 * parse, or the readings are outside the plausible range for the Bangladeshi
 * solar fleet.
 */
export function parseSolarGenerationMW(html: string): CurtailmentPoint[] {
  const tableMatch = html.match(/<table[^>]*class="[^"]*table-bordered[^"]*"[^>]*>[\s\S]*?<\/table>/i);
  if (!tableMatch) {
    throw new Error('PGCB page has no <table class="table-bordered"> — page structure changed');
  }

  const rows = extractRows(tableMatch[0]);
  const columns = resolveColumns(rows);
  const minCells = Math.max(columns.date, columns.time, columns.solar) + 1;

  const byTimestamp = new Map<string, number>();
  for (const cells of rows) {
    if (cells.length < minCells) continue; // header + the India sub-heading row
    if (cells[columns.date].includes(HEADING_DATE)) continue; // header row itself
    const utcTimestamp = bengaliDateTimeToIso(cells[columns.date], cells[columns.time]);
    if (!utcTimestamp) continue;

    const solarMw = bengaliToNumber(cells[columns.solar]);
    // A blank solar cell is "not reported", not zero — skip it rather than
    // coercing (tier-classification-guide bad conversion #4).
    if (!Number.isFinite(solarMw)) continue;
    if (solarMw < 0) {
      throw new Error(`PGCB reported a negative solar generation value (${solarMw} MW) at ${utcTimestamp}`);
    }
    if (solarMw > MAX_PLAUSIBLE_SOLAR_MW) {
      throw new Error(
        `PGCB solar column read ${solarMw} MW at ${utcTimestamp}, above the ${MAX_PLAUSIBLE_SOLAR_MW} MW ` +
          `plausibility ceiling for the Bangladeshi solar fleet — the parser is probably on the wrong column`,
      );
    }
    // The page repeats the newest hour while it is still filling; last write
    // wins, which is the more complete reading.
    byTimestamp.set(utcTimestamp, solarMw);
  }

  const points: CurtailmentPoint[] = Array.from(byTimestamp.entries())
    .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw }))
    .sort((a, b) => a.utcTimestamp.localeCompare(b.utcTimestamp));

  if (points.length < MIN_ROWS) {
    throw new Error(`PGCB table yielded only ${points.length} hourly rows, need at least ${MIN_ROWS}`);
  }
  const distinctHours = new Set(points.map((p) => new Date(p.utcTimestamp).getUTCHours())).size;
  if (distinctHours < MIN_DISTINCT_HOURS) {
    throw new Error(
      `PGCB table covers only ${distinctHours} distinct UTC hours, need at least ${MIN_DISTINCT_HOURS} ` +
        `for a diurnal shape`,
    );
  }
  if (points.every((p) => p.mw === 0)) {
    throw new Error(
      "PGCB solar column is all-zero across the whole window — the feed or the column mapping is broken, " +
        "and an all-zero solar profile is not a credible reading",
    );
  }

  return points;
}

// ─── Region assembly ────────────────────────────────────────────────────────

export interface BuildOptions {
  /** Overrides the build clock. Tests pass a fixed date for a stable snapshot. */
  now?: () => Date;
}

/**
 * Turn measured hourly solar generation into the region record.
 *
 * The generation shape is rescaled so its annual integral equals
 * `ANNUAL_ANCHOR_TWH`. The scale factor is the curtailment rate the anchor
 * implies against the generation actually observed in this window; it is
 * reported in `sourceNote` so a wrong anchor shows up as an absurd rate
 * instead of hiding inside a plausible-looking curve.
 */
export function buildBangladeshRegion(
  generationPoints: CurtailmentPoint[],
  opts: BuildOptions = {},
): RegionData {
  const now = opts.now?.() ?? new Date();

  // Mean MW per UTC hour-of-day. Summing the 24 values gives mean MWh/day,
  // and because it is a per-hour MEAN it is unaffected by the page's
  // occasional duplicate or half-hour rows.
  const shapeGW = timeOfDayAverageGW(generationPoints);
  const meanDailyGenerationMWh = shapeGW.reduce((sum, gw) => sum + gw * 1000, 0);
  if (!(meanDailyGenerationMWh > 0)) {
    throw new Error("PGCB solar generation shape has zero area — cannot scale it to the annual anchor");
  }

  const targetDailyCurtailmentMWh = (ANNUAL_ANCHOR_TWH * 1_000_000) / 365;
  const impliedRate = targetDailyCurtailmentMWh / meanDailyGenerationMWh;

  const curtailmentPoints: CurtailmentPoint[] = generationPoints.map((p) => ({
    utcTimestamp: p.utcTimestamp,
    mw: p.mw * impliedRate,
  }));

  const profile = shapeGW.map((gw) => gw * impliedRate);

  // `totalTWh` is a trailing-30-DAY total (src/lib/types.ts). It must NOT be
  // `totalTWh30d(points)` here: PGCB's window is a rolling ~48 hours, so
  // summing the points would report two days of energy in a field the whole
  // dataset reads as thirty — roughly a 14x understatement. Deriving it from
  // the emitted 24-hour curve instead keeps the number and the rendered
  // profile in agreement by construction (the Mexico fix, STATUS 2026-08-20)
  // and reproduces the `annualTWh * 30 / 365` convention the typical-profile
  // builders use.
  const totalTWh = (profile.reduce((sum, gw) => sum + gw, 0) * 30) / 1000;

  const windowStart = generationPoints[0].utcTimestamp;
  const windowEnd = generationPoints[generationPoints.length - 1].utcTimestamp;
  const observedPeakMW = Math.max(...generationPoints.map((p) => p.mw));

  const sourceNote =
    `MODELLED magnitude on a MEASURED shape. PGCB publishes hourly system generation by fuel ` +
    `(erp.powergrid.gov.bd), not curtailment; Bangladesh publishes no curtailment feed and no ` +
    `national curtailment rate. The 24-hour profile is the UTC hour-of-day mean of ` +
    `${generationPoints.length} hourly PGCB solar-generation readings covering ${windowStart} to ` +
    `${windowEnd} (peak ${observedPeakMW.toFixed(0)} MW), rescaled so it integrates to an ` +
    `ESTIMATED ${ANNUAL_ANCHOR_TWH} TWh/yr curtailment anchor — the repo's own figure, unchanged ` +
    `from the previous BPDB fallback and not attributable to any published source. Against the ` +
    `generation in this window that anchor implies a ${(impliedRate * 100).toFixed(2)}% curtailment ` +
    `rate; treat that as the number to challenge. Energy totals are therefore modelled, not measured.`;

  const base: RegionData = {
    regionId: REGION_ID,
    profile,
    // Null whenever the rolling window holds no gap-free UTC day, which
    // happens routinely: PGCB drops the odd hour and sometimes files a
    // half-hour row instead. Null is the honest answer, not a failure.
    latestProfile: latestCompleteUtcDayProfileGW(curtailmentPoints),
    totalTWh,
    peakGW: Math.max(...profile),
    lastUpdated: windowEnd,
    lastSuccessAt: now.toISOString(),
    sourceNote,
  };

  return applyUncertainty(base, { regionTier: "estimated", profileKind: "solar" });
}

// ─── Fetch ──────────────────────────────────────────────────────────────────

/**
 * Expected TLS identity of the PGCB host, checked by hand because the chain
 * cannot be validated (see `fetchGenerationPage`).
 */
const EXPECTED_CERT_CN = "*.powergrid.gov.bd";
const EXPECTED_CERT_ISSUER_O = "SSL2BUY EMEA LLC";

/**
 * Fetch the PGCB page.
 *
 * Why this does not use `fetchText`: erp.powergrid.gov.bd serves ONLY its leaf
 * certificate and omits the intermediate, so every strict client fails the
 * chain (`openssl s_client` reports code 21, "unable to verify the first
 * certificate"; Node's fetch reports "unable to verify the first
 * certificate"). curl appears to succeed only because the system trust store
 * chases the issuer via AIA, which Node does not do.
 *
 * The June 2026 draft called this a self-signed certificate and set
 * `rejectUnauthorized: false` with nothing else. That description was wrong —
 * it is a real DV certificate from a public CA with a broken chain — and
 * disabling verification outright accepts ANY certificate. Verification is
 * still relaxed here because there is no other way to reach the host, but the
 * peer's subject CN and issuer are checked explicitly afterwards, so a
 * substituted certificate is rejected. Nothing secret is sent on this request;
 * the risk being managed is data poisoning, not credential theft.
 */
async function fetchGenerationPage(timeoutMs = 20000): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const url = new URL(GENERATION_URL);
    const req = httpsRequest(
      {
        hostname: url.hostname,
        port: 443,
        path: url.pathname + url.search,
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "bn,en;q=0.9",
        },
        rejectUnauthorized: false,
        timeout: timeoutMs,
      },
      (res) => {
        const socket = res.socket as TLSSocket;
        const peer = typeof socket.getPeerCertificate === "function" ? socket.getPeerCertificate() : undefined;
        const cn = peer?.subject?.CN;
        const issuerO = peer?.issuer?.O;
        if (cn !== EXPECTED_CERT_CN || issuerO !== EXPECTED_CERT_ISSUER_O) {
          res.resume();
          reject(
            new Error(
              `PGCB TLS identity mismatch: expected CN "${EXPECTED_CERT_CN}" issued by ` +
                `"${EXPECTED_CERT_ISSUER_O}", got CN "${cn ?? "?"}" issued by "${issuerO ?? "?"}"`,
            ),
          );
          return;
        }
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode ?? "?"} for ${GENERATION_URL}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new Error(`timeout after ${timeoutMs}ms for ${GENERATION_URL}`)));
    req.on("error", reject);
    req.end();
  });
}

/**
 * Fetch, parse, build. Throws on any failure so `withFallback` serves the
 * committed last-good snapshot rather than a modelled shape dressed up as a
 * successful read.
 */
async function run(): Promise<RegionData> {
  const html = await fetchGenerationPage();
  return buildBangladeshRegion(parseSolarGenerationMW(html));
}

/** Build the region from a saved copy of the page. Used by the tests. */
export function buildBangladeshDataFromHtml(html: string, opts: BuildOptions = {}): RegionData {
  return buildBangladeshRegion(parseSolarGenerationMW(html), opts);
}

/** Build the region from a page on disk. Used by the tests. */
export function buildBangladeshDataFromFile(path: string, opts: BuildOptions = {}): RegionData {
  return buildBangladeshDataFromHtml(readFileSync(path, "utf-8"), opts);
}

/**
 * Live build. Kept for parity with the other loaders' exported builders; it
 * performs a real fetch, so tests should use the fixture helpers above.
 */
export const buildBangladeshData = () => run();

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback(REGION_ID, () => run(), { regionTier: "estimated" })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("bangladesh loader failed", err);
      process.exit(1);
    });
}
