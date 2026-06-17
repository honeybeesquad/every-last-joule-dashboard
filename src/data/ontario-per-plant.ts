/**
 * IESO Ontario per-plant curtailment loader.
 *
 * Fetches the IESO GenOutputCapabilityMonth CSV from
 * https://reports-public.ieso.ca/public/GenOutputCapabilityMonth/ which
 * contains hourly Available Capacity and Output for every generator in
 * Ontario, broken down by plant and fuel type.
 *
 * For each WIND or SOLAR plant, curtailment is computed as:
 *   curtailment = max(0, Available Capacity − Output)
 * per hour. For solar, curtailment is clamped to 0 during hours where
 * Output = 0 (nighttime), since Available Capacity is reported as the
 * nameplate rating even when no sun is available.
 *
 * Only plants with meaningful trailing-30-day curtailment (>0.01 TWh)
 * are included. Each qualifying plant becomes its own RegionData entry
 * keyed by `ieso-<plant-id>-<fuel>`.
 *
 * Coordinates sourced from Wikipedia / IESO public records (22 plants
 * verified). Plants without verified coords fall back to Ontario centroid.
 */

import { pathToFileURL } from "node:url";
import { fetchText } from "../lib/fetch.js";
import { hourlyAverage } from "../lib/csv.js";
import {
  latestCompleteUtcDayProfileGW,
  peakGW,
  timeOfDayAverageGW,
  totalTWh30d,
} from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";
import { ONTARIO_PLANT_COORDS } from "./ontario-plant-coords.js";

// ─── Constants ───────────────────────────────────────────────────────────────

const IESO_MONTHLY_BASE =
  "https://reports-public.ieso.ca/public/GenOutputCapabilityMonth";

const MIN_TWH_30D = 0.01;

// Ontario centroid for fallback (central Ontario, near Kawarthas)
const ONTARIO_CENTROID = { lat: 44.0, lon: -80.5 };

type OntarioFuel = "WIND" | "SOLAR";

// ─── Timezone helpers ────────────────────────────────────────────────────────

/**
 * Ontario is EDT (UTC-4) from 2nd Sunday in March to 1st Sunday in November,
 * EST (UTC-5) the rest of the year. This function returns the UTC offset
 * for a given date string (YYYY-MM-DD).
 */
function ontarioUtcOffset(dateStr: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);

  // Second Sunday in March
  const mar1 = new Date(Date.UTC(year, 2, 1));
  const mar1Dow = mar1.getUTCDay(); // 0=Sun
  const secondSunMar = mar1Dow === 0 ? 8 : 14 - mar1Dow + 1;
  const edtStart = Date.UTC(year, 2, secondSunMar, 7, 0, 0); // 2 AM EST = 7 AM UTC

  // First Sunday in November
  const nov1 = new Date(Date.UTC(year, 10, 1));
  const nov1Dow = nov1.getUTCDay();
  const firstSunNov = nov1Dow === 0 ? 1 : 7 - nov1Dow + 1;
  const edtEnd = Date.UTC(year, 10, firstSunNov, 6, 0, 0); // 2 AM EDT = 6 AM UTC

  const ts = Date.UTC(year, month - 1, day, 12, 0, 0);
  return ts >= edtStart && ts < edtEnd ? -4 : -5;
}

// ─── CSV parser ──────────────────────────────────────────────────────────────

interface PlantMeasurement {
  date: string; // YYYY-MM-DD
  generator: string;
  fuelType: OntarioFuel;
  measurement: "Available Capacity" | "Output";
  hours: number[]; // Hour 1..24 values
}

/**
 * Parse IESO GenOutputCapabilityMonth CSV.
 *
 * CSV structure:
 *   Line 1-3: header comments (start with \\)
 *   Line 4: column headers
 *   Line 5+: data rows with columns:
 *     Delivery Date, Generator, Fuel Type, Measurement,
 *     Hour 1, Hour 2, ..., Hour 24
 *
 * Measurement types include "Available Capacity", "Output", and "Forecast".
 * We only use "Available Capacity" and "Output" for wind/solar plants.
 */
function parseIesoMonthlyCsv(csv: string): PlantMeasurement[] {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/);
  const results: PlantMeasurement[] = [];

  for (const line of lines) {
    // Skip empty lines, header comments, and column header row
    if (!line.trim() || line.startsWith("\\")) continue;
    if (line.startsWith("Delivery Date")) continue;

    const cells = line.split(",");
    if (cells.length < 28) continue; // need at least 28 columns

    const date = cells[0].trim();
    const generator = cells[1].trim();
    const fuelType = cells[2].trim().toUpperCase();
    const measurement = cells[3].trim();

    if (fuelType !== "WIND" && fuelType !== "SOLAR") continue;
    if (measurement !== "Available Capacity" && measurement !== "Output") continue;

    // Parse Hours 1-24 (columns 4-27)
    const hours: number[] = [];
    for (let i = 4; i < 28; i++) {
      const val = parseFloat(cells[i]);
      hours.push(Number.isFinite(val) ? val : 0);
    }

    results.push({
      date,
      generator,
      fuelType: fuelType as OntarioFuel,
      measurement: measurement as "Available Capacity" | "Output",
      hours,
    });
  }

  return results;
}

// ─── Per-plant curtailment computation ───────────────────────────────────────

interface PlantAccumulator {
  points: CurtailmentPoint[];
  fuel: OntarioFuel;
  generator: string;
}

/**
 * Group parsed measurements by generator and compute curtailment points.
 *
 * For each generator on each date, pairs the "Available Capacity" and
 * "Output" rows and computes:
 *   curtailment_mw = max(0, available_capacity - output)
 *
 * For solar, curtailment is clamped to 0 when Output = 0 (nighttime),
 * since Available Capacity is the nameplate rating, not the
 * solar-constrained potential.
 *
 * Local Ontario hours are converted to UTC using the EDT/EST offset
 * for the date.
 */
function computePerPlantCurtailment(
  measurements: PlantMeasurement[],
): Map<string, PlantAccumulator> {
  // Index: "date|generator|measurement" → PlantMeasurement
  const lookup = new Map<string, PlantMeasurement>();
  for (const m of measurements) {
    lookup.set(`${m.date}|${m.generator}|${m.measurement}`, m);
  }

  // Collect unique (date, generator) pairs
  const pairs = new Map<string, { date: string; generator: string; fuel: OntarioFuel }>();
  for (const m of measurements) {
    const key = `${m.date}|${m.generator}`;
    if (!pairs.has(key)) {
      pairs.set(key, { date: m.date, generator: m.generator, fuel: m.fuelType });
    }
  }

  const plantMap = new Map<string, PlantAccumulator>();

  for (const { date, generator, fuel } of pairs.values()) {
    const cap = lookup.get(`${date}|${generator}|Available Capacity`);
    const out = lookup.get(`${date}|${generator}|Output`);
    if (!cap || !out) continue;

    const utcOffset = ontarioUtcOffset(date);
    const plantId = slugify(generator, fuel);

    let acc = plantMap.get(plantId);
    if (!acc) {
      acc = { points: [], fuel, generator };
      plantMap.set(plantId, acc);
    }

    for (let hourIdx = 0; hourIdx < 24; hourIdx++) {
      const localHour = hourIdx + 1; // Hour 1..24
      const outputMw = out.hours[hourIdx];
      const capMw = cap.hours[hourIdx];

      // Skip if capacity is 0 (plant offline / maintenance)
      if (capMw <= 0) continue;

      let curtailmentMw = Math.max(0, capMw - outputMw);

      // Solar: clamp to 0 at night (Output = 0 means no sun, not curtailment)
      // NOTE: fuel is uppercase "SOLAR"/"WIND" from the CSV parser
      if (fuel === "SOLAR" && outputMw <= 0) {
        curtailmentMw = 0;
      }

      // Convert local hour to UTC.
      // localHour 1 = 1:00 AM local time (0-based index 0).
      // UTC = local - utcOffset (e.g. EDT: UTC = local + 4).
      const localHourStart = localHour - 1; // 0-based local hour
      const totalUtcHours = localHourStart - utcOffset;
      const [year, month, day] = date.split("-").map(Number);
      const utcDate = new Date(Date.UTC(year, month - 1, day, totalUtcHours));
      const utcTimestamp = utcDate.toISOString();

      if (curtailmentMw > 0) {
        acc.points.push({ utcTimestamp, mw: curtailmentMw });
      }
    }
  }

  // Sort points by timestamp for each plant
  for (const acc of plantMap.values()) {
    acc.points.sort((a, b) => a.utcTimestamp.localeCompare(b.utcTimestamp));
  }

  return plantMap;
}

// ─── Plant ID slugification ──────────────────────────────────────────────────

function slugify(generator: string, fuel: OntarioFuel): string {
  const slug = generator
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `ieso-${slug}-${fuel}`;
}

// ─── RegionData builder ──────────────────────────────────────────────────────

export interface PerPlantRegionData extends RegionData {
  lat: number;
  lon: number;
  generator: string;
  fuel: OntarioFuel;
}

function buildPerPlantRegion(
  plantId: string,
  acc: PlantAccumulator,
): PerPlantRegionData | null {
  const totalTWh = totalTWh30d(acc.points);
  if (totalTWh < MIN_TWH_30D) return null;

  const opennemCoords = ONTARIO_PLANT_COORDS[plantId];
  const coords = opennemCoords ?? ONTARIO_CENTROID;
  const hourlyPoints = hourlyAverage(acc.points);
  const latestProfile = latestCompleteUtcDayProfileGW(acc.points);
  const coordSource = opennemCoords ? "Wikipedia/IESO public records" : "Ontario-centroid fallback";

  return {
    regionId: plantId,
    profile: timeOfDayAverageGW(hourlyPoints),
    latestProfile,
    totalTWh,
    peakGW: peakGW(hourlyPoints),
    lat: coords.lat,
    lon: coords.lon,
    generator: acc.generator,
    fuel: acc.fuel,
    lastUpdated: acc.points.at(-1)?.utcTimestamp ?? new Date().toISOString(),
    lastSuccessAt: acc.points.at(-1)?.utcTimestamp ?? new Date().toISOString(),
    sourceNote:
      `IESO GenOutputCapabilityMonth per-plant curtailment — ` +
      `${acc.fuel} plant "${acc.generator}". ` +
      `Curtailment = max(0, Available Capacity − Output). ` +
      `Coordinates: ${coordSource}. ` +
      `Threshold: ≥${MIN_TWH_30D} TWh/30d.`,
  };
}

// ─── URL construction ────────────────────────────────────────────────────────

function currentMonthUrl(): string {
  return `${IESO_MONTHLY_BASE}/PUB_GenOutputCapabilityMonth.csv`;
}

function historicalMonthUrl(year: number, month: number): string {
  const mm = String(month).padStart(2, "0");
  return `${IESO_MONTHLY_BASE}/PUB_GenOutputCapabilityMonth_${year}${mm}.csv`;
}

/**
 * Build a list of URLs covering the most recent ~30 days of monthly CSVs.
 * The current-month CSV is always fetched (it's the most recent). We also
 * fetch the previous month to ensure we have at least 30 days of data,
 * and potentially the month before that for edge cases where the current
 * month has very few days.
 */
function buildFetchUrls(): string[] {
  const now = new Date();
  const urls: string[] = [currentMonthUrl()];

  // Add previous 2 months to ensure 30-day coverage
  for (let i = 1; i <= 2; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    urls.push(historicalMonthUrl(d.getFullYear(), d.getMonth() + 1));
  }

  return urls;
}

// ─── Main loader ─────────────────────────────────────────────────────────────

const run = async (): Promise<Record<string, PerPlantRegionData>> => {
  const urls = buildFetchUrls();

  const csvs = await Promise.all(
    urls.map(async (url) => {
      try {
        return await fetchText(url, { timeoutMs: 45_000, retries: 1 });
      } catch (err) {
        console.warn(`ieso-per-plant fetch skipped: ${url}: ${(err as Error).message}`);
        return null;
      }
    }),
  );

  // Parse all CSVs and merge measurements
  const allMeasurements: PlantMeasurement[] = [];
  for (const csv of csvs) {
    if (!csv) continue;
    allMeasurements.push(...parseIesoMonthlyCsv(csv));
  }

  if (allMeasurements.length === 0) {
    throw new Error(
      "IESO per-plant: no usable wind or solar measurements found in monthly CSVs — " +
      "upstream outage or format change. Falling back to last-good snapshot.",
    );
  }

  // Compute per-plant curtailment
  const plantMap = computePerPlantCurtailment(allMeasurements);

  // Silent-zero guard
  const totalPoints = [...plantMap.values()].reduce(
    (sum, acc) => sum + acc.points.length,
    0,
  );
  if (totalPoints === 0) {
    throw new Error(
      "IESO per-plant: parsed CSVs produced zero curtailment points — " +
      "upstream outage or format change. Falling back to last-good snapshot.",
    );
  }

  // Build RegionData for each plant, filtering by threshold
  const out: Record<string, PerPlantRegionData> = {};
  for (const [plantId, acc] of plantMap) {
    const region = buildPerPlantRegion(plantId, acc);
    if (region) {
      out[plantId] = region;
    }
  }

  if (Object.keys(out).length === 0) {
    throw new Error(
      `IESO per-plant: ${plantMap.size} plants parsed but none exceeded ` +
      `the ${MIN_TWH_30D} TWh/30d curtailment threshold. ` +
      `Total points: ${totalPoints}.`,
    );
  }

  console.log(
    `ieso-per-plant: ${Object.keys(out).length} plants above threshold ` +
    `from ${plantMap.size} total, ${totalPoints} curtailment points`,
  );

  return out;
};

// ─── CLI entry point ─────────────────────────────────────────────────────────

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<Record<string, PerPlantRegionData>>("ontario-per-plant", run, {
    regionTier: "live" as const,
    tagLive: (r) =>
      Object.fromEntries(
        Object.entries(r).map(([k, v]) => [k, { ...v, sourceStatus: "live" as const }]),
      ) as Record<string, PerPlantRegionData>,
    tagCached: (c) =>
      Object.fromEntries(
        Object.entries(c).map(([k, v]) => [k, { ...v, sourceStatus: "cached" as const }]),
      ) as Record<string, PerPlantRegionData>,
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("ontario-per-plant loader failed", err);
      process.exit(1);
    });
}

// ─── Export for Observable Framework integration ──────────────────────────────
export const buildOntarioPerPlantData = () => run();
