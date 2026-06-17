/**
 * Peru per-plant parser — COES Medidores de Generación.
 *
 * Fetches quarter-hourly per-plant generation data from the COES SINAC
 * medidoresgeneracion export endpoint.  Each solar and wind plant becomes
 * its own RegionKey with a generation profile and an *estimated* curtailment
 * profile.
 *
 * **DATA HONESTY NOTE**: The medidoresgeneracion CSV contains **actual
 * generation** (MW), NOT curtailment.  There is no per-plant curtailment
 * signal published by COES.  Curtailment per plant is estimated by applying
 * a fixed calibration rate (currently 2 %, derived from the ~0.8 TWh/yr
 * published national vertimiento anchor) to the observed generation.  This
 * rate is a national aggregate; per-plant curtailment may differ
 * substantially based on grid position, curtailment priority, and
 * dispatch rules.  The sourceNote on each RegionData explicitly flags
 * this limitation.
 *
 * The CSV export format (formato=3) is:
 *
 *   fechahora, Company - Unit1, Company - Unit2, ...
 *   01/06/2025 00:15, 0, 0, ...
 *   01/06/2025 00:30, 16.85, 3.44, ...
 *
 * Timestamps are Peru local time (UTC-5).  Values are MW (active power).
 * The export supports up to 1 month of data per request.
 */

import { fetchText } from "../lib/fetch.js";
import {
  latestCompleteUtcDayProfileGW,
  peakGW,
  timeOfDayAverageGW,
  totalTWh30d,
} from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";
import { pathToFileURL } from "url";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Base URL for the medidoresgeneracion page (needed for export flow). */
const COES_PAGE_URL =
  "https://www.coes.org.pe/Portal/mediciones/medidoresgeneracion";

/** Export trigger endpoint — POST with form data, then download. */
const COES_EXPORT_URL = `${COES_PAGE_URL}/exportar`;
const COES_DOWNLOAD_URL = `${COES_PAGE_URL}/descargar?tipo=3`;

/**
 * Curtailment calibration rate.
 *
 * Derived from the published national vertimiento anchor of ~0.8 TWh/yr
 * against ~40 TWh/yr renewable generation ≈ 2 %.
 *
 * This is a **national aggregate** estimate applied uniformly to every
 * plant.  Per-plant curtailment rates will differ based on grid position,
 * priority of dispatch, and curtailment rules.  The limitation is
 * documented in each RegionData.sourceNote.
 */
const CURTAILMENT_RATE = 0.02;

const PERU_UTC_OFFSET_HOURS = -5;

/** Max days the COES export accepts per request (enforced server-side). */
const MAX_EXPORT_DAYS = 30;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Parsed header from the CSV export. */
interface CsvHeader {
  /** The fechahora column name (first column). */
  timestampCol: string;
  /** Plant column names: "Company - UnitName" */
  plantColumns: string[];
}

/** A single quarter-hourly reading. */
interface CsvReading {
  /** Local timestamp string, e.g. "01/06/2025 00:15" */
  localTimestamp: string;
  /** MW values indexed by column position (0 = first plant). */
  values: number[];
}

/** Canonical plant key derived from the raw CSV column header. */
interface PlantKey {
  /** Stable kebab-case id, e.g. "peru-solar-majes" */
  id: string;
  /** Display name, e.g. "Majes Solar" */
  name: string;
  /** Fuel type */
  kind: "solar" | "wind";
}

// ---------------------------------------------------------------------------
// CSV Parsing
// ---------------------------------------------------------------------------

/**
 * Parse a single CSV line, respecting quoted fields and escaped quotes.
 * COES CSV uses double-quote escaping: "" inside a quoted field.
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Parse the header row from a COES medidoresgeneracion CSV export.
 *
 * Header format:
 *   fechahora , Company - Unit1, Company - Unit2, ...
 *
 * Note the space before the comma after "fechahora".
 */
function parseHeader(headerLine: string): CsvHeader {
  const fields = parseCsvLine(headerLine);
  const timestampCol = fields[0];
  const plantColumns = fields.slice(1);
  return { timestampCol, plantColumns };
}

/**
 * Parse a data row and return MW values.
 *
 * Data format:
 *   01/06/2025 00:15, 0, 0, 16.85, ...
 *
 * COES uses comma as decimal separator in some contexts but the CSV export
 * uses dot for decimals.  The thousands separator is not used.
 */
function parseDataRow(line: string): CsvReading | null {
  if (!line.trim()) return null;
  const fields = parseCsvLine(line);
  if (fields.length < 2) return null;

  const localTimestamp = fields[0];
  // Validate timestamp format: DD/MM/YYYY HH:MM
  if (!/^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}$/.test(localTimestamp)) return null;

  const values: number[] = [];
  for (let i = 1; i < fields.length; i++) {
    const raw = fields[i].replace(/\s/g, "");
    const num = raw === "" || raw === "-" ? 0 : Number(raw);
    values.push(Number.isFinite(num) ? num : 0);
  }
  return { localTimestamp, values };
}

// ---------------------------------------------------------------------------
// Plant Key Derivation
// ---------------------------------------------------------------------------

/**
 * Derive a canonical plant key from a CSV column header.
 *
 * COES headers look like:
 *   "COMPANY NAME -UNIT_NAME"
 *   "COMPANY NAME -UNIT_NAME-BL1"  (unit block 1)
 *   "COMPANY NAME -UNIT_NAME-BL2"  (unit block 2)
 *
 * We group by the UNIT_NAME portion (after the dash), stripping block
 * suffixes like -BL1, -BL2, _CIRCUITO_1-5, _CIRCUITO_6-10, etc.
 *
 * The result is a stable kebab-case id suitable for use as a RegionKey.
 */
function derivePlantKey(
  header: string,
  kind: "solar" | "wind",
): PlantKey {
  // Strip the company prefix: everything before the first " -"
  const dashIdx = header.indexOf(" -");
  const unitRaw = dashIdx >= 0 ? header.slice(dashIdx + 2) : header;

  // Normalize: strip block suffixes (-BL1, -BL2, etc.) and circuit splits
  let normalized = unitRaw
    .replace(/-BL\d+$/i, "")         // -BL1, -BL2
    .replace(/_BL\d+$/i, "")         // _BL1
    .replace(/_CIRCUITO_\d+-\d+$/i, "") // _CIRCUITO_1-5
    .replace(/_EXP$/i, "")           // _EXP (expansion block)
    .trim();

  // Convert to kebab-case
  const id = normalized
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  // Derive display name from the normalized unit
  const name = normalized
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

  return { id: `${kind}-${id}`, name, kind };
}

/**
 * Group multiple CSV column headers into canonical plant keys.
 * Returns a map from column index to plant key, and a deduplicated list of
 * unique plant keys (in order of first appearance).
 */
function groupColumnsByPlant(
  plantColumns: string[],
  kind: "solar" | "wind",
): { colToPlant: Map<number, PlantKey>; plants: PlantKey[] } {
  const colToPlant = new Map<number, PlantKey>();
  const plantsByName = new Map<string, PlantKey>();
  const plants: PlantKey[] = [];

  for (let i = 0; i < plantColumns.length; i++) {
    const key = derivePlantKey(plantColumns[i], kind);
    if (!plantsByName.has(key.id)) {
      plantsByName.set(key.id, key);
      plants.push(key);
    }
    colToPlant.set(i, plantsByName.get(key.id)!);
  }

  return { colToPlant, plants };
}

// ---------------------------------------------------------------------------
// Timestamp Conversion
// ---------------------------------------------------------------------------

/**
 * Parse a Peru-local timestamp (DD/MM/YYYY HH:MM) and return a Date in UTC.
 *
 * Peru is UTC-5 year-round (no DST).
 */
function peruLocalToUtc(localTimestamp: string): Date {
  const match = localTimestamp.match(
    /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/,
  );
  if (!match) return new Date(NaN);
  const [, dd, mm, yyyy, hh, min] = match;
  // Local time: UTC-5, so UTC = local + 5
  return new Date(
    Date.UTC(
      Number(yyyy),
      Number(mm) - 1,
      Number(dd),
      Number(hh) - PERU_UTC_OFFSET_HOURS,
      Number(min),
      0,
    ),
  );
}

// ---------------------------------------------------------------------------
// Point Construction
// ---------------------------------------------------------------------------

/**
 * Convert parsed CSV readings into CurtailmentPoint arrays, grouped by plant.
 *
 * Each quarter-hourly MW reading becomes a CurtailmentPoint with:
 *   - utcTimestamp: converted from Peru local to UTC
 *   - mw: the actual generation in MW (NOT curtailment)
 *   - intervalHours: 0.25 (quarter-hour)
 *
 * **IMPORTANT**: These points represent *generation*, not curtailment.
 * Curtailment is estimated separately by applying CURTAILMENT_RATE.
 */
function readingsToPlantPoints(
  readings: CsvReading[],
  colToPlant: Map<number, PlantKey>,
  plants: PlantKey[],
): Map<string, CurtailmentPoint[]> {
  const plantPoints = new Map<string, CurtailmentPoint[]>();
  for (const p of plants) {
    plantPoints.set(p.id, []);
  }

  for (const reading of readings) {
    const utc = peruLocalToUtc(reading.localTimestamp);
    if (Number.isNaN(utc.getTime())) continue;
    const utcTimestamp = utc.toISOString();

    // Sum MW values for each plant (multiple units → aggregated)
    const plantSums = new Map<string, number>();
    for (const p of plants) plantSums.set(p.id, 0);

    for (let colIdx = 0; colIdx < reading.values.length; colIdx++) {
      const plant = colToPlant.get(colIdx);
      if (!plant) continue;
      const current = plantSums.get(plant.id) ?? 0;
      plantSums.set(plant.id, current + reading.values[colIdx]);
    }

    for (const [plantId, mw] of plantSums) {
      const points = plantPoints.get(plantId);
      if (!points) continue;
      points.push({
        utcTimestamp,
        mw: Math.max(0, mw),
        intervalHours: 0.25, // quarter-hour
      });
    }
  }

  return plantPoints;
}

// ---------------------------------------------------------------------------
// RegionData Construction
// ---------------------------------------------------------------------------

function buildPlantRegionData(
  plantId: string,
  generationPoints: CurtailmentPoint[],
  lastUpdated: string,
): RegionData {
  // Compute generation profile (24 GW values)
  const generationProfile = timeOfDayAverageGW(generationPoints);
  const generationTotalTWh = totalTWh30d(generationPoints, 0.25);

  // Estimate curtailment by applying the national aggregate rate
  const curtailmentPoints: CurtailmentPoint[] = generationPoints.map((p) => ({
    ...p,
    mw: p.mw * CURTAILMENT_RATE,
  }));

  const profile = timeOfDayAverageGW(curtailmentPoints);
  const totalTWh = totalTWh30d(curtailmentPoints, 0.25);
  const peak = peakGW(curtailmentPoints);

  const base: RegionData = {
    regionId: plantId,
    profile,
    latestProfile: latestCompleteUtcDayProfileGW(curtailmentPoints),
    totalTWh,
    peakGW: peak,
    lastUpdated,
    lastSuccessAt: lastUpdated,
    generationProfile,
    generationTotalTWh,
    sourceNote:
      `COES SINAC medidoresgeneracion per-plant export (Potencia Activa MW); ` +
      `quarter-hourly actual generation. Curtailment estimated at ${CURTAILMENT_RATE * 100}% ` +
      `national aggregate rate (derived from ~0.8 TWh/yr published vertimiento anchor). ` +
      `Per-plant curtailment may differ substantially from this estimate due to grid ` +
      `position, dispatch priority, and curtailment rules.`,
    fuelShare: { solar: 1 }, // set by caller for wind plants
  };

  return applyUncertainty(base, {
    regionTier: "live",
  });
}

// ---------------------------------------------------------------------------
// COES Export Fetching
// ---------------------------------------------------------------------------

/**
 * Fetch a CSV export from COES medidoresgeneracion.
 *
 * The export is a two-step process:
 *   1. POST to /exportar to trigger server-side generation
 *   2. GET /descargar?tipo=3 to download the CSV
 *
 * @param dateFrom Start date (YYYY-MM-DD)
 * @param dateTo End date (YYYY-MM-DD)
 * @param tipoGeneracion COES generation type: "3"=solar, "4"=wind
 * @returns Raw CSV text
 */
async function fetchCoesCsvExport(
  dateFrom: Date,
  dateTo: Date,
  tipoGeneracion: string,
): Promise<string> {
  const fmt = (d: Date) =>
    `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;

  const fromStr = fmt(dateFrom);
  const toStr = fmt(dateTo);

  // Step 1: Trigger export
  const exportBody = new URLSearchParams({
    fechaInicial: fromStr,
    fechaFinal: toStr,
    tiposEmpresa: "",
    empresas: "",
    tiposGeneracion: tipoGeneracion,
    central: "0",
    parametros: "1", // Potencia Activa (MW)
    tipo: "3", // CSV format
  }).toString();

  const exportResult = await fetchText(COES_EXPORT_URL, {
    method: "POST",
    body: exportBody,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    },
    timeoutMs: 30_000,
    retries: 2,
  });

  // The export endpoint returns "1" on success
  if (exportResult.trim() !== "1") {
    throw new Error(
      `COES export failed with response: ${exportResult.slice(0, 200)}`,
    );
  }

  // Step 2: Download the CSV
  const csv = await fetchText(COES_DOWNLOAD_URL, {
    method: "GET",
    timeoutMs: 30_000,
    retries: 2,
  });

  if (!csv || csv.length < 50) {
    throw new Error("COES CSV download returned empty or very short content");
  }

  return csv;
}

/**
 * Fetch the latest month of per-plant generation data for a fuel type.
 */
async function fetchLatestMonthCsv(
  tipoGeneracion: string,
): Promise<string> {
  const now = new Date();
  const peruNow = new Date(
    now.getTime() + PERU_UTC_OFFSET_HOURS * 60 * 60 * 1000,
  );

  // The COES API only allows querying previous months (not the current month).
  // Use the second-to-last complete month.
  const latestCompleteLocalDay = new Date(
    Date.UTC(
      peruNow.getUTCFullYear(),
      peruNow.getUTCMonth(),
      peruNow.getUTCDate() - 1,
    ),
  );

  // Go back to the start of the previous month
  const dateTo = new Date(
    Date.UTC(
      latestCompleteLocalDay.getUTCFullYear(),
      latestCompleteLocalDay.getUTCMonth(),
      0, // last day of previous month
    ),
  );
  const dateFrom = new Date(
    Date.UTC(dateTo.getUTCFullYear(), dateTo.getUTCMonth(), 1),
  );

  return fetchCoesCsvExport(dateFrom, dateTo, tipoGeneracion);
}

// ---------------------------------------------------------------------------
// Main Parser
// ---------------------------------------------------------------------------

export interface PeruPerPlantParsed {
  solar: Map<string, CurtailmentPoint[]>;
  wind: Map<string, CurtailmentPoint[]>;
}

/**
 * Parse a COES medidoresgeneracion CSV export into per-plant generation
 * point arrays.
 */
export function parseCoesCsv(
  csvText: string,
  kind: "solar" | "wind",
): PeruPerPlantParsed {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    throw new Error("CSV has fewer than 2 lines (header + at least one data row)");
  }

  const header = parseHeader(lines[0]);
  if (header.plantColumns.length === 0) {
    throw new Error("CSV header has no plant columns");
  }

  const { colToPlant, plants } = groupColumnsByPlant(
    header.plantColumns,
    kind,
  );

  const readings: CsvReading[] = [];
  for (let i = 1; i < lines.length; i++) {
    const reading = parseDataRow(lines[i]);
    if (reading) readings.push(reading);
  }

  if (readings.length === 0) {
    throw new Error("CSV has no valid data rows");
  }

  const plantPoints = readingsToPlantPoints(readings, colToPlant, plants);

  const result: PeruPerPlantParsed = {
    solar: new Map(),
    wind: new Map(),
  };

  if (kind === "solar") {
    result.solar = plantPoints;
  } else {
    result.wind = plantPoints;
  }

  return result;
}

/**
 * Build RegionData for each plant with meaningful data.
 *
 * A plant is included if it has at least 24 data points (6 hours of
 * quarter-hourly readings) — this filters out plants with negligible or
 * zero generation.
 */
function buildAllPlantRegions(
  solarPoints: Map<string, CurtailmentPoint[]>,
  windPoints: Map<string, CurtailmentPoint[]>,
  lastUpdated: string,
): Record<string, RegionData> {
  const out: Record<string, RegionData> = {};

  const buildFromMap = (
    pointsMap: Map<string, CurtailmentPoint[]>,
    kind: "solar" | "wind",
  ) => {
    for (const [plantId, points] of pointsMap) {
      // Skip plants with negligible data (< 6 hours of quarter-hourly readings)
      if (points.length < 24) continue;

      // Skip plants with zero total generation
      const totalMw = points.reduce((s, p) => s + p.mw, 0);
      if (totalMw <= 0) continue;

      const regionData = buildPlantRegionData(plantId, points, lastUpdated);
      regionData.fuelShare = { [kind]: 1 };
      out[plantId] = regionData;
    }
  };

  buildFromMap(solarPoints, "solar");
  buildFromMap(windPoints, "wind");

  return out;
}

// ---------------------------------------------------------------------------
// Loader Entry Point
// ---------------------------------------------------------------------------

const run = async (): Promise<Record<string, RegionData>> => {
  // Fetch latest month of data for solar and wind in parallel
  const [solarCsv, windCsv] = await Promise.all([
    fetchLatestMonthCsv("3"), // 3 = SOLAR
    fetchLatestMonthCsv("4"), // 4 = EÓLICA
  ]);

  const solarParsed = parseCoesCsv(solarCsv, "solar");
  const windParsed = parseCoesCsv(windCsv, "wind");

  // Merge all points to find the latest timestamp
  const allPoints = [
    ...solarParsed.solar.values(),
    ...windParsed.wind.values(),
  ].flat();

  if (allPoints.length === 0) {
    throw new Error("COES medidoresgeneracion returned no data points");
  }

  const lastUpdated = allPoints
    .sort((a, b) => a.utcTimestamp.localeCompare(b.utcTimestamp))
    .at(-1)?.utcTimestamp ?? new Date().toISOString();

  const out = buildAllPlantRegions(
    solarParsed.solar,
    windParsed.wind,
    lastUpdated,
  );

  if (Object.keys(out).length === 0) {
    throw new Error(
      "COES medidoresgeneracion returned no plants with meaningful data",
    );
  }

  return out;
};

// ---------------------------------------------------------------------------
// CLI Entry Point
// ---------------------------------------------------------------------------

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<Record<string, RegionData>>("peru-per-plant", run, {
    tagLive: (r) => {
      const tagged: Record<string, RegionData> = {};
      for (const [k, v] of Object.entries(r))
        tagged[k] = { ...v, sourceStatus: "live" as const };
      return tagged;
    },
    tagCached: (c) => {
      const tagged: Record<string, RegionData> = {};
      for (const [k, v] of Object.entries(c))
        tagged[k] = { ...v, sourceStatus: "cached" as const };
      return tagged;
    },
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("peru-per-plant loader failed", err);
      process.exit(1);
    });
}

export const buildPeruPerPlantData = () => run();
