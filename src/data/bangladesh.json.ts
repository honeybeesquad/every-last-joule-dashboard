import { request as httpsRequest } from "node:https";
import { pathToFileURL } from "url";
import { withFallback } from "../lib/resilient.js";
import { timeOfDayAverageGW, totalTWh30d, peakGW, latestCompleteUtcDayProfileGW } from "../lib/profile.js";
import { buildTypicalSolarRegion } from "../lib/typical-profiles.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";

const REGION_ID = "bangladesh";
const GENERATION_URL = "https://erp.powergrid.gov.bd/web/generations/view_generations_bn";

/**
 * Bangladesh solar curtailment rate.
 * Anchor: ~0.04 TWh/yr (IRENA 2024, ~0.5% of ~8 TWh/yr solar generation).
 * Bangladesh has ~500 MW installed solar curtailed primarily at transmission level.
 */
const SOLAR_CURTAILMENT_RATE = 0.005;

interface PgcbHourlyRow {
  dateStr: string;
  time: string;
  solarMw: number;
  windMw: number;
}

/**
 * Bengali numeral map: ০১২৩৪৫৬৭৮৯ = 0123456789
 */
function bengaliToInt(s: string): number {
  const map: Record<string, string> = {
    "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4",
    "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9",
  };
  return parseInt(s.trim().replace(/[০১২৩৪৫৬৭৮৯]/g, (c) => map[c] ?? c).replace(/[^0-9]/g, ""), 10) || 0;
}

function bengaliDateToIso(dateStr: string, timeStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length !== 3) return "";
  const day = bengaliToInt(parts[0]);
  const month = bengaliToInt(parts[1]);
  const year = bengaliToInt(parts[2]);
  if (!day || !month || !year) return "";

  const timeParts = timeStr.split(":");
  const hour = bengaliToInt(timeParts[0] || "0");
  const min = bengaliToInt(timeParts[1] || "0");

  // Bangladesh is UTC+6
  const utcHour = hour - 6;
  const d = new Date(Date.UTC(year, month - 1, day, utcHour < 0 ? utcHour + 24 : utcHour, min));
  return d.toISOString();
}

/** Simple https fetch that accepts invalid TLS certs. */
async function httpsFetchText(url: string, timeoutMs = 15000): Promise<string> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = {
      hostname: u.hostname,
      port: 443,
      path: u.pathname + u.search,
      method: "GET",
      headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36" },
      rejectUnauthorized: false,
      timeout: timeoutMs,
    };
    const req = httpsRequest(opts, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
      res.on("error", reject);
    });
    req.on("timeout", () => { req.destroy(); reject(new Error(`timeout after ${timeoutMs}ms`)); });
    req.on("error", reject);
    req.end();
  });
}

function parsePgcbHtml(html: string): PgcbHourlyRow[] {
  const rows: PgcbHourlyRow[] = [];
  const tableMatch = html.match(/<table[^>]*>[\s\S]*?<\/table>/i);
  if (!tableMatch) return rows;

  const tableHtml = tableMatch[0];
  const rowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    const cells: string[] = [];
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(rowMatch[0])) !== null) {
      cells.push(cellMatch[1].trim());
    }

    if (cells.length < 9) continue;
    if (cells[0] === "তারিখ" || cells[0].includes("তারিখ")) continue;

    const solarMw = bengaliToInt(cells[7]);
    const windMw = bengaliToInt(cells[8]);
    if (solarMw === 0 && windMw === 0) continue;

    rows.push({ dateStr: cells[0], time: cells[1], solarMw, windMw });
  }

  return rows;
}

function toCurtailmentPoints(rows: PgcbHourlyRow[]): CurtailmentPoint[] {
  const points: CurtailmentPoint[] = [];
  for (const row of rows) {
    const utcTs = bengaliDateToIso(row.dateStr, row.time);
    if (!utcTs) continue;
    const mw = row.solarMw * SOLAR_CURTAILMENT_RATE;
    if (mw > 0) points.push({ utcTimestamp: utcTs, mw });
  }
  return points;
}

async function run({ probe = true } = {}): Promise<RegionData> {
  if (probe) {
    try {
      const html = await httpsFetchText(GENERATION_URL);
      const rows = parsePgcbHtml(html);
      if (rows.length === 0) throw new Error("PGCB HTML returned no parseable rows");

      const points = toCurtailmentPoints(rows);
      if (points.length === 0) throw new Error("PGCB no solar generation data in parsed rows");

      const lastTs = points[points.length - 1].utcTimestamp;
      const sourceNote =
        `PGCB Bangladesh hourly generation dashboard (erp.powergrid.gov.bd) ` +
        `× ${(SOLAR_CURTAILMENT_RATE * 100).toFixed(1)}% calibrated solar curtailment rate ` +
        `(IRENA 2024 anchor ~0.04 TWh/yr). ` +
        `${points.length} hourly points. Latest: ${lastTs}. ` +
        `Solar generation is published hourly (not curtailment — curtailment is modelled rate).`;

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

  return buildTypicalSolarRegion(
    REGION_ID,
    5,
    0.04,
    `Typical-shape fallback: PGCB live feed unavailable${probe ? " (probe failed or no solar data)" : " (test mode)"}. ` +
    `Calibration anchor ~0.04 TWh/yr solar curtailment (IRENA 2024).`,
    "2025",
  );
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback(REGION_ID, () => run(), { regionTier: "estimated" })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => { console.error("bangladesh loader failed", err); process.exit(1); });
}

export const buildBangladeshData = () => run({ probe: false });
