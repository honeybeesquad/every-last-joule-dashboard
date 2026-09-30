import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "url";
import { mapWithConcurrency } from "../lib/concurrency.js";
import { buildEiaIsoRegionPerFuel, type EiaIsoConfig } from "../lib/eia-iso.js";
import { withFallback } from "../lib/resilient.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import type { RegionData } from "../lib/types.js";
import { unpublishedEmptyRegion } from "../lib/waste-status.js";

/**
 * Remaining EIA-930 balancing authorities with VRE generation and no
 * published BA curtailment rate. Generation is collected; waste is unpublished.
 * Replaces the typical-shape `florida` and `tva` stubs.
 *
 * SPA (Southwestern Power Administration) is not listed. EIA-930 carries only
 * hydro (WAT) for it, and no wind or solar row at any hour since it began
 * reporting (checked 30 Sep 2026), so there is no VRE series to collect. It
 * was listed until then, and every build published its empty records under the
 * retired-feed error.
 *
 * A balancing authority whose fetch fails is never published as current. Its
 * records are the last-good copy, or, when there is none, records with no
 * generation series. Either way they are `degraded` and keep the time of the
 * last real fetch: see `failedBa`.
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
type Served = "live" | "last-good" | "unavailable";

/**
 * The time given to a record that has never been fetched: the epoch, which is
 * also `coerceLastSuccessAt`'s stand-in for an unknown time. Parseable, so
 * `withFallback`'s cache path reads it as ancient and labels it degraded rather
 * than stamping it with the build time.
 */
export const NEVER_FETCHED_AT = "1970-01-01T00:00:00.000Z";

/**
 * How old a last-good copy may be and still stand in for a failed fetch. The
 * series it holds is a trailing 30-day window, so a copy older than that
 * describes a window that has rolled off entirely: it is no longer a stale
 * version of the current window but a record of an earlier one.
 */
export const LAST_GOOD_MAX_AGE_DAYS = 30;

const DAY_MS = 24 * 3_600_000;
const FUTURE_TOLERANCE_MS = 3_600_000;

/** Where a served copy's note records that its fetch failed; the original note precedes it. */
const FAILED_MARK = " [fetch failed this build";

function stampEstimated(pair: Pair): Pair {
  return {
    wind: applyUncertainty(pair.wind, { regionTier: "estimated", profileKind: "wind" }),
    solar: applyUncertainty(pair.solar, { regionTier: "estimated", profileKind: "solar" }),
  };
}

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
 * series, fetched within `LAST_GOOD_MAX_AGE_DAYS`. The stand-in records this
 * loader publishes when nothing can be served carry no series, so they never
 * qualify.
 */
function usableLastGood(prev: RegionData | undefined, now: Date): RegionData | null {
  if (!prev) return null;
  const series = prev.generationProfile;
  const hasSeries =
    Array.isArray(series) &&
    series.length === 24 &&
    series.every((gw) => Number.isFinite(gw)) &&
    Number.isFinite(prev.generationTotalTWh);
  if (!hasSeries) return null;
  // Snapshots from before this loader marked its failures hold a zero series
  // under this note; a zero from a failed fetch is not a measurement.
  if (/generation fetch failed \(/.test(prev.sourceNote ?? "")) return null;
  const ageMs = now.getTime() - Date.parse(prev.lastSuccessAt);
  if (!Number.isFinite(ageMs) || ageMs > LAST_GOOD_MAX_AGE_DAYS * DAY_MS || ageMs < -FUTURE_TOLERANCE_MS) return null;
  return prev;
}

/**
 * The last-good record, unchanged but for its status and note. `degraded`
 * whatever its age: withFallback's "cached" already means a modelled record
 * built this run, so a copy from an earlier run must not share it. Its times
 * stay those of the fetch that produced it, so a copy served again next build
 * keeps ageing towards `LAST_GOOD_MAX_AGE_DAYS`.
 */
function staleCopy(prev: RegionData, reason: string): RegionData {
  const original = prev.sourceNote ?? "";
  const cut = original.indexOf(FAILED_MARK);
  const note = cut >= 0 ? original.slice(0, cut) : original;
  return {
    ...prev,
    sourceStatus: "degraded",
    sourceNote: `${note}${FAILED_MARK} (${reason}); serving the copy fetched ${prev.lastSuccessAt}]`,
  };
}

/**
 * A record for a BA with nothing to serve. Waste is unpublished for every
 * record of this loader, so its 24 zeros keep meaning "no figure". Generation
 * is different: a zero would claim a measurement of no output, so the series is
 * left out and the record does not count as TSO-collected.
 */
function unavailable(regionId: string, respondent: string, reason: string): RegionData {
  const note =
    `EIA-930 ${respondent}: fetch failed this build (${reason}) and there is no usable earlier copy ` +
    `(none, or older than ${LAST_GOOD_MAX_AGE_DAYS} days), so no generation is shown. wasteStatus unpublished — missing ≠ zero.`;
  const { generationProfile: _series, generationTotalTWh: _total, ...noSeries } =
    unpublishedEmptyRegion(regionId, note, NEVER_FETCHED_AT);
  return { ...noSeries, sourceStatus: "degraded" };
}

/**
 * What to publish for a BA whose fetch failed: its last-good copy when both
 * fuels have a usable one, else records with no generation. Never a fresh
 * zero: the failure used to become zero-generation records stamped `cached`
 * with the build time, which nothing could tell from a BA that worked.
 */
function failedBa(
  config: EiaIsoConfig,
  reason: string,
  lastGood: Record<string, RegionData>,
  now: Date,
): { pair: Pair; served: Exclude<Served, "live"> } {
  const wind = usableLastGood(lastGood[`${config.regionId}-wind`], now);
  const solar = usableLastGood(lastGood[`${config.regionId}-solar`], now);
  if (wind && solar) {
    return { pair: { wind: staleCopy(wind, reason), solar: staleCopy(solar, reason) }, served: "last-good" };
  }
  return {
    pair: {
      wind: unavailable(`${config.regionId}-wind`, config.respondent, reason),
      solar: unavailable(`${config.regionId}-solar`, config.respondent, reason),
    },
    served: "unavailable",
  };
}

export interface EiaVreBasDeps {
  /** Test seam: fetch one BA's records. Defaults to the EIA-930 fetch. */
  fetchPair?: (config: EiaIsoConfig) => Promise<Pair>;
  /** Test seam: the last-good snapshot. Defaults to the committed one. */
  lastGood?: Record<string, RegionData>;
  now?: () => Date;
}

function readLastGood(): Record<string, RegionData> {
  const cachePath = join(process.cwd(), "data", "snapshots", "last-good", "eia-vre-bas.json");
  try {
    return JSON.parse(readFileSync(cachePath, "utf-8")) as Record<string, RegionData>;
  } catch {
    return {}; // no previous cache
  }
}

export async function buildEiaVreBasData(deps: EiaVreBasDeps = {}): Promise<Record<string, RegionData>> {
  const fetchPair = deps.fetchPair ?? ((config: EiaIsoConfig) => buildEiaIsoRegionPerFuel(config).run());
  const lastGood = deps.lastGood ?? readLastGood();
  const now = deps.now ?? (() => new Date());

  const outcomes = await mapWithConcurrency(
    EIA_VRE_BA_CONFIGS,
    4,
    async (config): Promise<{ pair: Pair; served: Served }> => {
      try {
        return { pair: stampEstimated(await fetchPair(config)), served: "live" };
      } catch (err) {
        const reason = describeFetchFailure(err);
        const { pair, served } = failedBa(config, reason, lastGood, now());
        console.warn(
          `[eia-vre-bas] ${config.regionId}: EIA-930 ${config.respondent} fetch failed (${reason}); ` +
            (served === "last-good"
              ? "serving the last-good copy, marked degraded."
              : "no usable last-good copy, so its records carry no generation and are marked degraded."),
        );
        return { pair: stampEstimated(pair), served };
      }
    },
  );

  const out: Record<string, RegionData> = {};
  EIA_VRE_BA_CONFIGS.forEach((config, i) => {
    out[`${config.regionId}-wind`] = outcomes[i].pair.wind;
    out[`${config.regionId}-solar`] = outcomes[i].pair.solar;
  });

  const failed = EIA_VRE_BA_CONFIGS.flatMap((config, i) =>
    outcomes[i].served === "live" ? [] : [`${config.regionId} (${outcomes[i].served})`],
  );
  if (failed.length > 0) {
    console.warn(
      `[eia-vre-bas] ${failed.length} of ${EIA_VRE_BA_CONFIGS.length} balancing authorities failed this build: ${failed.join(", ")}`,
    );
  }
  return out;
}

/** The loader as the build runs it: `buildEiaVreBasData` under withFallback. */
export function loadEiaVreBas(deps: EiaVreBasDeps = {}): Promise<Record<string, RegionData>> {
  return withFallback<Record<string, RegionData>>("eia-vre-bas", () => buildEiaVreBasData(deps), {
    regionTier: "estimated" as const,
    tagLive: (r) => r,
    tagCached: (c) => c as Record<string, RegionData>,
    now: deps.now,
  });
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
