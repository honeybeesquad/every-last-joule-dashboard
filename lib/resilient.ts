import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Resilience wrapper. Runs fetchFn, writes its output to a snapshot, and
 * falls back to the snapshot if fetchFn throws.
 *
 * `cacheName` must be filesystem-safe (kebab-case, no slashes).
 * `tagSourceStatus` can set sourceStatus on the result before caching.
 * For multi-region outputs, tagSourceStatus should tag every sub-region.
 */
export interface WithFallbackOptions<T> {
  /** Tag sourceStatus on the fresh result. Returns the (possibly-mutated) result. */
  tagLive?: (result: T) => T;
  /** Tag sourceStatus on a cached result. Returns the (possibly-mutated) result. */
  tagCached?: (cached: T) => T;
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
    const tagged = opts.tagLive ? opts.tagLive(fresh) : fresh;

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
    return opts.tagCached ? opts.tagCached(cached) : cached;
  }
}
