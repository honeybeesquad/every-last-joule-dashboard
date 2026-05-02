import { pathToFileURL, fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync } from "fs";
import { fetchJSON } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalHydroSeasonalRegion, HYDRO_SEASONAL_SHARES } from "../lib/typical-profiles.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "colombia";
const XM_API_URL = "https://servapibi.xm.com.co/daily";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = join(__dirname, "../../data/historical/colombia-vertimientos-daily.csv");

interface CsvRow { date: string; gwh: number; }

// XM SinerGox API response shape for Entity=Sistema daily metrics.
interface XmDailyItem { Date: string; Values: Record<string, number>; }
interface XmResponse { Items?: XmDailyItem[]; }

function parseCSV(text: string): CsvRow[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const header = lines[0].split(",");
  const dateIdx = header.indexOf("date");
  const gwhIdx  = header.indexOf("gwh");
  if (dateIdx < 0 || gwhIdx < 0) throw new Error("Colombia CSV missing date/gwh columns");
  return lines.slice(1)
    .map(line => {
      const cols = line.split(",");
      return { date: cols[dateIdx].trim(), gwh: parseFloat(cols[gwhIdx]) };
    })
    .filter(r => !isNaN(r.gwh) && r.gwh >= 0);
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function fetchXmLast365Days(): Promise<{ annualTWh: number; latestDate: string; nDays: number }> {
  const end = new Date();
  const start = new Date(end.getTime() - 365 * 24 * 3600 * 1000);
  const body = JSON.stringify({
    MetricId: "VertEner",
    StartDate: isoDate(start),
    EndDate: isoDate(end),
    Entity: "Sistema",
  });
  const resp = await fetchJSON<XmResponse>(XM_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    timeoutMs: 15000,
    retries: 1,
  });
  const items = resp?.Items ?? [];
  const rows: CsvRow[] = items
    .map(it => ({ date: it.Date?.slice(0, 10) ?? "", gwh: it.Values?.["Sistema"] ?? NaN }))
    .filter(r => r.date && !isNaN(r.gwh) && r.gwh >= 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (rows.length === 0) throw new Error("XM API returned no valid VertEner rows");
  const sumGwh = rows.reduce((s, r) => s + r.gwh, 0);
  const annualTWh = (sumGwh * (365 / rows.length)) / 1000;
  return { annualTWh, latestDate: rows[rows.length - 1].date, nDays: rows.length };
}

function readCsvRelay(): { annualTWh: number; latestDate: string; nRows: number } {
  const raw = readFileSync(CSV_PATH, "utf-8");
  const rows = parseCSV(raw);
  rows.sort((a, b) => a.date.localeCompare(b.date));
  const tail = rows.slice(-365);
  const sumGwh = tail.reduce((s, r) => s + r.gwh, 0);
  const annualTWh = (sumGwh * (365 / tail.length)) / 1000;
  return { annualTWh, latestDate: rows[rows.length - 1]?.date ?? "unknown", nRows: rows.length };
}

async function run({ probe = true } = {}): Promise<RegionData> {
  let annualTWh: number;
  let sourceDetail: string;

  if (probe) {
    try {
      // Primary: XM SinerGox live API. Geoblocked outside Colombia; will fail
      // from Vercel/CI build environments and fall through to the CSV relay.
      const live = await fetchXmLast365Days();
      annualTWh = live.annualTWh;
      sourceDetail = `XM SinerGox API live (${live.nDays} days, latest: ${live.latestDate})`;
    } catch (liveErr) {
      console.error(`[colombia] XM live fetch failed (${(liveErr as Error).message}); falling back to CSV relay`);
      // Secondary: committed CSV updated by Britta cron at 18:30 UTC.
      const csv = readCsvRelay();
      annualTWh = csv.annualTWh;
      sourceDetail = `CSV relay fallback (${csv.nRows}-day committed CSV, latest: ${csv.latestDate})`;
    }
  } else {
    // Test path: skip live API, read CSV directly for deterministic results.
    const csv = readCsvRelay();
    annualTWh = csv.annualTWh;
    sourceDetail = `CSV relay (${csv.nRows}-day committed CSV, latest: ${csv.latestDate})`;
  }

  const base = buildTypicalHydroSeasonalRegion(
    REGION_ID,
    annualTWh,
    HYDRO_SEASONAL_SHARES.colombia,
    `XM SinerGox API (servapibi.xm.com.co/daily, MetricId=VertEner, Entity=Sistema). ` +
    `${sourceDetail}. ` +
    `5-yr baseline 7.53 TWh/yr (range 0.53–13.12 TWh/yr ENSO-driven). ` +
    `Bimodal Colombian hydro-seasonal shape (Apr–Jun + Oct–Nov peaks). T1b, ±50% envelope.`,
    "2026",
  );
  // Override T3-modelled → T1b: this loader is set up as a direct live source
  // (XM API primary, CSV relay fallback) rather than a purely static model.
  return applyUncertainty(base, { regionTier: "live-domestic-anchored" });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback(REGION_ID, () => run(), { regionTier: "live-domestic-anchored" })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("colombia loader failed", err);
      process.exit(1);
    });
}

export const buildColombiaData = () => run({ probe: false });
