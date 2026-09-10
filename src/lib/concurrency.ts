/**
 * Bounded-concurrency map. Runs `fn` over `items` with at most `limit` in
 * flight, preserving result order. Rejections propagate after all in-flight
 * work settles, so a caller can still decide per-item fallback by catching
 * inside `fn`.
 *
 * Used by the ENTSO-E loader (52 zones fetched a few at a time instead of
 * serially) and by scripts/build/prefetch-loaders.ts.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const n = Math.max(1, Math.floor(limit));
  const results: R[] = new Array(items.length);
  let next = 0;
  let firstError: unknown;
  let failed = false;

  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = await fn(items[i], i);
      } catch (err) {
        if (!failed) { failed = true; firstError = err; }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  if (failed) throw firstError;
  return results;
}
