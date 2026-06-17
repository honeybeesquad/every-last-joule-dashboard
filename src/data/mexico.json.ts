import { pathToFileURL, fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync } from "fs";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalSolarRegion, buildTypicalWindRegion } from "../lib/typical-profiles.js";
import { timeOfDayAverageGW, totalTWh30d, peakGW, latestCompleteUtcDayProfileGW } from "../lib/profile.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import { relayFreshness, RELAY_STALENESS_THRESHOLD_DAYS } from "../lib/freshness.js";
import type { RegionData, CurtailmentPoint } from "../lib/types.js";

const REGION_ID = "mexico";
const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = join(__dirname, "../../data/historical/mexico-generacion.csv");

// Calibrated-proxy curtailment rates from SENER PRODESEN 2024–2038 + CRE
// confiabilidad reports. ~1.2 TWh/yr total curtailment across ~20 GW VRE
// capacity (12 GW solar + 8 GW wind) → blended ~6% rate.
// Split: solar ~7% (northern-grid saturation in Sonora/Chihuahua/Coahuila),
// wind ~5% (Oaxaca/Tehuantepec transmission bottlenecks, lower utilisation).
const SOLAR_RATE = 0.07;
const WIND_RATE = 0.05;

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
    throw new Error("Mexico CSV missing required columns (date, hour, eolica_mwh, fotovoltaica_mwh)");
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

function readCsvRelay(csvPath = CSV_PATH): { rows: CsvRow[]; latestDate: string } | null {
  let text: string;
  try {
    text = readFileSync(csvPath, "utf-8");
  } catch {
    return null;
  }
  const rows = parseCsv(text);
  if (rows.length < 24) return null; // Need at least 1 day of hourly data
  rows.sort((a, b) => a.date.localeCompare(b.date) || a.hour - b.hour);
  return { rows, latestDate: rows[rows.length - 1]?.date ?? "unknown" };
}

/**
 * Convert daily generation CSV rows to CurtailmentPoint[] for a given fuel,
 * applying the calibration rate to estimate curtailment.
 * Groups by (date, hour), applies the rate, and builds hourly points.
 */
function rowsToPoints(rows: CsvRow[], fuel: "eolica" | "fotovoltaica", rate: number): CurtailmentPoint[] {
  // Group by (date, hour) and average across days for each hour-of-day
  const hourTotals = new Map<number, { sum: number; count: number }>();
  for (const row of rows) {
    const mwh = fuel === "eolica" ? row.eolicaMwh : row.fotovoltaicaMwh;
    if (mwh <= 0) continue;
    const existing = hourTotals.get(row.hour) ?? { sum: 0, count: 0 };
    existing.sum += mwh;
    existing.count += 1;
    hourTotals.set(row.hour, existing);
  }

  // Build average MWh per hour-of-day, then apply calibration rate to get curtailment MW
  const points: CurtailmentPoint[] = [];
  for (let h = 0; h < 24; h++) {
    const agg = hourTotals.get(h);
    if (!agg || agg.count === 0) continue;
    const avgMwh = agg.sum / agg.count;
    const curtailmentMw = avgMwh * rate; // MWh generation × rate = MW curtailed (1h interval)
    points.push({
      utcTimestamp: `2026-01-01T${String(h).padStart(2, "0")}:00:00.000Z`,
      mw: Math.max(0, curtailmentMw),
    });
  }
  return points;
}

/**
 * Build RegionData from CurtailmentPoint[].
 */
function pointsToRegionData(
  regionId: string,
  points: CurtailmentPoint[],
  sourceNote: string,
): RegionData {
  const last = points.at(-1)?.utcTimestamp ?? new Date().toISOString();
  return {
    regionId,
    profile: timeOfDayAverageGW(points),
    latestProfile: latestCompleteUtcDayProfileGW(points),
    totalTWh: totalTWh30d(points),
    peakGW: peakGW(points),
    lastUpdated: last,
    lastSuccessAt: last,
    sourceNote,
  };
}

async function run({
  probe = false,
  now = new Date(),
  csvPath = CSV_PATH,
}: { probe?: boolean; now?: Date; csvPath?: string } = {}): Promise<{ wind: RegionData; solar: RegionData }> {
  // Try CSV relay first
  const csv = readCsvRelay(csvPath);
  if (csv) {
    const windPoints = rowsToPoints(csv.rows, "eolica", WIND_RATE);
    const solarPoints = rowsToPoints(csv.rows, "fotovoltaica", SOLAR_RATE);

    if (windPoints.length === 0 && solarPoints.length === 0) {
      throw new Error("Mexico CSV relay had no valid wind/solar data points");
    }

    const windTotalMw = windPoints.reduce((s, p) => s + p.mw, 0);
    const solarTotalMw = solarPoints.reduce((s, p) => s + p.mw, 0);
    const denom = windTotalMw + solarTotalMw;
    const fuelShare = denom > 0
      ? { wind: windTotalMw / denom, solar: solarTotalMw / denom }
      : { wind: 0, solar: 1 };

    const windSourceNote = `CENACE Energía Generada Tipo Técnico CSV relay (${csv.rows.length}-hour window, latest: ${csv.latestDate}). Wind (eólica) × ${(WIND_RATE * 100).toFixed(0)}% modelled curtailment rate (PRODESEN anchor, no measured numerator). T3 estimated ±40%. See docs/validation/mexico-wind.md.`;
    const solarSourceNote = `CENACE Energía Generada Tipo Técnico CSV relay (${csv.rows.length}-hour window, latest: ${csv.latestDate}). Solar (fotovoltaica) × ${(SOLAR_RATE * 100).toFixed(0)}% modelled curtailment rate (PRODESEN anchor, no measured numerator). T3 estimated ±40%. See docs/validation/mexico-solar.md.`;

    const windData = applyUncertainty(
      pointsToRegionData("mexico-wind", windPoints, windSourceNote),
      { regionTier: "estimated" },
    );
    const solarData = applyUncertainty(
      pointsToRegionData("mexico-solar", solarPoints, solarSourceNote),
      { regionTier: "estimated" },
    );

    // Relay freshness self-stamp
    const status = relayFreshness(csv.latestDate, now, RELAY_STALENESS_THRESHOLD_DAYS);
    if (status === "degraded") {
      windData.sourceStatus = "degraded";
      solarData.sourceStatus = "degraded";
      windData.lastSuccessAt = csv.latestDate
        ? new Date(csv.latestDate).toISOString()
        : windData.lastSuccessAt;
      solarData.lastSuccessAt = csv.latestDate
        ? new Date(csv.latestDate).toISOString()
        : solarData.lastSuccessAt;
    }

    return { wind: windData, solar: solarData };
  }

  // T3 modelled fallback — no CSV available yet
  const windSourceNote = `SENER PRODESEN 2024–2038 anchor: ~1.2 TWh/yr total VRE curtailment; wind share estimated at ~0.4 TWh/yr from Oaxaca/Tehuantepec transmission bottlenecks. CENACE CSV relay not yet available — T3-modelled fallback. Gemini-3.1 research wave 2 (2026-04-30).`;
  const solarSourceNote = `SENER PRODESEN 2024–2038 anchor: ~1.2 TWh/yr total VRE curtailment; solar share estimated at ~0.8 TWh/yr from northern-grid saturation (Sonora/Chihuahua/Coahuila). CENACE CSV relay not yet available — T3-modelled fallback. Gemini-3.1 research wave 2 (2026-04-30).`;

  const windBase = buildTypicalWindRegion(
    "mexico-wind",
    18, // peak UTC hour for Oaxaca wind (18:00 UTC = noon local)
    0.4, // ~0.4 TWh/yr wind curtailment
    windSourceNote,
    "2024",
  );
  const solarBase = buildTypicalSolarRegion(
    "mexico-solar",
    19, // peak UTC hour for Sonora solar (19:00 UTC = noon local)
    0.8, // ~0.8 TWh/yr solar curtailment
    solarSourceNote,
    "2024",
  );

  return { wind: windBase, solar: solarBase };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<{ wind: RegionData; solar: RegionData }>(REGION_ID, () => run(), {
    regionTier: "estimated" as const,
    tagLive: (r) => r,
    tagCached: (c) => {
      // Adapt legacy single-region cache to per-fuel split
      if (c && typeof c === "object" && "wind" in c && "solar" in c) {
        return c as { wind: RegionData; solar: RegionData };
      }
      const old = c as unknown as RegionData;
      const windShare = old.fuelShare?.wind ?? 0.33;
      const solarShare = old.fuelShare?.solar ?? 0.67;
      return {
        wind: { ...old, regionId: "mexico-wind", totalTWh: (old.totalTWh ?? 0) * windShare, peakGW: (old.peakGW ?? 0) * windShare },
        solar: { ...old, regionId: "mexico-solar", totalTWh: (old.totalTWh ?? 0) * solarShare, peakGW: (old.peakGW ?? 0) * solarShare },
      };
    },
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("mexico loader failed", err);
      process.exit(1);
    });
}

export const buildMexicoData = () => run({ probe: false });

/** Test seam: run the Mexico loader with deterministic now and/or a fixture CSV path. */
export const runMexico = (opts: { probe?: boolean; now?: Date; csvPath?: string } = {}) =>
  run(opts);
