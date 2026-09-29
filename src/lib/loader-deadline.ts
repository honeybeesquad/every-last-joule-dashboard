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

/**
 * LOADER_DEADLINE_MS in ms. Unset, empty, or anything but a finite number of
 * 0 or more gives the default; 0 means no deadline.
 */
export function loaderDeadlineMs(raw: string | undefined): number {
  if (raw === undefined || raw === "") return DEFAULT_LOADER_DEADLINE_MS;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_LOADER_DEADLINE_MS;
}
