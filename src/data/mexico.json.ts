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
// NOTE: the rate is applied at the ANNUAL-anchor level (it sizes the total
// energy, already baked into the 0.8/0.4 TWh/yr anchors below), not as a
// per-hour multiplier on the shape — a scalar rate on a shapeSum-normalized
// profile is mathematically a no-op, so it is intentionally not re-applied
// here. The profile below is the *shape* of that curtailed energy by hour.

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
  // Spread the annual anchor across the 24h typical-day shape, NORMALISED by
  // shapeSum so the rendered profile integrates to exactly the annual anchor.
  // (Sibling loaders do the same via scaleProfileToAnnualTWh.) Without this
  // normalisation the profile integrates to annual * mean(shape), which would
  // disagree with totalTWh.
  //
  // A zero-area shape is a degenerate input (e.g. an all-zero relay CSV row
  // that slipped past the plausibility gate). Throw — do NOT silently emit a
  // flat-zero profile that zeroes the region's totalTWh/peakGW. withFallback
  // then serves last-good, which is the correct behaviour (matches
  // scaleProfileToAnnualTWh, which throws on non-positive area).
  const dailyTWh = annualTWh / 365;
  const shapeSum = shape.reduce((sum, v) => sum + v, 0);
  if (shapeSum <= 0) {
    throw new Error("mexico buildPoints: shape has non-positive area; refusing to emit a zero-energy profile");
  }
  return shape.map((frac, hour) => ({
    utcTimestamp: `2024-06-15T${String(hour).padStart(2, "0")}:00:00Z`,
    // (frac/shapeSum) = share of the day's energy in this hour; * dailyTWh =
    // TWh; * 1e6 = MW for the 1h interval.
    mw: ((frac / shapeSum) * dailyTWh) * 1_000_000,
  }));
}

function buildRegionData(
  id: string,
  kind: "solar" | "wind",
  points: CurtailmentPoint[],
  annualTWh: number,
  note: string,
): RegionData {
  const profile = timeOfDayAverageGW(points);
  const peak = peakGW(points);
  const now = new Date().toISOString();
  // RegionData.totalTWh is the trailing-30-day cumulative (types.ts docs +
  // tooltip "30d total"). buildPoints emits one representative 24h day, so a
  // single day's total is totalTWh30d(points); scale to 30 days. Deriving it
  // from the points keeps it consistent with the rendered profile — after the
  // shapeSum normalisation above, totalTWh === annual * 30/365 and the curve
  // and the number agree.
  const totalTWh = totalTWh30d(points) * 30;
  // This is a T3-modelled region (no verified live upstream feed — the payload
  // is a typical-shape profile scaled to an anchor). Per CLAUDE.md rule 3 /
  // AGENTS.md data-contract boundaries it must NOT be stamped "live". The
  // withFallback pipeline also re-stamps it "cached" downstream, but
  // buildMexicoData() bypasses withFallback, so we set the truthful label at
  // the source rather than relying on the override to rescue a dishonest one.
  const base: RegionData = {
    regionId: id,
    profile,
    latestProfile: null, // T3 modelled — no real-time feed, no latest-day profile
    totalTWh,
    peakGW: peak,
    lastUpdated: now,
    lastSuccessAt: now,
    sourceNote: note,
    sourceStatus: "cached",
    sourceProvenance: "modelled-fallback",
  };
  return applyUncertainty(base, { regionTier: "estimated", profileKind: kind });
}

const NOTE =
  "SENER PRODESEN 2024-2038 + CRE confiabilidad anchor: ~1.2 TWh/yr total VRE curtailment " +
  "(~1 TWh in 2022; CRE 2023 notes an upward trend), driven by transmission-network " +
  "saturation and CENACE operational restrictions. Total energy scaled to the SENER/CRE " +
  "calibrated curtailment rate (solar ~7%, wind ~5%, ~6% blended across the ~20 GW VRE " +
  "fleet); the profile shape below is the real CENACE generation shape (Generacion " +
  "Liquidada relay CSV), not the rate applied per-hour. " +
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
    solar: buildRegionData("mexico-solar", "solar", solarPoints, 0.8,
      `${NOTE} — solar share (Sonora/Chihuahua/Coahuila northern grid).`),
    wind: buildRegionData("mexico-wind", "wind", windPoints, 0.4,
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

/** Exported for unit testing (shape normalization / degenerate-shape guard). */
export const buildMexicoPoints = buildPoints;
