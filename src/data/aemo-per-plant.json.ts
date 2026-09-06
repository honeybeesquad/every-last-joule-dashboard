/**
 * AEMO per-DUID plant split loader.
 *
 * Reuses the same NEMWEB UNIT_SOLUTION CSV parsing logic as aemo.json.ts
 * but retains DUID-level granularity instead of collapsing to state-level
 * buckets. Each qualifying DUID becomes its own RegionData entry keyed by
 * `aemo-<duid>-<fueltech>`.
 *
 * Emission is gated to `PER_PLANT_DUIDS` and to nothing else. That set is the
 * same one aemo.json.ts excludes from its state aggregates, so the
 * aggregate-minus-named contract (#298) — total = rest-of-state + named =
 * full state, counted once — holds only while every registry DUID is emitted
 * here. A registry plant that recorded no curtailment in the window is
 * therefore emitted as a measured zero rather than dropped.
 *
 * Coordinates sourced from OpenNEM GitHub (opennem/opennem — CC BY 4.0):
 * 215 wind+solar DUIDs with verified lat/lon. 49 unit-map DUIDs without
 * OpenNEM coords fall back to state centroids.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { fetchText } from "../lib/fetch.js";
import { hourlyAverage } from "../lib/csv.js";
import { latestCompleteUtcDayProfileGW, peakGW, timeOfDayAverageGW, totalTWh30d } from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";
import { AEMO_UNIT_MAP, PER_PLANT_DUIDS } from "./aemo-unit-map.js";
import { AEMO_DUID_COORDS } from "./aemo-duid-coords.js";

// ─── Region code → state ID mapping (shared with aemo.json.ts) ───────────────

type AemoFuel = "wind" | "solar";

const REGION_CODE_TO_ID: Record<string, string> = {
  NSW1: "nsw",
  VIC1: "vic",
  QLD1: "qld",
  SA1:  "sa",
  TAS1: "tas",
};

// ─── State centroids for lat/lon fallback (OpenNEM doesn't cover all DUIDs) ──

const STATE_CENTROIDS: Record<string, { lat: number; lon: number }> = {
  nsw: { lat: -32.0, lon: 147.0 },
  vic: { lat: -37.8, lon: 145.0 },
  qld: { lat: -23.0, lon: 149.0 },
  sa:  { lat: -30.0, lon: 139.0 },
  tas: { lat: -42.0, lon: 146.5 },
};

// ─── Date parsing (shared logic from aemo.json.ts) ──────────────────────────

function parseAemoDate(localAest: string): string | null {
  const match = localAest.match(/^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  const utcMs = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour) - 10,
    Number(minute),
    Number(second),
  );
  return new Date(utcMs).toISOString();
}

// ─── Dispatch cadence ───────────────────────────────────────────────────────

/**
 * NEMWEB DISPATCH UNIT_SOLUTION rows are 5-minute dispatch intervals (288 per
 * day). `totalTWh30d` bills a point at 1 hour unless it carries an
 * `intervalHours`, so without this every per-plant energy total read exactly
 * 12x the curtailed MWh. The state aggregate in aemo.json.ts sidesteps the
 * same trap by hourly-averaging before it totals.
 */
const DISPATCH_INTERVAL_HOURS = 5 / 60;

// ─── Per-DUID parsed output ─────────────────────────────────────────────────

interface PerDuidEntry {
  points: CurtailmentPoint[];
  fueltech: AemoFuel;
  duid: string;
  regionCode: string;
}

// ─── CSV parser — bucketed by DUID instead of state ─────────────────────────

/**
 * Parse an AEMO DISPATCH UNIT_SOLUTION CSV and return per-DUID curtailment
 * buckets. Reuses the exact same row-level logic as `parseAemoDispatchCsv` in
 * aemo.json.ts but groups by `${duid}` rather than by state.
 */
export function parseAemoDispatchCsvPerDuid(csv: string): Map<string, PerDuidEntry> {
  const duidBuckets = new Map<string, { points: Map<string, number>; fueltech: AemoFuel; duid: string; regionCode: string }>();
  let headers: string[] = [];
  let sawDataRow = false;
  const lines = csv.replace(/^\uFEFF/, "").trim().split(/\r?\n/);

  for (const line of lines) {
    if (line.startsWith("I,DISPATCH,UNIT_SOLUTION,")) {
      headers = line.split(",").slice(4);
      continue;
    }
    if (!line.startsWith("D,DISPATCH,UNIT_SOLUTION,")) continue;
    sawDataRow = true;
    if (!headers.length) continue;

    const cells = line.split(",");
    const values = cells.slice(4);
    const get = (name: string) => values[headers.indexOf(name)]?.replace(/^"|"$/g, "");
    const localTimestamp = get("SETTLEMENTDATE");
    const duid = get("DUID");
    const totalCleared = Number(get("TOTALCLEARED") || 0);
    const availability = Number(get("AVAILABILITY") || 0);
    const semidispatchCap = Number(get("SEMIDISPATCHCAP") || 0);
    const uigf = Number(get("UIGF") || 0);

    if (!duid || semidispatchCap !== 1) continue;
    const unit = AEMO_UNIT_MAP[duid as keyof typeof AEMO_UNIT_MAP];
    if (!unit) continue;
    const utcTimestamp = localTimestamp ? parseAemoDate(localTimestamp) : null;
    if (!utcTimestamp) continue;

    const unconstrained = Number.isFinite(uigf) && uigf > 0 ? uigf : availability;
    const curtailedMw = Math.max(0, unconstrained - (Number.isFinite(totalCleared) ? totalCleared : 0));
    if (curtailedMw <= 0) continue;

    const tech = (unit as { fueltech?: string }).fueltech;
    if (tech !== "wind" && tech !== "solar") continue;

    // Bucket by DUID
    let bucket = duidBuckets.get(duid);
    if (!bucket) {
      bucket = { points: new Map<string, number>(), fueltech: tech as AemoFuel, duid, regionCode: unit.region };
      duidBuckets.set(duid, bucket);
    }
    bucket.points.set(utcTimestamp, (bucket.points.get(utcTimestamp) ?? 0) + curtailedMw);
  }

  // Silent-zero guard
  if (sawDataRow && !headers.length) {
    throw new Error(
      "AEMO CSV: data rows present but no I,DISPATCH,UNIT_SOLUTION, header line found — upstream format may have changed.",
    );
  }

  // Convert internal Map<timestamp, mw> → CurtailmentPoint[]
  const result = new Map<string, PerDuidEntry>();
  for (const [duid, bucket] of duidBuckets) {
    const sortedPoints = Array.from(bucket.points.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw, intervalHours: DISPATCH_INTERVAL_HOURS }));
    result.set(duid, {
      points: sortedPoints,
      fueltech: bucket.fueltech,
      duid: bucket.duid,
      regionCode: bucket.regionCode,
    });
  }
  return result;
}

// ─── CSV unzip (same as aemo.json.ts) ───────────────────────────────────────

function unzipCsv(zipBytes: Uint8Array): string {
  const dir = mkdtempSync(join(tmpdir(), "aemo-plant-"));
  const zipPath = join(dir, "report.zip");
  try {
    writeFileSync(zipPath, zipBytes);
    return execFileSync("unzip", ["-p", zipPath], { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function listRecentZips(html: string, limit = 30): string[] {
  const DIRECTORY_URL = "https://nemweb.com.au/Reports/Current/Next_Day_Dispatch/";
  const matches = Array.from(
    html.matchAll(/HREF="([^"]*PUBLIC_NEXT_DAY_DISPATCH_[^"]+\.zip)"/gi),
  ).map((m) => m[1]);
  return matches.slice(-limit).map((href) => new URL(href, DIRECTORY_URL).toString());
}

// ─── Main loader ─────────────────────────────────────────────────────────────

export interface PerPlantRegionData extends RegionData {
  lat: number;
  lon: number;
  duid: string;
  fueltech: AemoFuel;
}

const DIRECTORY_URL = "https://nemweb.com.au/Reports/Current/Next_Day_Dispatch/";

const run = async (): Promise<Record<string, PerPlantRegionData>> => {
  const listing = await fetchText(DIRECTORY_URL);
  const urls = listRecentZips(listing, 30);
  if (!urls.length) throw new Error("AEMO directory listing returned no daily dispatch zips");

  // Accumulate per-DUID points across all 30 days of CSVs
  const duidAccumulator = new Map<string, {
    allPoints: CurtailmentPoint[];
    fueltech: AemoFuel;
    duid: string;
    regionCode: string;
  }>();

  for (const url of urls) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const res = await fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timeout));
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const csv = unzipCsv(new Uint8Array(await res.arrayBuffer()));
    const parsed = parseAemoDispatchCsvPerDuid(csv);

    for (const [duid, entry] of parsed) {
      let acc = duidAccumulator.get(duid);
      if (!acc) {
        acc = { allPoints: [], fueltech: entry.fueltech, duid: entry.duid, regionCode: entry.regionCode };
        duidAccumulator.set(duid, acc);
      }
      acc.allPoints.push(...entry.points);
    }
  }

  // Silent-zero guard: if every DUID accumulated zero points, something is wrong.
  const totalPoints = [...duidAccumulator.values()].reduce((sum, a) => sum + a.allPoints.length, 0);
  if (totalPoints === 0) {
    throw new Error(
      "AEMO per-plant: 30 days of NEMWEB dispatch CSVs produced zero curtailment points — upstream outage or format change. Falling back to last-good snapshot.",
    );
  }

  // `lastUpdated` on a measured-zero plant comes from the feed's most recent
  // curtailment interval rather than wall-clock now, so the region never claims
  // more source freshness than the feed actually has. (`lastSuccessAt` is a
  // different question — "when did this snapshot last refresh successfully" —
  // and withFallback's stampLive correctly restamps it to build time.)
  const feedLatestUtc = [...duidAccumulator.values()].reduce(
    (latest, a) => a.allPoints.reduce((l, p) => (p.utcTimestamp > l ? p.utcTimestamp : l), latest),
    "",
  );

  return buildPerPlantRegions(duidAccumulator, { feedLatestUtc });
};

// ─── Region assembly ─────────────────────────────────────────────────────────

export interface PerDuidAccumulatorEntry {
  allPoints: CurtailmentPoint[];
  fueltech: AemoFuel;
  duid: string;
  regionCode: string;
}

/**
 * Build one RegionData per registry DUID.
 *
 * Registry membership (`PER_PLANT_DUIDS`) is the ONLY gate. aemo.json.ts
 * excludes every registry DUID from its state aggregates unconditionally, so
 * a magnitude filter here would not merely hide a plant — it would delete that
 * plant's curtailment from the dataset, because nothing else counts it. The
 * 0.01 TWh/30d floor this replaced did exactly that to 7 of the 10 plants
 * (verified against a live NEMWEB build, 2026-09-06).
 *
 * A registry DUID that accumulated no points curtailed nothing in the window.
 * SEMIDISPATCHCAP may still have fired on it — being capped is not the same as
 * being constrained below what was available — so this is a measured zero from
 * a demonstrably live feed, and it is emitted as an all-zero region whose
 * `lastUpdated` is the feed's latest interval. `scripts/lib/zero-allowlist.ts`
 * carries the matching exemption for the all-zero snapshot check.
 */
export function buildPerPlantRegions(
  accumulator: ReadonlyMap<string, PerDuidAccumulatorEntry>,
  opts: { feedLatestUtc: string },
): Record<string, PerPlantRegionData> {
  const out: Record<string, PerPlantRegionData> = {};

  for (const duid of PER_PLANT_DUIDS) {
    const acc = accumulator.get(duid);
    const unit: { region: string; fueltech: AemoFuel } | undefined =
      AEMO_UNIT_MAP[duid as keyof typeof AEMO_UNIT_MAP];
    const fueltech: AemoFuel | undefined = acc?.fueltech ?? unit?.fueltech;
    const regionCode = acc?.regionCode ?? unit?.region;
    if (!fueltech || !regionCode) {
      // Throw rather than skip: aemo.json.ts has already excluded this DUID
      // from its state aggregate, so skipping would silently drop the plant.
      // Throwing degrades the loader to its last-good snapshot instead.
      throw new Error(
        `AEMO per-plant: registry DUID ${duid} has no usable AEMO_UNIT_MAP entry, ` +
          `so its region id cannot be derived — and aemo.json.ts has already ` +
          `excluded it from the state aggregate.`,
      );
    }

    const points = acc?.allPoints ?? [];
    const hourlyPoints = hourlyAverage(points);
    const stateCode = REGION_CODE_TO_ID[regionCode] ?? "nsw";
    const opennemCoords = AEMO_DUID_COORDS[duid];
    const coords = opennemCoords
      ?? (STATE_CENTROIDS[stateCode] ?? { lat: -33.0, lon: 145.0 });
    const regionId = `aemo-${duid.toLowerCase()}-${fueltech}`;
    const coordSource = opennemCoords ? "OpenNEM GIS" : `state-centroid fallback (${stateCode})`;
    const observedAt = points.at(-1)?.utcTimestamp ?? opts.feedLatestUtc;

    out[regionId] = {
      regionId,
      profile: timeOfDayAverageGW(hourlyPoints),
      latestProfile: latestCompleteUtcDayProfileGW(points),
      totalTWh: totalTWh30d(points),
      peakGW: peakGW(hourlyPoints),
      lat: coords.lat,
      lon: coords.lon,
      duid,
      fueltech,
      lastUpdated: observedAt,
      lastSuccessAt: observedAt,
      sourceNote:
        `NEMWEB SEMIDISPATCHCAP per-DUID curtailment — ` +
        `${fueltech} plant ${duid} (${regionCode}). ` +
        `Coordinates: ${coordSource}.` +
        (points.length
          ? ""
          : ` Measured zero: the feed is current to ${opts.feedLatestUtc} but this ` +
            `plant recorded no curtailment across the 30-day window.`),
    };
  }

  return out;
}

// ─── CLI entry point ─────────────────────────────────────────────────────────

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<Record<string, PerPlantRegionData>>("aemo-per-plant", run, {
    regionTier: "live" as const,
    tagLive: (r) => Object.fromEntries(
      Object.entries(r).map(([k, v]) => [k, { ...v, sourceStatus: "live" as const }]),
    ) as Record<string, PerPlantRegionData>,
    tagCached: (c) => Object.fromEntries(
      Object.entries(c).map(([k, v]) => [k, { ...v, sourceStatus: "cached" as const }]),
    ) as Record<string, PerPlantRegionData>,
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("aemo-per-plant loader failed", err);
      process.exit(1);
    });
}

// ─── Export for Observable Framework integration ──────────────────────────────
export const buildAemoPerPlantData = () => run();
