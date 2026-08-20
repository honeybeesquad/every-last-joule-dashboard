import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { RegionData, RegionTier, SourceStatus } from "./types.js";
import { REGIONS } from "./regions.js";
import { applyUncertainty } from "./uncertainty.js";
import { stampSourceProvenance } from "./source-provenance.js";

export const DEFAULT_STALENESS_THRESHOLD_HOURS = 24;

/**
 * Per-region tier lookup, built from the canonical REGIONS table. Used by
 * `enrichWithTier` so multi-region loaders that pass a single loader-level
 * `regionTier` (e.g. entsoe → "live") still emit per-sub-region tier
 * metadata when the canonical table classifies a sub-region differently
 * (e.g. switzerland → "live-neighbour-anchored", italy-sardinia →
 * "live-domestic-anchored"). See `docs/proposals/b4-option-b-decision.md`.
 */
const REGION_TIER_BY_ID: Record<string, RegionTier> = Object.fromEntries(
  REGIONS.map((r) => [r.id, r.tier]),
);

/**
 * Resilience wrapper. Runs fetchFn, writes its output to a snapshot, and
 * falls back to the snapshot if fetchFn throws.
 *
 * `cacheName` must be filesystem-safe (kebab-case, no slashes).
 * `tagSourceStatus` can set sourceStatus on the result before caching.
 * For multi-region outputs, tagSourceStatus should tag every sub-region.
 *
 * When `regionTier` is provided, the result is additionally enriched with
 * `confidenceTier`, `uncertaintyLowGW`, and `uncertaintyHighGW` via
 * `applyUncertainty` before being cached. This guarantees that the snapshot
 * JSON carries tier metadata even when the loader didn't explicitly call
 * `applyUncertainty` itself (e.g. live-feed loaders that return a bare
 * RegionData). Enrichment is idempotent — sub-regions that already carry
 * `confidenceTier` are left untouched, preserving any loader-specific
 * profileKind classification (e.g. the typical-profile builders set their
 * own T3 tier).
 */
export interface WithFallbackOptions<T> {
  /** Tag sourceStatus on the fresh result. Returns the (possibly-mutated) result. */
  tagLive?: (result: T) => T;
  /** Tag sourceStatus on a cached result. Returns the (possibly-mutated) result. */
  tagCached?: (cached: T) => T;
  /**
   * Loader-level default `Region.tier` value for this loader. When set, the
   * output is enriched with confidenceTier/uncertaintyLow/HighGW at the
   * cache boundary. Idempotent — already-tiered sub-regions are left
   * untouched.
   *
   * Multi-region loaders pass the most-common tier here (typically "live"
   * for ENTSO-E etc.); per-sub-region overrides are pulled from the
   * canonical REGIONS table by id, so the entsoe loader still emits the
   * correct T1b/T1c sub-tiers for italy-sardinia/netherlands/baltics/
   * italy-north-zone/switzerland.
   */
  regionTier?: RegionTier;
  /**
   * Maximum age of a last-good snapshot before a cache fallback is labelled
   * degraded instead of cached. Defaults to 24h.
   */
  stalenessThresholdHours?: number;
  /** Test seam for deterministic cache-age classification. */
  now?: () => Date;
}

/**
 * Type-guard: detect RegionData by presence of both `regionId` and `profile`.
 * Used to decide whether a fetchFn output is a single RegionData or a
 * `Record<string, RegionData>`. Both shapes occur in this codebase.
 */
function isRegionData(value: unknown): value is RegionData {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { regionId?: unknown }).regionId === "string" &&
    Array.isArray((value as { profile?: unknown }).profile)
  );
}

/**
 * Apply uncertainty fields to every RegionData reachable from `value`,
 * preserving any that already carry `confidenceTier` (idempotent).
 *
 * The loader passes one default `regionTier`; for each sub-region we
 * prefer the canonical REGIONS-table entry by id when available so
 * loaders don't have to thread per-region tier metadata explicitly.
 */
function enrichWithTier<T>(value: T, defaultTier: RegionTier): T {
  if (value == null || typeof value !== "object") return value;

  if (isRegionData(value)) {
    if (value.confidenceTier) return value;
    const tier = REGION_TIER_BY_ID[value.regionId] ?? defaultTier;
    return applyUncertainty(value, { regionTier: tier }) as unknown as T;
  }

  // Record<string, RegionData> case: walk each sub-region.
  const record = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  let touched = false;
  for (const [k, v] of Object.entries(record)) {
    if (isRegionData(v) && !v.confidenceTier) {
      // Prefer regionId on the payload; fall back to the record key (=id)
      // when the sub-region object is missing one (defensive).
      const id = v.regionId ?? k;
      const tier = REGION_TIER_BY_ID[id] ?? defaultTier;
      out[k] = applyUncertainty(v, { regionTier: tier });
      touched = true;
    } else {
      out[k] = v;
    }
  }
  return (touched ? (out as unknown as T) : value);
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTimestampCarrier(value: unknown): value is Record<string, unknown> {
  return isObjectRecord(value) && (
    "sourceStatus" in value ||
    "lastSuccessAt" in value ||
    "lastUpdated" in value
  );
}

function normalizeIso(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : undefined;
}

function cacheTimestamp(value: Record<string, unknown>, fallbackIso: string): string {
  return normalizeIso(value.lastSuccessAt) ?? normalizeIso(value.lastUpdated) ?? fallbackIso;
}

function cachedStatus(lastSuccessAt: string, now: Date, thresholdHours: number): SourceStatus {
  const last = new Date(lastSuccessAt).getTime();
  const ageMs = now.getTime() - last;
  if (Number.isFinite(ageMs) && ageMs > thresholdHours * 60 * 60 * 1000) return "degraded";
  return "cached";
}

function mapSnapshotLike<T>(
  value: T,
  mapper: (record: Record<string, unknown>) => Record<string, unknown>,
): T {
  if (!isObjectRecord(value)) return value;

  if (isRegionData(value) || isTimestampCarrier(value)) {
    return mapper(value as Record<string, unknown>) as T;
  }

  const out: Record<string, unknown> = {};
  let touched = false;
  for (const [k, v] of Object.entries(value)) {
    if (isRegionData(v) || isTimestampCarrier(v)) {
      out[k] = mapper(v as Record<string, unknown>);
      touched = true;
    } else {
      out[k] = v;
    }
  }
  return (touched ? out : value) as T;
}

function stampLive<T>(value: T, nowIso: string): T {
  return mapSnapshotLike(value, (record) => {
    // Preserve "cached"/"degraded" status that a multi-region run() set
    // internally for zones that fell back to their own cached data. Overwriting
    // those with "live" would misrepresent stale sub-regions as live.
    if (record.sourceStatus === "cached" || record.sourceStatus === "degraded") {
      return record;
    }
    // A modelled (T3) region has no verified live upstream feed — its payload is
    // a typical-shape profile scaled to an anchor, not a fresh fetch. Stamping
    // it "live" would violate the repo's honesty contract (CLAUDE.md rule 3 /
    // AGENTS.md data-contract boundaries) and light the "live" dot on the
    // globe for data that was never fetched live. Keep it as "cached" (modelled
    // proxy computed this build) so the freshness badge and legend are truthful.
    // This also catches the ~75 loaders that swallow a live-fetch error and
    // return a modelled fallback: withFallback would otherwise stamp that
    // fallback "live".
    if (record.confidenceTier === "T3-modelled") {
      return { ...record, sourceStatus: "cached", lastSuccessAt: nowIso };
    }
    return {
      ...record,
      sourceStatus: "live",
      lastSuccessAt: nowIso,
    };
  });
}

function stampCached<T>(value: T, now: Date, thresholdHours: number): T {
  const fallbackIso = now.toISOString();
  return mapSnapshotLike(value, (record) => {
    const lastSuccessAt = cacheTimestamp(record, fallbackIso);
    return {
      ...record,
      sourceStatus: cachedStatus(lastSuccessAt, now, thresholdHours),
      lastSuccessAt,
    };
  });
}

export async function withFallback<T>(
  cacheName: string,
  fetchFn: () => Promise<T>,
  opts: WithFallbackOptions<T> = {},
): Promise<T> {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(cacheName)) {
    throw new Error(`invalid cacheName "${cacheName}" - must be kebab-case`);
  }

  const cacheDir = join(process.cwd(), "data", "snapshots", "last-good");
  const cachePath = join(cacheDir, `${cacheName}.json`);
  const now = opts.now?.() ?? new Date();
  const stalenessThresholdHours = opts.stalenessThresholdHours ?? DEFAULT_STALENESS_THRESHOLD_HOURS;

  try {
    const fresh = await fetchFn();
    let tagged = opts.tagLive ? opts.tagLive(fresh) : fresh;
    if (opts.regionTier) tagged = enrichWithTier(tagged, opts.regionTier);
    tagged = stampLive(tagged, now.toISOString());
    tagged = stampSourceProvenance(tagged);

    try {
      mkdirSync(cacheDir, { recursive: true });
      writeFileSync(cachePath, JSON.stringify(tagged));
    } catch (writeErr) {
      console.error(
        `[${cacheName}] snapshot write failed (non-fatal): ${(writeErr as Error).message}`,
      );
    }

    return tagged;
  } catch (err) {
    const msg = (err as Error).message;
    console.error(`[${cacheName}] live fetch failed: ${msg}`);

    if (!existsSync(cachePath)) {
      console.error(`[${cacheName}] no cached snapshot at ${cachePath}; re-throwing`);
      throw err;
    }

    console.warn(`[${cacheName}] falling back to cached snapshot at ${cachePath}`);
    const cached = JSON.parse(readFileSync(cachePath, "utf8")) as T;
    let tagged = opts.tagCached ? opts.tagCached(cached) : cached;
    if (opts.regionTier) tagged = enrichWithTier(tagged, opts.regionTier);
    tagged = stampCached(tagged, now, stalenessThresholdHours);
    tagged = stampSourceProvenance(tagged);
    return tagged;
  }
}
