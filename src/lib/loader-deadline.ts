/**
 * Wall-clock budget for one loader's live fetch. Past it, withFallback aborts
 * every in-flight request and serves the last-good snapshot — the deploy gets
 * a "cached" region instead of a dead build. 2026-09-10: ENTSO-E stalled and
 * its loader alone needed 109 min (126 s × 52 zones), so production builds
 * died at Vercel's 45-minute limit twice in one morning. Override per call
 * with `deadlineMs`, globally with LOADER_DEADLINE_MS; 0 disables.
 *
 * This module has no imports so that scripts/build/prefetch-loaders.ts can
 * read LOADER_DEADLINE_MS with the parser its loaders use (via
 * src/lib/resilient.ts), and so log the deadline they actually run with.
 */
export const DEFAULT_LOADER_DEADLINE_MS = 180_000;

/** The longest delay setTimeout keeps; Node fires a longer one after 1 ms. */
export const MAX_TIMER_MS = 2 ** 31 - 1;

/**
 * A duration in ms from the environment. Unset, blank, or anything but a
 * finite number of 0 or more gives `fallback`; 0 means none; anything longer
 * than MAX_TIMER_MS is cut to it.
 */
export function msFromEnv(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, MAX_TIMER_MS) : fallback;
}

/** LOADER_DEADLINE_MS in ms; 0 means no deadline. */
export function loaderDeadlineMs(raw: string | undefined): number {
  return msFromEnv(raw, DEFAULT_LOADER_DEADLINE_MS);
}

/**
 * When a loader that can return part of its work should stop and return it:
 * this share of the deadline. That leaves the rest in reserve for the requests
 * it aborts to unwind (one still in a retry backoff finishes it first, a few
 * seconds at most) and for withFallback's own stamping and snapshot write. At
 * the deadline itself withFallback throws the loader's work away and serves the
 * last-good snapshot whole (ENTSO-E, 29 Sep 2026: 180.1 s, and every zone
 * fetched before it lost). 0 when there is no deadline.
 */
const SOFT_STOP_SHARE = 0.9;

export function softStopMs(deadlineMs: number): number {
  return deadlineMs > 0 ? Math.max(1, Math.floor(deadlineMs * SOFT_STOP_SHARE)) : 0;
}
