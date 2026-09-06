/**
 * Test stub for `observablehq:stdlib`.
 *
 * `src/lib/data-loaders.js` imports `FileAttachment` from this specifier.
 * Observable Framework resolves it at build time and rewrites every
 * `FileAttachment("…")` call into a resolved descriptor; nothing outside the
 * framework can resolve it, so vitest aliases the specifier here (see
 * `vitest.config.ts`) and the registry becomes importable in tests.
 *
 * The stub keeps the literal path on the returned handle, so a test can assert
 * what a row actually points at, and records `.json()` calls so a test can
 * check the fetch fan-out.
 */

export interface StubFileAttachment {
  /** The literal argument the registry passed to FileAttachment(). */
  path: string;
  json: () => Promise<{ stub: true; path: string }>;
}

/** Every `.json()` call made through the stub, in call order. */
export const jsonCalls: string[] = [];

export function FileAttachment(path: string): StubFileAttachment {
  return {
    path,
    async json() {
      jsonCalls.push(path);
      return { stub: true as const, path };
    },
  };
}
