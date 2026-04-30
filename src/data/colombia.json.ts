import { pathToFileURL, fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync } from "fs";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalHydroSeasonalRegion, HYDRO_SEASONAL_SHARES } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "colombia";
// Resolve from the loader file's location so the path works both in the
// Observable Framework build context and when invoked directly as a script.
const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = join(__dirname, "../../data/historical/colombia-vertimientos-daily.csv");

interface CsvRow { date: string; gwh: number; }

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

async function run(): Promise<RegionData> {
  const raw = readFileSync(CSV_PATH, "utf-8");
  const rows = parseCSV(raw);

  // Sort ascending so we can slice the tail.
  rows.sort((a, b) => a.date.localeCompare(b.date));

  // Trailing-365-day annualised figure.  Scales proportionally if the window
  // is shorter (e.g. fresh bootstrap with <365 rows).
  const tail = rows.slice(-365);
  const sumGwh = tail.reduce((s, r) => s + r.gwh, 0);
  const annualTWh = (sumGwh * (365 / tail.length)) / 1000;

  const latestDate = rows[rows.length - 1]?.date ?? "unknown";

  return buildTypicalHydroSeasonalRegion(
    REGION_ID,
    annualTWh,
    HYDRO_SEASONAL_SHARES.colombia,
    `XM SinerGox API via Britta daily relay (servapibi.xm.com.co/daily, MetricId=VertEner, Entity=Sistema). ` +
    `Trailing-365-day mean from ${rows.length}-day committed CSV (latest record: ${latestDate}). ` +
    `5-yr baseline 7.53 TWh/yr (range 0.53–13.12 TWh/yr ENSO-driven). ` +
    `Bimodal Colombian hydro-seasonal shape (Apr–Jun + Oct–Nov peaks). T1b-CSV, ±30% envelope.`,
    "2026",
  );
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback(REGION_ID, () => run())
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("colombia loader failed", err);
      process.exit(1);
    });
}

export const buildColombiaData = () => run();
