import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { timeOfDayAverageGW, totalTWh30d, peakGW, latestCompleteUtcDayProfileGW } from "../lib/profile.js";
import { buildTypicalSolarRegion } from "../lib/typical-profiles.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";

const REGION_ID = "nigeria";

/**
 * Nigeria grid operator (TCN) — Generation Profile page.
 * ASP.NET WebForms: requires __VIEWSTATE + __EVENTVALIDATION from a GET,
 * then POST with form fields to retrieve the GENCO hourly generation table.
 *
 * Source: niggrid.org/GenerationProfile2
 * Fuel breakdown: gas, steam, hydro (no utility solar yet in GENCO registry).
 * Solar curtailment anchor: ~0.05 TWh/yr (TCN/Ember 2024).
 * Wind is negligible in Nigeria.
 */
const NIGGRID_GEN_URL = "https://niggrid.org/GenerationProfile2";

/**
 * Nigeria solar curtailment rate.
 * Anchor: ~0.05 TWh/yr (TCN/Ember 2024).
 * Nigeria total generation ≈ 35–40 TWh/yr, solar <1% of mix.
 * Rate = 0.05 / ~38 ≈ 0.0013 → rounded to 0.0015 to be slightly conservative.
 */
const SOLAR_CURTAILMENT_RATE = 0.0015;

/** Nigeria is UTC+1 year-round (no DST). */
const NIGERIA_UTC_OFFSET_HOURS = 1;

/**
 * Extract ASP.NET hidden form fields from the GenerationProfile2 HTML.
 * Returns { viewstate, eventvalidation, viewstategenerator }.
 */
function extractAspnetFields(html: string): {
  viewstate: string;
  eventvalidation: string;
  viewstategenerator: string;
} {
  const vsMatch = /name="__VIEWSTATE"[^>]*value="([^"]*)"/.exec(html);
  const evMatch = /name="__EVENTVALIDATION"[^>]*value="([^"]*)"/.exec(html);
  const vsgMatch = /name="__VIEWSTATEGENERATOR"[^>]*value="([^"]*)"/.exec(html);

  if (!vsMatch || !evMatch) {
    throw new Error("Niggrid page missing required ASP.NET hidden fields (__VIEWSTATE/__EVENTVALIDATION)");
  }

  return {
    viewstate: vsMatch[1],
    eventvalidation: evMatch[1],
    viewstategenerator: vsgMatch?.[1] ?? "",
  };
}

/** Format date as YYYY/MM/DD for niggrid form. */
function toNiggridDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${yyyy}/${mm}/${dd}`;
}

/**
 * Parse the niggrid GENCO generation HTML table into hourly MW totals.
 * The table has columns: #, Genco, 01:00..24:00, TotalGeneration
 * Returns an array of 24 hourly MW totals summed across all GENCOs.
 */
function parseNiggridGenerationTable(html: string): number[] {
  const hourlyTotals = new Array(24).fill(0);

  // Extract the generation table
  const tableMatch = /<table[^>]*id="MainContent_gvGeneration"[^>]*>(.*?)<\/table>/s.exec(html);
  if (!tableMatch) {
    throw new Error("Niggrid response missing generation table (MainContent_gvGeneration)");
  }

  const tableHtml = tableMatch[1];
  const rows = tableHtml.split(/<tr[^>]*>/s).filter((r) => r.includes("<td"));

  for (const row of rows) {
    // Extract all <td> values
    const tdMatches = row.match(/<td[^>]*>(.*?)<\/td>/gs);
    if (!tdMatches || tdMatches.length < 26) continue; // need # + name + 24h + total

    const values: string[] = [];
    for (const td of tdMatches) {
      // Strip HTML tags and whitespace
      const cleaned = td.replace(/<[^>]+>/g, "").trim();
      values.push(cleaned);
    }

    // Hours are at indices 2–25 (after # and Genco name)
    for (let h = 0; h < 24; h++) {
      const raw = values[h + 2] ?? "0";
      const val = parseFloat(raw.replace(/,/g, ""));
      if (!isNaN(val) && val > 0) {
        hourlyTotals[h] += val;
      }
    }
  }

  return hourlyTotals;
}

/**
 * Create CurtailmentPoints from hourly MW totals for a given date.
 * Applies the solar curtailment rate to each hour's total generation.
 * NOTE: This uses total grid generation as a rough temporal shape proxy.
 * Nigeria has negligible utility solar; the shape is thermal/hydro baseload
 * rather than solar-diurnal. The ±20% "anchored" tier uncertainty envelope
 * accounts for this shape-proxy mismatch.
 */
function hourlyTotalsToCurtailment(
  hourlyTotals: number[],
  date: Date,
): CurtailmentPoint[] {
  const points: CurtailmentPoint[] = [];

  for (let h = 0; h < 24; h++) {
    if (hourlyTotals[h] <= 0) continue;

    // Create UTC timestamp: Nigeria is UTC+1, so local hour H → UTC hour H-1
    const utcDate = new Date(Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      h - NIGERIA_UTC_OFFSET_HOURS,
      0, 0, 0,
    ));

    const curtailedMw = hourlyTotals[h] * SOLAR_CURTAILMENT_RATE;
    if (curtailedMw > 0) {
      points.push({
        utcTimestamp: utcDate.toISOString(),
        mw: Math.max(0, curtailedMw),
        intervalHours: 1,
      });
    }
  }

  return points;
}

/** Fetch niggrid generation data for a single date. */
async function fetchNiggridGenForDate(
  date: Date,
  sessionFields: { viewstate: string; eventvalidation: string } | null,
): Promise<{ points: CurtailmentPoint[]; newFields: { viewstate: string; eventvalidation: string } }> {
  // Step 1: GET the page to obtain fresh VIEWSTATE/EVENTVALIDATION
  // On first call, sessionFields is null; on subsequent calls we reuse
  // the fields from the previous response (ASP.NET postback chain).
  let viewstate: string;
  let eventvalidation: string;

  if (!sessionFields) {
    const getHtml = await fetchText(NIGGRID_GEN_URL, {
      method: "GET",
      headers: { "User-Agent": "Mozilla/5.0" },
      timeoutMs: 15000,
      retries: 1,
    });
    const fields = extractAspnetFields(getHtml);
    viewstate = fields.viewstate;
    eventvalidation = fields.eventvalidation;
  } else {
    viewstate = sessionFields.viewstate;
    eventvalidation = sessionFields.eventvalidation;
  }

  // Step 2: POST with the date to get generation data
  const dateStr = toNiggridDate(date);
  const formBody = new URLSearchParams({
    __VIEWSTATE: viewstate,
    __VIEWSTATEGENERATOR: "823598FF",
    __EVENTVALIDATION: eventvalidation,
    "ctl00$MainContent$txtReadingDate": dateStr,
    "ctl00$MainContent$btnGetReadings": "Get Generation",
  }).toString();

  const postHtml = await fetchText(NIGGRID_GEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0",
      "Referer": NIGGRID_GEN_URL,
    },
    body: formBody,
    timeoutMs: 15000,
    retries: 1,
  });

  // Step 3: Extract new VIEWSTATE/EVENTVALIDATION for next request
  const newFields = extractAspnetFields(postHtml);

  // Step 4: Parse the generation table
  const hourlyTotals = parseNiggridGenerationTable(postHtml);

  // Step 5: Convert to curtailment points
  const points = hourlyTotalsToCurtailment(hourlyTotals, date);

  return { points, newFields: { viewstate: newFields.viewstate, eventvalidation: newFields.eventvalidation } };
}

/** Fetch niggrid solar curtailment for the last N days. */
async function fetchNiggridSolarCurtailment(days: number): Promise<CurtailmentPoint[]> {
  const allPoints: CurtailmentPoint[] = [];
  const now = new Date();
  let sessionFields: { viewstate: string; eventvalidation: string } | null = null;

  for (let offset = 0; offset < days; offset++) {
    const d = new Date(now.getTime() - offset * 24 * 3600 * 1000);
    try {
      const { points, newFields } = await fetchNiggridGenForDate(d, sessionFields);
      sessionFields = newFields; // Carry forward for ASP.NET postback chain
      allPoints.push(...points);
    } catch (err) {
      console.warn(`[nigeria] niggrid fetch failed for ${toNiggridDate(d)}: ${(err as Error).message}`);
      // Reset session fields on error — the viewstate may be stale
      sessionFields = null;
    }
  }

  return allPoints;
}

async function run({ probe = true } = {}): Promise<RegionData> {
  if (probe) {
    try {
      const points = await fetchNiggridSolarCurtailment(30);

      if (points.length === 0) {
        throw new Error("Niggrid API returned no generation data");
      }

      const lastTs = points[points.length - 1].utcTimestamp;
      const sourceNote =
        `Niggrid TCN live generation profile (niggrid.org, hourly GENCO data) ` +
        `× ${(SOLAR_CURTAILMENT_RATE * 100).toFixed(2)}% calibrated solar curtailment rate ` +
        `(TCN/Ember 2024 anchor ~0.05 TWh/yr Nigeria solar curtailment; ` +
        `shape proxy: total grid generation — Nigeria has negligible utility solar). ` +
        `${points.length} points across 30 days. Latest: ${lastTs}.`;

      const result: RegionData = {
        regionId: REGION_ID,
        profile: timeOfDayAverageGW(points),
        latestProfile: latestCompleteUtcDayProfileGW(points),
        totalTWh: totalTWh30d(points),
        peakGW: peakGW(points),
        lastUpdated: lastTs,
        lastSuccessAt: new Date().toISOString(),
        sourceNote,
      };

      // "anchored" tier: live grid shape × published curtailment anchor
      return applyUncertainty(result, { regionTier: "estimated" });
    } catch (err) {
      console.error(`[nigeria] Niggrid live fetch failed: ${(err as Error).message}`);
      // Fall through to fallback
    }
  }

  // Fallback: typical solar profile
  return buildTypicalSolarRegion(
    REGION_ID,
    12,    // peakHour UTC (Nigeria solar noon ~12 UTC = 13:00 WAT)
    0.05,  // annualTWh anchor — ~0.05 TWh/yr solar curtailment
    `Typical-shape fallback: Niggrid live feed unavailable (${probe ? "probe failed" : "test mode"}). ` +
    `Calibration anchor ~0.05 TWh/yr Nigeria solar curtailment (TCN/Ember 2024).`,
    "2024",
  );
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback(REGION_ID, () => run(), { regionTier: "estimated" })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("nigeria loader failed", err);
      process.exit(1);
    });
}

export const buildNigeriaData = () => run({ probe: false });
