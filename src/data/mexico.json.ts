import { pathToFileURL, fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync } from "fs";
import { withFallback } from "../lib/resilient.js";
import { timeOfDayAverageGW, totalTWh30d } from "../lib/profile.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import type { RegionData, CurtailmentPoint } from "../lib/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = join(__dirname, "../../data/historical/mexico-generacion.csv");

interface CsvRow {
  date: string;
  hour: number;
  eolicaMwh: number;
  fotovoltaicaMwh: number;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const header = lines[0].split(",");
  const dateIdx = header.indexOf("date");
  const hourIdx = header.indexOf("hour");
  const eolicaIdx = header.indexOf("eolica_mwh");
  const solarIdx = header.indexOf("fotovoltaica_mwh");
  if (dateIdx < 0 || hourIdx < 0 || eolicaIdx < 0 || solarIdx < 0) {
    throw new Error("Mexico CSV missing required columns");
  }
  return lines.slice(1)
    .map(line => {
      const cols = line.split(",");
      return {
        date: cols[dateIdx]?.trim() ?? "",
        hour: parseInt(cols[hourIdx] ?? "0", 10),
        eolicaMwh: parseFloat(cols[eolicaIdx] ?? "0") || 0,
        fotovoltaicaMwh: parseFloat(cols[solarIdx] ?? "0") || 0,
      };
    })
    .filter(r => r.date.length > 0 && Number.isFinite(r.hour) && r.hour >= 0 && r.hour <= 23);
}

function readCsv(): CsvRow[] | null {
  let text: string;
  try {
    text = readFileSync(CSV_PATH, "utf-8");
  } catch {
    return null;
  }
  const rows = parseCsv(text);
  if (rows.length < 24) return null;
  return rows;
}

function buildPoints(shape: number[], annualTWh: number): CurtailmentPoint[] {
  // Exported for the degenerate-shape unit test. A zero-area shape must throw
  // rather than emit a silent zero-energy profile.
  const dailyTWh = annualTWh / 365;
  const shapeSum = shape.reduce((sum, v) => sum + v, 0);
  if (shapeSum <= 0) {
    throw new Error("mexico buildPoints: shape has non-positive area; refusing to emit a zero-energy profile");
  }
  return shape.map((frac, hour) => ({
    utcTimestamp: `2024-06-15T${String(hour).padStart(2, "0")}:00:00Z`,
    mw: ((frac / shapeSum) * dailyTWh) * 1_000_000,
  }));
}

const NOTE =
  "CENACE Generación Liquidada (relay CSV: eolica_mwh / fotovoltaica_mwh). " +
  "Generation is measured. Waste unpublished — CRE/CENACE publish no curtailment column. " +
  "Not T1a. Missing waste ≠ zero.";

function rowsToGenPoints(rows: CsvRow[], fuel: "eolica" | "fotovoltaica"): CurtailmentPoint[] {
  return rows
    .map((row) => ({
      utcTimestamp: `${row.date}T${String(row.hour).padStart(2, "0")}:00:00Z`,
      mw: Math.max(0, fuel === "eolica" ? row.eolicaMwh : row.fotovoltaicaMwh),
    }))
    .filter((p) => Number.isFinite(p.mw));
}

function buildUnpublishedGeneration(
  id: string,
  kind: "solar" | "wind",
  points: CurtailmentPoint[],
  note: string,
): RegionData {
  if (points.length < 24) {
    throw new Error(`mexico ${id}: fewer than 24 generation points`);
  }
  const last = points.at(-1)?.utcTimestamp ?? new Date().toISOString();
  const base: RegionData = {
    regionId: id,
    profile: Array(24).fill(0),
    latestProfile: null,
    totalTWh: 0,
    peakGW: 0,
    lastUpdated: last,
    lastSuccessAt: last,
    sourceNote: note,
    sourceStatus: "cached",
    sourceProvenance: "official-lead",
    wasteStatus: "unpublished",
    generationProfile: timeOfDayAverageGW(points),
    generationTotalTWh: totalTWh30d(points),
  };
  return applyUncertainty(base, { regionTier: "estimated", profileKind: kind });
}

async function run(): Promise<{ solar: RegionData; wind: RegionData }> {
  const csvRows = readCsv();
  if (!csvRows || csvRows.length < 24) {
    throw new Error("Mexico CENACE relay CSV missing or too short");
  }
  const solarPoints = rowsToGenPoints(csvRows, "fotovoltaica");
  const windPoints = rowsToGenPoints(csvRows, "eolica");
  return {
    solar: buildUnpublishedGeneration("mexico-solar", "solar", solarPoints, `${NOTE} — solar (Sonora/Chihuahua/Coahuila).`),
    wind: buildUnpublishedGeneration("mexico-wind", "wind", windPoints, `${NOTE} — wind (Oaxaca/Tehuantepec).`),
  };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<{ solar: RegionData; wind: RegionData }>("mexico", () => run(), {
    regionTier: "estimated" as const,
    tagLive: (r) => r,
    tagCached: (c) => c as { solar: RegionData; wind: RegionData },
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("mexico loader failed", err);
      process.exit(1);
    });
}

export const buildMexicoData = () => run();

/** Exported for unit testing (shape normalization / degenerate-shape guard). */
export const buildMexicoPoints = buildPoints;
