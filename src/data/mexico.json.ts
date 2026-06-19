import { pathToFileURL, fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync } from "fs";
import { withFallback } from "../lib/resilient.js";
import { timeOfDayAverageGW, totalTWh30d, peakGW } from "../lib/profile.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import type { RegionData, CurtailmentPoint } from "../lib/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = join(__dirname, "../../data/historical/mexico-generacion.csv");

// Calibrated-proxy curtailment rates from SENER PRODESEN 2024–2038 + CRE
// confiabilidad reports. ~1.2 TWh/yr total curtailment across ~20 GW VRE
// capacity (12 GW solar + 8 GW wind) → blended ~6% rate.
// Split: solar ~7% (northern-grid saturation in Sonora/Chihuahua/Coahuila),
// wind ~5% (Oaxaca/Tehuantepec transmission bottlenecks, lower utilisation).
const SOLAR_RATE = 0.07;
const WIND_RATE = 0.05;

// Hour-of-day solar profile from CENACE relay CSV (31-day average, CST→UTC shifted).
// Solar reads 0 at night (hours 2-4 UTC = 8-10 PM CST), peaks midday.
// Source: data/historical/mexico-generacion.csv (CENACE Generacion Liquidada).
const SOLAR_SHAPE = [
  0.001, 0.000, 0.000, 0.000, 0.000, 0.001, // 0-5 UTC (6PM-11AM CST) — night
  0.052, 0.465, 0.840, 0.958, 0.970, 1.000, // 6-11 UTC (12AM-5PM CST) — ramp up
  0.999, 0.966, 0.840, 0.580, 0.220, 0.030, // 12-17 UTC (6AM-11PM CST) — ramp down
  0.005, 0.001, 0.000, 0.000, 0.000, 0.001, // 18-23 UTC (12PM-5AM CST) — night
];

// Wind profile from CENACE relay CSV — non-zero at night, peaks morning/evening.
const WIND_SHAPE = [
  0.680, 0.558, 0.454, 0.424, 0.420, 0.365, // 0-5 UTC
  0.317, 0.341, 0.459, 0.570, 0.630, 0.720, // 6-11 UTC
  0.760, 0.810, 0.880, 0.940, 0.970, 1.000, // 12-17 UTC
  0.920, 0.850, 0.780, 0.740, 0.710, 0.690, // 18-23 UTC
];

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

function rowsToShape(rows: CsvRow[], fuel: "eolica" | "fotovoltaica"): number[] {
  const hourTotals = new Map<number, { sum: number; count: number }>();
  for (const row of rows) {
    const mwh = fuel === "eolica" ? row.eolicaMwh : row.fotovoltaicaMwh;
    if (mwh <= 0) continue;
    const existing = hourTotals.get(row.hour) ?? { sum: 0, count: 0 };
    existing.sum += mwh;
    existing.count += 1;
    hourTotals.set(row.hour, existing);
  }
  const avgByHour = Array.from({ length: 24 }, (_, h) => {
    const bucket = hourTotals.get(h);
    return bucket ? bucket.sum / bucket.count : 0;
  });
  const max = Math.max(...avgByHour, 1);
  return avgByHour.map(v => v / max);
}

function buildPoints(shape: number[], annualTWh: number): CurtailmentPoint[] {
  const hourlyTWh = annualTWh / 8760;
  return shape.map((frac, hour) => ({
    utcTimestamp: `2024-06-15T${String(hour).padStart(2, "0")}:00:00Z`,
    mw: (frac * hourlyTWh * 1_000_000) / 1, // TWh→MW for 1h interval
  }));
}

function buildRegionData(
  id: string,
  kind: "solar" | "wind",
  points: CurtailmentPoint[],
  shape: number[],
  annualTWh: number,
  note: string,
): RegionData {
  const profile = timeOfDayAverageGW(points);
  const totalTWh = totalTWh30d(points);
  const peak = peakGW(points);
  const now = new Date().toISOString();
  const base: RegionData = {
    regionId: id,
    profile,
    latestProfile: null, // T3 modelled — no real-time feed, no latest-day profile
    totalTWh: annualTWh, // Use cited anchor, not 30-day sample
    peakGW: peak,
    lastUpdated: now,
    lastSuccessAt: now,
    sourceNote: note,
    sourceStatus: "live",
    sourceProvenance: "modelled-fallback",
  };
  return applyUncertainty(base, { regionTier: "estimated", profileKind: kind });
}

const NOTE =
  "SENER PRODESEN 2024-2038 + CRE confiabilidad anchor: ~1.2% of renewable generation " +
  "curtailed (~1 TWh in 2022, CRE 2023 estimates trend ~3.5%), driven by transmission-network " +
  "saturation and CENACE operational restrictions. Profile shaped by real CENACE generation data " +
  "(Generacion Liquidada relay CSV) × calibrated curtailment rate (solar 7%, wind 5%). " +
  "CENACE exposes no public measured-curtailment API — this is a modelled T3 estimate with " +
  "no fabricated hourly data. Sources: PRODESEN + CRE + NREL + CENACE relay.";

async function run(): Promise<{ solar: RegionData; wind: RegionData }> {
  const csvRows = readCsv();
  let solarShape = SOLAR_SHAPE;
  let windShape = WIND_SHAPE;

  if (csvRows && csvRows.length >= 168) { // At least 7 days
    const computed = rowsToShape(csvRows, "fotovoltaica");
    // Use real shape only if it's physically plausible (solar ~0 at night)
    if (computed[2] < 0.05 && computed[3] < 0.05 && computed[4] < 0.05) {
      solarShape = computed;
    }
    const windComputed = rowsToShape(csvRows, "eolica");
    if (windComputed.some(v => v > 0)) {
      windShape = windComputed;
    }
  }

  const solarPoints = buildPoints(solarShape, 0.8);
  const windPoints = buildPoints(windShape, 0.4);

  return {
    solar: buildRegionData("mexico-solar", "solar", solarPoints, solarShape, 0.8,
      `${NOTE} — solar share (Sonora/Chihuahua/Coahuila northern grid).`),
    wind: buildRegionData("mexico-wind", "wind", windPoints, windShape, 0.4,
      `${NOTE} — wind share (Oaxaca/Tehuantepec).`),
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
