/**
 * Pure geometry/easing helpers for the canvas globe, lifted out of
 * `src/globe.js` so they can be unit-tested in isolation (globe.js itself is a
 * single large closure with no test coverage). These are byte-for-byte the
 * same implementations as the inline originals — extracting them changes no
 * behaviour; it just makes the math testable and reusable.
 *
 * First slice of the globe-split plan (docs/research/2026-06-17-globe-split-plan.md, Step 1).
 */

/** Normalise a longitude into the half-open range (-180, 180]. */
export function wrapLongitude(value: number): number {
  return ((value + 180) % 360 + 360) % 360 - 180;
}

/** Cubic ease-out: fast at the start, decelerating to 0 velocity at t=1. */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
