import { readFileSync } from "fs";
import { join } from "path";
import { pathToFileURL } from "url";
import { request as httpsRequest } from "node:https";
import { withFallback } from "../lib/resilient.js";
import { timeOfDayAverageGW, totalTWh30d, peakGW, latestCompleteUtcDayProfileGW } from "../lib/profile.js";
import { buildTypicalSolarRegion } from "../lib/typical-profiles.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";

const REGION_ID = "bangladesh";
const GENERATION_URL = "https://erp.powergrid.gov.bd/web/generations/view_generations_bn";

/**
 * Bangladesh solar curtailment rate.
 * Anchor: ~0.04 TWh/yr (IRENA 2024, ~0.5% of ~8 TWh/yr solar generation estimate).
 * Bangladesh has ~500 MW installed solar curtailed primarily at the transmission level.
 * The PGCB dashboard publishes hourly generation by fuel type (MW), not curtailment.
 * The curtailment is a 0.5% calibration rate applied to generation, producing
 * single-digit-MW curtailment peaks consistent with the ~0.04 TWh/yr anchor.
 *
 * Solarman forerunner.
 */
const SOLAR_CURTAILMENT_RATE = 0.005;

/** Column indices in the PGCB generation table.
 *
 *  Verified from live HTML (2026-06-22):
 *    0 = date (তারিখ)
 *    1 = time (সময়)
 *    2 = total (উৎপাদন(মেঃওঃ))
 *    3 = deficit (ঘাটতি)
 *    4 = load shed (লোডশেড)
 *    5 = gas (গ্যাস)
 *    6 = liquid fuel (তরল জ্বালানী)
 *    7 = coal (কয়লা)
 *    8 = hydro (হাইড্রো)
 *    9 = solar (সৌর)
 *   10 = wind (বায়ু)
 *   11 = India import (ভারত)
 *   12 = Nepal (নেপাল)
 *   13 = notes (মন্তব্য)
 *  (rows also carry 3 sub-columns for Bheramara/Tripura/Adani at 14–16)
 */
const COL_DATE = 0;
const COL_TIME = 1;
const COL_SOLAR = 9;
const COL_WIND = 10;

/** Bengali numeral → decimal integer. */
function bengaliToInt(s: string): number {
  const map: Record<string, string> = {
    "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4",
    "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9",
  };
  return parseInt(s.trim().replace(/[০১২৩৪৫৬৭৮৯]/g, (c) => map[c] ?? c).replace(/[^0-9.-]/g, ""), 10) || 0;
}

/** Parse Bengali date + time (UTC+6 Bangladesh) → ISO 8601 UTC. */
function bengaliDateTimeToIso(dateStr: string, timeStr: string): string {
  const dateParts = dateStr.split("-");
  if (dateParts.length !== 3) return "";
  const day = bengaliToInt(dateParts[0]);
  const month = bengaliToInt(dateParts[1]);
  const year = bengaliToInt(dateParts[2]);
  if (!day || !month || !year) return "";

  const timeParts = timeStr.split(":");
  const hour = bengaliToInt(timeParts[0] || "0");
  const min = bengaliToInt(timeParts[1] || "0");

  // Bangladesh Standard Time = UTC+6
  const utcHour = hour - 6;
  const d = new Date(Date.UTC(year, month - 1, day, utcHour < 0 ? utcHour + 24 : utcHour, min));
  return d.toISOString();
}

/** Fetch PGCB HTML via https with TLS cert bypass (self-signed cert on the server). */
async function httpsFetchText(url: string, timeoutMs = 15000): Promise<string> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = {
      hostname: u.hostname,
      port: 443,
      path: u.pathname + u.search,
      method: "GET",
      headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36" },
      rejectUnauthorized: false,  // PGCB uses a self-signed SSL certificate
      timeout: timeoutMs,
    };
    const req = httpsRequest(opts, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
      res.on("error", reject);
    });
    req.on("timeout", () => { req.destroy(new Error(`timeout after ${timeoutMs}ms`)); });
    req.on("error", reject);
    req.end();
  });
}

/** Parse hourly solar/wind generation from PGCB HTML table. Returns curtailment points. */
function parseAndCurtail(html: string): CurtailmentPoint[] {
  const points: CurtailmentPoint[] = [];

  // Find the hourly generation table
  const tableMatch = html.match(/<table[^>]*class="table-bordered"[^>]*>[^]*?<\/table>/i);
  if (!tableMatch) return points;

  const tableHtml = tableMatch[0];
  const rowRegex = /<tr[^>]*>([^]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
    const cellRegex = /<t[dh][^>]*>([^]*?)<\/t[dh]>/gi;
    const cells: string[] = [];
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
      const clean = cellMatch[1].replace(/<[^>]+>/g, "").trim();
      cells.push(clean);
    }

    // Skip header and sub-header rows
    if (cells.length < 11) continue;
    if (cells[0] === "তারিখ" || cells[0].includes("তারিখ")) continue;
    if (cells[COL_DATE].includes("ভেড়ামারা")) continue;  // sub-header

    const dateStr = cells[COL_DATE];
    const timeStr = cells[COL_TIME];
    const utcTs = bengaliDateTimeToIso(dateStr, timeStr);
    if (!utcTs) continue;

    // Solar generation (MW)
    const solarMw = bengaliToInt(cells[COL_SOLAR]);
    // Wind generation (MW) — kept for potential future wind region
    // const windMw = bengaliToInt(cells[COL_WIND]);

    // Solar curtailment = solar generation × rate
    const solarCurtMw = solarMw * SOLAR_CURTAILMENT_RATE;
    if (solarCurtMw > 0) {
      points.push({ utcTimestamp: utcTs, mw: solarCurtMw });
    }
  }

  return points;
}

async function run({ probe = true } = {}): Promise<RegionData> {
  if (probe) {
    try {
      const html = await httpsFetchText(GENERATION_URL);
      const points = parseAndCurtail(html);

      if (points.length === 0) {
        throw new Error("PGCB HTML returned no solar data (all zeros or parse failure)");
      }

      const lastTs = points[points.length - 1].utcTimestamp;
      const sourceNote =
        `PGCB Bangladesh hourly generation dashboard (erp.powergrid.gov.bd) ` +
        `× ${(SOLAR_CURTAILMENT_RATE * 100).toFixed(1)}% calibrated solar curtailment rate ` +
        `(IRENA 2024 anchor ~0.04 TWh/yr). ` +
        `${points.length} hourly points. Latest: ${lastTs}. ` +
        `Solar generation is published hourly (not curtailment — curtailment is modelled rate at 0.5%).`;

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

      return applyUncertainty(result, { regionTier: "estimated" });
    } catch (err) {
      console.error(`[bangladesh] PGCB fetch failed: ${(err as Error).message}`);
    }
  }

  // Fallback: typical solar profile
  return buildTypicalSolarRegion(
    REGION_ID,
    5,     // peakHour UTC (Bangladesh solar noon ~11am local = 5 UTC)
    0.04,  // annualTWh anchor (IRENA 2024)
    `Typical-shape fallback: PGCB live feed unavailable${probe ? " (probe failed or no solar data)" : " (test mode)"}. ` +
    `Calibration anchor ~0.04 TWh/yr solar curtailment (IRENA 2024).`,
    "2025",
  );
}

// ─── Exported for tests ──────────────────────────────────────────────────

/** Parse PGCB HTML from a local file (test fixture). */
export function parsePgcbFixture(htmlPath: string): CurtailmentPoint[] {
  const html = readFileSync(htmlPath, "utf-8");
  return parseAndCurtail(html);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback(REGION_ID, () => run(), { regionTier: "estimated" })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => { console.error("bangladesh loader failed", err); process.exit(1); });
}

export const buildBangladeshData = () => run({ probe: false });
