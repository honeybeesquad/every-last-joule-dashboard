/**
 * Peru per-plant generation/curtailment loader — COES SINAC, relay-committed.
 *
 * COES's medidoresgeneracion export (www.coes.org.pe) blocks cloud/datacenter
 * source IPs, so Vercel/CI builds cannot fetch it directly (this is what broke
 * the original build-time-fetch loader and got the Peru per-plant regions
 * dropped from PR #247). Instead a residential relay (`scripts/relay/
 * peru-coes-fetch.py`, run on the always-on egress host) fetches the per-plant
 * generation export and commits a thin per-plant generation-profile CSV to
 * `data/historical/peru-coes-per-plant.csv`; this loader reads that committed
 * CSV at build time and never touches COES. Same pattern as Colombia hydro
 * (`src/data/colombia.json.ts`) and Mexico CENACE (`src/data/mexico.json.ts`).
 *
 * DATA HONESTY — these are `estimated` / modelled-fallback regions:
 *   COES publishes per-plant *generation* (MW), NOT curtailment. There is no
 *   continuous per-plant curtailment signal in Peru — the COES "Energía
 *   Dejada de Inyectar" reports are sparse per-event approvals (e.g. Majes
 *   Solar 3.9 MWh approved Nov 2025; Repartición 71.6 MWh Feb 2026), not a
 *   time series. Each plant's curtailment is therefore estimated as a flat
 *   national-aggregate rate (≈2%, the ~0.8 TWh/yr national vertimiento over
 *   ~40 TWh/yr RER generation) applied to its real generation profile. The
 *   generation shape is measured; the curtailment magnitude is modelled. This
 *   is flagged in every region's sourceNote and the regions are declared
 *   `tier: estimated`, `sourceProvenance: modelled-fallback` in regions.ts.
 *
 * The committed CSV is wide: one row per declared plant with columns
 *   plant_id,kind,window_start,window_end,n_days,total_gen_mwh,h00..h23
 * where h00..h23 are the mean generation (MW) in each UTC hour over the
 * published window and total_gen_mwh is the plant's total over n_days days.
 */

import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";
import {
  latestCompleteUtcDayProfileGW,
  peakGW,
  timeOfDayAverageGW,
} from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = join(__dirname, "../../data/historical/peru-coes-per-plant.csv");

/**
 * National-aggregate curtailment calibration. COES publishes generation, not
 * per-plant curtailment; we estimate curtailment as this fraction of each
 * plant's generation. Matches the national peru.json.ts loader's rate.
 */
const CURTAILMENT_RATE = 0.02;
/** Committed totals are over the published window; normalise to a 30-day figure. */
const NORMALISE_DAYS = 30;

type Fuel = "solar" | "wind";

interface PeruPlant {
  id: string;
  kind: Fuel;
  lat: number;
  lon: number;
}

/**
 * The declared per-plant regions — MUST stay in sync with the `solar-*` /
 * `wind-*` Peru entries in `src/lib/regions.ts`. The loader emits a region
 * only for an id present here, so it never over-emits unmapped COES units
 * (keeps `ci:tier-coherence` green and lets a committed snapshot stay clean).
 * Coordinates are plant centroids verified against Global Energy Monitor.
 */
const PLANTS: PeruPlant[] = [
  { id: "solar-sunny",        kind: "solar", lat: -16.6841, lon: -71.8245 },
  { id: "solar-san-martin",   kind: "solar", lat: -16.7116, lon: -71.8029 },
  { id: "solar-rubi",         kind: "solar", lat: -17.2582, lon: -71.1934 },
  { id: "solar-clemesi",      kind: "solar", lat: -17.2580, lon: -71.1976 },
  { id: "solar-intipampa",    kind: "solar", lat: -17.2267, lon: -70.8608 },
  { id: "solar-matarani",     kind: "solar", lat: -16.7357, lon: -71.9462 },
  { id: "solar-majes",        kind: "solar", lat: -16.4370, lon: -72.2239 },
  { id: "wind-punta-lomitas", kind: "wind",  lat: -14.6517, lon: -75.9008 },
  { id: "wind-wayra",         kind: "wind",  lat: -15.0621, lon: -75.0531 },
  { id: "wind-san-juan",      kind: "wind",  lat: -15.4107, lon: -75.0683 },
  { id: "wind-tres-hermanas", kind: "wind",  lat: -15.3961, lon: -75.0702 },
  { id: "wind-cupisnique",    kind: "wind",  lat: -7.5515,  lon: -79.4955 },
];
const PLANT_BY_ID = new Map(PLANTS.map((p) => [p.id, p]));

export interface PeruPlantRegionData extends RegionData {
  lat: number;
  lon: number;
}

interface CsvRow {
  plantId: string;
  kind: Fuel;
  windowStart: string;
  windowEnd: string;
  nDays: number;
  totalGenMwh: number;
  hourlyGenMw: number[]; // 24 values, UTC hour 0..23
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new Error("peru-per-plant CSV has no data rows");
  const header = lines[0].split(",").map((h) => h.trim());
  const idx = (name: string) => header.indexOf(name);
  const cId = idx("plant_id");
  const cKind = idx("kind");
  const cStart = idx("window_start");
  const cEnd = idx("window_end");
  const cDays = idx("n_days");
  const cTotal = idx("total_gen_mwh");
  const cH0 = idx("h00");
  if ([cId, cKind, cStart, cEnd, cDays, cTotal, cH0].some((i) => i < 0)) {
    throw new Error("peru-per-plant CSV missing required columns");
  }
  const rows: CsvRow[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(",");
    const kind = cols[cKind].trim();
    if (kind !== "solar" && kind !== "wind") continue;
    const hourlyGenMw = Array.from({ length: 24 }, (_, h) => {
      const v = parseFloat(cols[cH0 + h]);
      return Number.isFinite(v) && v > 0 ? v : 0;
    });
    rows.push({
      plantId: cols[cId].trim(),
      kind,
      windowStart: cols[cStart].trim(),
      windowEnd: cols[cEnd].trim(),
      nDays: Math.max(1, parseInt(cols[cDays], 10) || 1),
      totalGenMwh: Math.max(0, parseFloat(cols[cTotal]) || 0),
      hourlyGenMw,
    });
  }
  return rows;
}

function buildRegion(row: CsvRow, plant: PeruPlant): PeruPlantRegionData {
  // One curtailment point per UTC hour (generation × national calibration).
  // All points carry the window-end date so latestProfile resolves to a
  // single complete UTC day equal to the time-of-day-average profile.
  const curtailmentPoints: CurtailmentPoint[] = row.hourlyGenMw.map((mw, h) => ({
    utcTimestamp: `${row.windowEnd}T${String(h).padStart(2, "0")}:00:00.000Z`,
    mw: mw * CURTAILMENT_RATE,
    intervalHours: 1,
  }));

  const norm = NORMALISE_DAYS / row.nDays;
  const totalTWh = (row.totalGenMwh * norm * CURTAILMENT_RATE) / 1_000_000;
  const generationTotalTWh = (row.totalGenMwh * norm) / 1_000_000;
  const lastUpdated = `${row.windowEnd}T00:00:00.000Z`;

  return {
    regionId: row.plantId,
    profile: timeOfDayAverageGW(curtailmentPoints),
    latestProfile: latestCompleteUtcDayProfileGW(curtailmentPoints),
    totalTWh,
    peakGW: peakGW(curtailmentPoints),
    lat: plant.lat,
    lon: plant.lon,
    lastUpdated,
    lastSuccessAt: lastUpdated,
    generationProfile: row.hourlyGenMw.map((mw) => mw / 1000),
    generationTotalTWh,
    fuelShare: { [plant.kind]: 1 },
    sourceNote:
      `COES SINAC medidoresgeneracion per-plant export (Potencia Activa MW), ` +
      `UTC-hour mean over ${row.nDays}d ending ${row.windowEnd}; fetched via ` +
      `residential relay and committed to git (COES blocks cloud build IPs). ` +
      `COES publishes per-plant generation, not curtailment — magnitude ` +
      `estimated at ${CURTAILMENT_RATE * 100}% national vertimiento ` +
      `calibration (~0.8 TWh/yr ÷ ~40 TWh/yr RER); per-plant curtailment is ` +
      `modelled, not measured.`,
  };
}

const run = async (): Promise<Record<string, PeruPlantRegionData>> => {
  const rows = parseCsv(readFileSync(CSV_PATH, "utf8"));
  const out: Record<string, PeruPlantRegionData> = {};
  for (const row of rows) {
    const plant = PLANT_BY_ID.get(row.plantId);
    if (!plant || plant.kind !== row.kind) continue; // emit only declared plants
    out[row.plantId] = buildRegion(row, plant);
  }
  if (Object.keys(out).length === 0) {
    throw new Error("peru-per-plant: committed CSV produced no declared plants");
  }
  return out;
};

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<Record<string, PeruPlantRegionData>>("peru-per-plant", run, {
    regionTier: "estimated" as const,
    tagLive: (r) => Object.fromEntries(
      Object.entries(r).map(([k, v]) => [k, { ...v, sourceStatus: "live" as const }]),
    ) as Record<string, PeruPlantRegionData>,
    tagCached: (c) => Object.fromEntries(
      Object.entries(c).map(([k, v]) => [k, { ...v, sourceStatus: "cached" as const }]),
    ) as Record<string, PeruPlantRegionData>,
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("peru-per-plant loader failed", err);
      process.exit(1);
    });
}

export const buildPeruPerPlantData = () => run();
