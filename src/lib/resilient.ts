import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { RegionData } from "./types.js";
import { applyUncertainty } from "./uncertainty.js";

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
   * Region.tier value for this loader. When set, the output is enriched
   * with confidenceTier/uncertaintyLow/HighGW at the cache boundary.
   * Idempotent — already-tiered sub-regions are left untouched.
   */
  regionTier?: "live" | "static" | "flare";
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
 */
function enrichWithTier<T>(value: T, regionTier: "live" | "static" | "flare"): T {
  if (value == null || typeof value !== "object") return value;

  if (isRegionData(value)) {
    if (value.confidenceTier) return value;
    return applyUncertainty(value, { regionTier }) as unknown as T;
  }

  // Record<string, RegionData> case: walk each sub-region.
  const record = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  let touched = false;
  for (const [k, v] of Object.entries(record)) {
    if (isRegionData(v) && !v.confidenceTier) {
      out[k] = applyUncertainty(v, { regionTier });
      touched = true;
    } else {
      out[k] = v;
    }
  }
  return (touched ? (out as unknown as T) : value);
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

  try {
    const fresh = await fetchFn();
    let tagged = opts.tagLive ? opts.tagLive(fresh) : fresh;
    if (opts.regionTier) tagged = enrichWithTier(tagged, opts.regionTier);

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
    return tagged;
  }
}
