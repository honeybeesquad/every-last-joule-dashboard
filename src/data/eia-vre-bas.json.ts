import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "url";
import { mapWithConcurrency } from "../lib/concurrency.js";
import { buildEiaIsoRegionPerFuel, type EiaIsoConfig } from "../lib/eia-iso.js";
import { UNKNOWN_TIME } from "../lib/freshness.js";
import { withFallback } from "../lib/resilient.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import type { RegionData } from "../lib/types.js";
import { isTsoCollected, unpublishedEmptyRegion } from "../lib/waste-status.js";

/**
 * Remaining EIA-930 balancing authorities (BAs) with VRE generation and no
 * published BA curtailment rate. Generation is collected; waste is unpublished.
 * Replaces the typical-shape `florida` and `tva` stubs.
 *
 * SPA (Southwestern Power Administration) is not listed: EIA-930 has only ever
 * carried hydro for it (checked 30 Sep 2026), so there is no wind or solar to
 * collect.
 *
 * A record whose BA fetch fails is published as its last-good copy or, when
 * none is usable, without a generation series (`failedRecord`). Either way it
 * is `degraded`. When withFallback serves the whole snapshot instead of a run,
 * `loadEiaVreBas` gives every record the same treatment.
 */
export const EIA_VRE_BA_CONFIGS: ReadonlyArray<EiaIsoConfig & { displayName: string }> = [
  { regionId: "tva", respondent: "TVA", displayName: "Tennessee Valley Authority", windRate: 0, solarRate: 0, wasteMode: "unpublished" },
  { regionId: "fpl", respondent: "FPL", displayName: "Florida Power & Light", windRate: 0, solarRate: 0, wasteMode: "unpublished" },
  { regionId: "fpc", respondent: "FPC", displayName: "Duke Energy Florida", windRate: 0, solarRate: 0, wasteMode: "unpublished" },
  { regionId: "tec", respondent: "TEC", displayName: "Tampa Electric", windRate: 0, solarRate: 0, wasteMode: "unpublished" },
  { regionId: "nevp", respondent: "NEVP", displayName: "NV Energy", windRate: 0, solarRate: 0, wasteMode: "unpublished" },
  { regionId: "walc", respondent: "WALC", displayName: "WAPA Desert Southwest", windRate: 0, solarRate: 0, wasteMode: "unpublished" },
  { regionId: "swpw", respondent: "SWPW", displayName: "SPP West (former WACM)", windRate: 0, solarRate: 0, wasteMode: "unpublished" },
  { regionId: "duk", respondent: "DUK", displayName: "Duke Energy Carolinas", windRate: 0, solarRate: 0, wasteMode: "unpublished" },
  { regionId: "cple", respondent: "CPLE", displayName: "Duke Energy Progress East", windRate: 0, solarRate: 0, wasteMode: "unpublished" },
  { regionId: "cplw", respondent: "CPLW", displayName: "Duke Energy Progress West", windRate: 0, solarRate: 0, wasteMode: "unpublished" },
  { regionId: "lgee", respondent: "LGEE", displayName: "LG&E / KU", windRate: 0, solarRate: 0, wasteMode: "unpublished" },
  { regionId: "iid", respondent: "IID", displayName: "Imperial Irrigation District", windRate: 0, solarRate: 0, wasteMode: "unpublished" },
  { regionId: "banc", respondent: "BANC", displayName: "Balancing Authority of Northern California", windRate: 0, solarRate: 0, wasteMode: "unpublished" },
  { regionId: "ldwp", respondent: "LDWP", displayName: "Los Angeles DWP", windRate: 0, solarRate: 0, wasteMode: "unpublished" },
  { regionId: "pnm", respondent: "PNM", displayName: "Public Service New Mexico", windRate: 0, solarRate: 0, wasteMode: "unpublished" },
  { regionId: "epe", respondent: "EPE", displayName: "El Paso Electric", windRate: 0, solarRate: 0, wasteMode: "unpublished" },
  { regionId: "aeci", respondent: "AECI", displayName: "Associated Electric Cooperative", windRate: 0, solarRate: 0, wasteMode: "unpublished" },
  { regionId: "sceg", respondent: "SCEG", displayName: "Dominion Energy South Carolina", windRate: 0, solarRate: 0, wasteMode: "unpublished" },
];

type Pair = { wind: RegionData; solar: RegionData };
type Fuel = "wind" | "solar";

const CACHE_NAME = "eia-vre-bas";

/**
 * How old a last-good copy may be and still stand in for a failed fetch. The
 * series it holds is a trailing 30-day window, so a copy older than that
 * describes a window that has rolled off entirely, which would show a retired
 * BA's output for as long as the snapshot lasts.
 */
export const LAST_GOOD_MAX_AGE_DAYS = 30;

const DAY_MS = 24 * 3_600_000;

/** Where a served copy's note records that its fetch failed; the original note precedes it. */
const FAILED_MARK = " [fetch failed this build";

const estimated = (record: RegionData, fuel: Fuel): RegionData =>
  applyUncertainty(record, { regionTier: "estimated", profileKind: fuel });

/**
 * Why a fetch failed, fit to publish. fetchJSON's HTTP errors quote the request
 * URL, whose query string carries EIA_API_KEY, and the reason goes into a
 * served `sourceNote` and the build log.
 */
export function describeFetchFailure(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return raw.replace(/(api_key=)[^&\s)]*/gi, "$1REDACTED").slice(0, 200);
}

/**
 * A last-good record that can stand in for a failed fetch: a real generation
 * series (finite, 24 points) fetched within `LAST_GOOD_MAX_AGE_DAYS` and not
 * after `now`. The records this loader publishes without a series never
 * qualify.
 */
function usableLastGood(prev: RegionData | undefined, now: Date): RegionData | null {
  if (!prev || typeof prev !== "object") return null;
  if (prev.sourceNote !== undefined && typeof prev.sourceNote !== "string") return null;
  if (!isTsoCollected(prev) || !prev.generationProfile!.every(Number.isFinite)) return null;
  if (!Number.isFinite(prev.generationTotalTWh)) return null;
  // Snapshots from before this loader marked its failures hold a zero series
  // under this note; a zero from a failed fetch is not a measurement.
  if (/generation fetch failed \(/.test(prev.sourceNote ?? "")) return null;
  // An unparseable stamp gives NaN, which fails both comparisons.
  const ageMs = now.getTime() - Date.parse(prev.lastSuccessAt);
  return ageMs >= 0 && ageMs <= LAST_GOOD_MAX_AGE_DAYS * DAY_MS ? prev : null;
}

/**
 * The last-good record, unchanged but for its status and note. `degraded`
 * whatever its age: withFallback's "cached" already means a modelled record
 * built this run, so a copy from an earlier run must not share it. Its times
 * stay those of the fetch that produced it, so a copy served again next build
 * keeps ageing towards `LAST_GOOD_MAX_AGE_DAYS`.
 */
function staleCopy(prev: RegionData, reason: string): RegionData {
  const original = (prev.sourceNote ?? "").split(FAILED_MARK)[0];
  return {
    ...prev,
    sourceStatus: "degraded",
    sourceNote: `${original}${FAILED_MARK} (${reason}); serving the copy fetched ${prev.lastSuccessAt}]`,
  };
}

/**
 * A record with nothing to serve. Waste is unpublished for every record of this
 * loader, so its 24 zeros keep meaning "no figure". Generation is different: a
 * zero would claim a measurement of no output, so the series is left out and
 * the record does not count as TSO-collected. Its times are `UNKNOWN_TIME`.
 */
function unavailable(regionId: string, respondent: string, reason: string): RegionData {
  const note =
    `EIA-930 ${respondent}: fetch failed this build (${reason}) and there is no usable earlier copy of this record ` +
    `(it needs a real series fetched in the last ${LAST_GOOD_MAX_AGE_DAYS} days), so no generation is shown. ` +
    `wasteStatus unpublished — missing ≠ zero.`;
  const { generationProfile: _series, generationTotalTWh: _total, ...noSeries } =
    unpublishedEmptyRegion(regionId, note, UNKNOWN_TIME);
  return { ...noSeries, sourceStatus: "degraded" };
}

/**
 * What to publish for a record whose fetch failed: its last-good copy, or
 * failing that a record with no generation. Never a fresh zero: the failure
 * used to become zero-generation records stamped `cached` with the build time,
 * which nothing could tell from a BA that worked.
 */
function failedRecord(
  regionId: string,
  respondent: string,
  reason: string,
  lastGood: Record<string, RegionData>,
  now: Date,
): RegionData {
  const prev = usableLastGood(lastGood[regionId], now);
  return prev ? staleCopy(prev, reason) : unavailable(regionId, respondent, reason);
}

const asRecord = (value: unknown): Record<string, RegionData> =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, RegionData>) : {};

/** Every record of this loader built from `lastGood` alone: withFallback is serving its snapshot. */
function fromLastGood(lastGood: Record<string, RegionData>, reason: string, now: Date): Record<string, RegionData> {
  const source = asRecord(lastGood);
  const out: Record<string, RegionData> = {};
  for (const config of EIA_VRE_BA_CONFIGS) {
    for (const fuel of ["wind", "solar"] as const) {
      const id = `${config.regionId}-${fuel}`;
      out[id] = estimated(failedRecord(id, config.respondent, reason, source, now), fuel);
    }
  }
  return out;
}

export interface EiaVreBasDeps {
  /** Test seam: fetch one BA's records. Defaults to the EIA-930 fetch. */
  fetchPair?: (config: EiaIsoConfig) => Promise<Pair>;
  /**
   * Test seam: the last-good snapshot. Defaults to the committed one.
   * `loadEiaVreBas` still reads and writes that file through withFallback, at
   * process.cwd(): a test that calls it must point cwd at a temp directory.
   */
  lastGood?: Record<string, RegionData>;
  now?: () => Date;
  /** Test seam: withFallback's deadline in ms. Defaults to LOADER_DEADLINE_MS. */
  deadlineMs?: number;
}

function readLastGood(): Record<string, RegionData> {
  const cachePath = join(process.cwd(), "data", "snapshots", "last-good", `${CACHE_NAME}.json`);
  try {
    return asRecord(JSON.parse(readFileSync(cachePath, "utf-8")));
  } catch (err) {
    // A missing file is ordinary; one that cannot be read or parsed is not.
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn(`[${CACHE_NAME}] ignoring the last-good snapshot, which cannot be read: ${(err as Error).message}`);
    }
    return {};
  }
}

export async function buildEiaVreBasData(deps: EiaVreBasDeps = {}): Promise<Record<string, RegionData>> {
  const fetchPair = deps.fetchPair ?? ((config: EiaIsoConfig) => buildEiaIsoRegionPerFuel(config).run());
  const lastGood = deps.lastGood ?? readLastGood();
  const now = deps.now ?? (() => new Date());
  const failed = new Set<string>();
  let succeeded = 0;
  let firstReason: string | undefined;

  const pairs = await mapWithConcurrency(EIA_VRE_BA_CONFIGS, 4, async (config): Promise<Pair> => {
    try {
      const pair = await fetchPair(config);
      succeeded++;
      return { wind: estimated(pair.wind, "wind"), solar: estimated(pair.solar, "solar") };
    } catch (err) {
      const reason = describeFetchFailure(err);
      // Once withFallback's deadline has passed, every queued fetch is skipped and nobody reads the result.
      if (!reason.startsWith("fetch skipped:")) {
        failed.add(config.regionId);
        firstReason ??= reason;
        console.warn(
          `[${CACHE_NAME}] ${config.regionId}: EIA-930 ${config.respondent} fetch failed (${reason}); ` +
            `its records are marked degraded (last-good copy where one is usable, else no generation).`,
        );
      }
      const at = now();
      return {
        wind: estimated(failedRecord(`${config.regionId}-wind`, config.respondent, reason, lastGood, at), "wind"),
        solar: estimated(failedRecord(`${config.regionId}-solar`, config.respondent, reason, lastGood, at), "solar"),
      };
    }
  });

  // Like the ENTSO-E and Norway loaders: a run in which nothing succeeded is a
  // failed run. withFallback then serves the snapshot without writing over it,
  // where returning these records would store a failure as the new last-good.
  if (succeeded === 0) {
    throw new Error(`All ${EIA_VRE_BA_CONFIGS.length} EIA-930 balancing authorities failed (first error: ${firstReason ?? "none"})`);
  }

  const out: Record<string, RegionData> = {};
  EIA_VRE_BA_CONFIGS.forEach((config, i) => {
    out[`${config.regionId}-wind`] = pairs[i].wind;
    out[`${config.regionId}-solar`] = pairs[i].solar;
  });
  if (failed.size > 0) {
    const ids = EIA_VRE_BA_CONFIGS.filter((c) => failed.has(c.regionId)).map((c) => c.regionId);
    console.warn(`[${CACHE_NAME}] ${ids.length} of ${EIA_VRE_BA_CONFIGS.length} balancing authorities failed this build: ${ids.join(", ")}`);
  }
  return out;
}

/** The loader as the build runs it: `buildEiaVreBasData` under withFallback. */
export function loadEiaVreBas(deps: EiaVreBasDeps = {}): Promise<Record<string, RegionData>> {
  const now = deps.now ?? (() => new Date());
  // Why the run gave way to the snapshot, for the notes. A deadline never
  // reaches the wrapper below, so this is what a deadline reads as.
  let cause = "the loader ran past its deadline";
  return withFallback<Record<string, RegionData>>(
    CACHE_NAME,
    async () => {
      try {
        return await buildEiaVreBasData({ ...deps, now });
      } catch (err) {
        cause = describeFetchFailure(err);
        throw err;
      }
    },
    {
      regionTier: "estimated" as const,
      // Serving the snapshot is the whole loader failing: its records get the
      // rules a BA that failed on its own gets.
      tagCached: (cached) => fromLastGood(cached, cause, now()),
      // `cached` means a modelled record built this run, so a record from an
      // earlier run is `degraded` whatever its age.
      stalenessThresholdHours: 0,
      deadlineMs: deps.deadlineMs,
      now,
    },
  );
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  loadEiaVreBas()
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("eia-vre-bas loader failed", err);
      process.exit(1);
    });
}
