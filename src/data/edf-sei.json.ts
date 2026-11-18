/**
 * EDF SEI island grids: Corsica, Réunion, Guadeloupe, Martinique, French Guiana.
 *
 * EDF Systèmes Énergétiques Insulaires publishes each territory's generation
 * mix by source on its open-data portal (opendata-<territory>.edf.fr). The
 * portals run Koumoul Data Fair, not Opendatasoft: the lines endpoint is
 * `/data-fair/api/v1/datasets/<slug>/lines`. It is public (Licence Ouverte
 * 2.0) and needs no account or key.
 *
 * What the feed is, and is not:
 *  - EDF labels every real-time row "Estimé": telemetry plus estimates,
 *    "fournies à titre indicatif". This is generation, not metered energy.
 *  - It is a rolling window. Corsica holds about 14 days at 15-minute steps;
 *    the other four hold about 24 hours at 5-minute steps. The 30-day
 *    generation total is therefore the window's diurnal mean × 30 days
 *    (`unpublishedGenerationRegion` does this for any span under 25 days),
 *    not 30 days of observations.
 *  - It carries no curtailment column. Waste stays unpublished and the
 *    regions stay `estimated` (T3). No curtailment rate is applied.
 *
 * Each region carries the sum of the solar, wind and hydro columns its
 * territory has, and `fuelShare` carries the observed split of that sum, so
 * a `kind: "mixed"` island is coloured by its real dominant fuel. Thermal,
 * bioenergy, geothermal, interconnector and storage columns are not read.
 */

import { pathToFileURL } from "url";
import { fetchJSON } from "../lib/fetch.js";
import { timeOfDayAverageGW } from "../lib/profile.js";
import { DEFAULT_STALENESS_THRESHOLD_HOURS, withFallback } from "../lib/resilient.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";
import { unpublishedGenerationRegion } from "../lib/waste-status.js";

export type SeiFuel = "solar" | "wind" | "hydro";

export interface SeiTerritory {
  regionId: string;
  label: string;
  host: string;
  /** Data Fair dataset slug of the real-time mix. */
  dataset: string;
  /** Feed columns (MW) summed into each fuel. A fuel the territory lacks is omitted. */
  fuels: Partial<Record<SeiFuel, string[]>>;
}

/**
 * Fuel lists were checked against EDF SEI's consolidated hourly dataset
 * (2019-2024) on 2026-11-18: Martinique's hydro column never exceeds
 * 0.02 MW, so Martinique has no hydro; French Guiana has no wind column.
 * Corsica reports `hydraulique` and `micro_hydro` separately (both add into
 * the feed's `total`), so hydro is their sum.
 */
export const SEI_TERRITORIES: readonly SeiTerritory[] = [
  {
    regionId: "corsica",
    label: "Corse",
    host: "opendata-corse.edf.fr",
    dataset: "production-delectricite-par-filiere-en-temps-reel",
    fuels: { solar: ["photovoltaique"], wind: ["eolien"], hydro: ["hydraulique", "micro_hydro"] },
  },
  {
    regionId: "reunion",
    label: "La Réunion",
    host: "opendata-reunion.edf.fr",
    dataset: "prod-electricite-temps-reel-974",
    fuels: { solar: ["photovoltaique"], wind: ["eolien"], hydro: ["hydraulique"] },
  },
  {
    regionId: "guadeloupe",
    label: "Guadeloupe",
    host: "opendata-guadeloupe.edf.fr",
    dataset: "mix-temps-reel-guadeloupe",
    fuels: { solar: ["photovoltaique"], wind: ["eolien"], hydro: ["hydraulique"] },
  },
  {
    regionId: "martinique",
    label: "Martinique",
    host: "opendata-martinique.edf.fr",
    dataset: "production-delectricite-par-filiere-en-temps-reel-martinique",
    fuels: { solar: ["photovoltaique"], wind: ["eolien"] },
  },
  {
    regionId: "french-guiana",
    label: "Guyane",
    host: "opendata-guyane.edf.fr",
    dataset: "production-d-electricite-par-filiere-en-temps-reel-guyane",
    fuels: { solar: ["photovoltaique"], hydro: ["hydraulique"] },
  },
];

const FUEL_ORDER: readonly SeiFuel[] = ["solar", "wind", "hydro"];

/**
 * The window is the unbroken run of rows ending at the newest one: walking
 * back, the first gap longer than this ends it. The 24-hour feeds keep the
 * odd orphan row from days or weeks earlier (seen 2026-11-18: one Réunion
 * row from 2026-10-06, one Martinique row from 2026-10-22); left in, it
 * would be averaged into one hour of the diurnal profile. The feeds step at
 * 5 to 30 minutes, so six hours is a real break, not a missed reading.
 */
const MAX_GAP_HOURS = 6;
/** Every UTC hour must be present, or the missing hour would read as 0 GW. */
const REQUIRED_UTC_HOURS = 24;
/** More rows than any feed holds (Corsica: ~1,344), in one page. */
const PAGE_SIZE = 2000;

export type SeiRow = Record<string, unknown>;

export interface SeiSeries {
  /** Solar + wind + hydro MW per timestamp, ascending. */
  points: CurtailmentPoint[];
  /** Mean MW per fuel across the UTC hour-of-day buckets. */
  meanMwByFuel: Partial<Record<SeiFuel, number>>;
  spanHours: number;
}

export function seiLinesUrl(t: SeiTerritory): string {
  const columns = ["date", ...FUEL_ORDER.flatMap((f) => t.fuels[f] ?? [])];
  const params = new URLSearchParams({
    size: String(PAGE_SIZE),
    sort: "-date",
    select: columns.join(","),
  });
  return `https://${t.host}/data-fair/api/v1/datasets/${t.dataset}/lines?${params.toString()}`;
}

export function seiDatasetPage(t: SeiTerritory): string {
  return `https://${t.host}/datasets/${t.dataset}`;
}

/** Sum a fuel's columns for one row. Null when no column holds a number. */
function fuelMw(row: SeiRow, columns: string[]): number | null {
  let sum = 0;
  let seen = false;
  for (const col of columns) {
    const raw = row[col];
    if (typeof raw !== "number" || !Number.isFinite(raw)) continue;
    // Telemetry noise dips slightly below zero at night; generation cannot.
    sum += Math.max(0, raw);
    seen = true;
  }
  return seen ? sum : null;
}

/**
 * Turn Data Fair rows into one summed series. `date` carries the territory's
 * UTC offset, so `Date.parse` yields UTC directly. A timestamp published
 * twice is counted once.
 */
export function parseSeiRows(t: SeiTerritory, rows: SeiRow[]): SeiSeries {
  const fuels = FUEL_ORDER.filter((f) => t.fuels[f]);
  const byTs = new Map<number, Partial<Record<SeiFuel, number>>>();
  for (const row of rows) {
    const ms = typeof row.date === "string" ? Date.parse(row.date) : NaN;
    if (!Number.isFinite(ms)) continue;
    const values: Partial<Record<SeiFuel, number>> = {};
    let complete = true;
    for (const fuel of fuels) {
      const mw = fuelMw(row, t.fuels[fuel]!);
      if (mw == null) {
        complete = false;
        break;
      }
      values[fuel] = mw;
    }
    // A row missing one fuel would understate the sum; skip it whole.
    if (complete) byTs.set(ms, values);
  }
  if (byTs.size === 0) throw new Error(`EDF SEI ${t.label}: no usable rows`);

  const sorted = Array.from(byTs.entries()).sort(([a], [b]) => a - b);
  let start = sorted.length - 1;
  while (start > 0 && sorted[start][0] - sorted[start - 1][0] <= MAX_GAP_HOURS * 3_600_000) start--;
  const kept = sorted.slice(start);

  const stepHours = medianStepHours(kept.map(([ms]) => ms));
  const points: CurtailmentPoint[] = kept.map(([ms, values]) => ({
    utcTimestamp: new Date(ms).toISOString(),
    mw: fuels.reduce((sum, f) => sum + (values[f] ?? 0), 0),
    intervalHours: stepHours,
  }));

  const hours = new Set(kept.map(([ms]) => new Date(ms).getUTCHours()));
  if (hours.size < REQUIRED_UTC_HOURS) {
    throw new Error(
      `EDF SEI ${t.label}: window covers ${hours.size} of ${REQUIRED_UTC_HOURS} UTC hours`,
    );
  }

  // Per-fuel mean of the hour-of-day means, the same weighting the summed
  // generationProfile gets, so the fuel figures in the note add up to it.
  const meanMwByFuel: Partial<Record<SeiFuel, number>> = {};
  for (const fuel of fuels) {
    const hourly = timeOfDayAverageGW(
      kept.map(([ms, values]) => ({ utcTimestamp: new Date(ms).toISOString(), mw: values[fuel] ?? 0 })),
    );
    meanMwByFuel[fuel] = (hourly.reduce((sum, gw) => sum + gw, 0) / 24) * 1000;
  }

  return {
    points,
    meanMwByFuel,
    spanHours: (kept[kept.length - 1][0] - kept[0][0]) / 3_600_000,
  };
}

function medianStepHours(sortedMs: number[]): number {
  const steps: number[] = [];
  for (let i = 1; i < sortedMs.length; i++) steps.push(sortedMs[i] - sortedMs[i - 1]);
  if (steps.length === 0) return 1;
  steps.sort((a, b) => a - b);
  return steps[Math.floor(steps.length / 2)] / 3_600_000;
}

function describeSpan(spanHours: number): string {
  return spanHours >= 48 ? `${(spanHours / 24).toFixed(1)} days` : `${Math.round(spanHours)} hours`;
}

export function seiSourceNote(t: SeiTerritory, series: SeiSeries): string {
  const fuels = FUEL_ORDER.filter((f) => t.fuels[f]);
  // Mean MW × 720 h = MWh per 30 days; ÷ 1000 = GWh.
  const perFuel = fuels
    .map((f) => `${f} ${(((series.meanMwByFuel[f] ?? 0) * 720) / 1000).toFixed(1)}`)
    .join(", ");
  return (
    `EDF SEI ${t.label} real-time generation by source (${seiDatasetPage(t)}), ` +
    `${fuels.join(" + ")} summed. EDF marks these rows estimated (telemetry and estimates), ` +
    `not metered. Rolling window of ${describeSpan(series.spanHours)}, ${series.points.length} intervals; ` +
    `the 30-day total is this window's diurnal mean × 30 days (GWh: ${perFuel}). ` +
    "The feed has no curtailment column: waste unpublished, no rate applied. Missing ≠ zero. Not T1a."
  );
}

/**
 * `fuelShare` here is the split of observed generation, not of waste (waste
 * is zero). It is what `fuel.ts` reads for a `kind: "mixed"` region; without
 * it every island would fall into the unsplit-mixed hydro bucket.
 */
function observedFuelShare(series: SeiSeries): RegionData["fuelShare"] | undefined {
  const entries = Object.entries(series.meanMwByFuel) as [SeiFuel, number][];
  const total = entries.reduce((sum, [, mw]) => sum + mw, 0);
  if (!(total > 0)) return undefined;
  return Object.fromEntries(entries.map(([fuel, mw]) => [fuel, mw / total]));
}

export function buildSeiRegion(t: SeiTerritory, rows: SeiRow[], now: Date = new Date()): RegionData {
  const series = parseSeiRows(t, rows);
  const region = unpublishedGenerationRegion(t.regionId, "mixed", series.points, seiSourceNote(t, series));
  const fuelShare = observedFuelShare(series);
  if (fuelShare) region.fuelShare = fuelShare;
  // A feed that has stopped updating still parses. withFallback keeps a
  // "degraded" stamp, so say so rather than pass an old window off as current.
  const ageHours = (now.getTime() - Date.parse(region.lastUpdated)) / 3_600_000;
  if (ageHours > DEFAULT_STALENESS_THRESHOLD_HOURS) region.sourceStatus = "degraded";
  return region;
}

async function fetchTerritory(t: SeiTerritory): Promise<RegionData> {
  const payload = await fetchJSON<{ results?: SeiRow[] }>(seiLinesUrl(t), {
    timeoutMs: 20000,
    retries: 1,
    headers: { accept: "application/json" },
  });
  return buildSeiRegion(t, payload.results ?? []);
}

/**
 * All five or none: a territory that fails throws, and `withFallback` serves
 * the last-good snapshot for the whole loader. Emitting four fresh regions
 * and dropping the fifth would remove it from the page.
 */
async function run(): Promise<Record<string, RegionData>> {
  const regions = await Promise.all(SEI_TERRITORIES.map(fetchTerritory));
  return Object.fromEntries(regions.map((r) => [r.regionId, r]));
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback<Record<string, RegionData>>("edf-sei", () => run(), {
    regionTier: "estimated" as const,
    tagLive: (r) => r,
    tagCached: (c) => c as Record<string, RegionData>,
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("edf-sei loader failed", err);
      process.exit(1);
    });
}

export const buildEdfSeiData = run;
