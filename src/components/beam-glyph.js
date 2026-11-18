import { qualityOpacity } from "../lib/region-quality.js";

/**
 * The beam glyph: the dark globe's quality encoding (redesign plan 6.1),
 * drawn small for the legend so the key matches the marks.
 *
 *   measured  - full brightness
 *   anchored  - 0.8
 *   estimated - 0.62, and a dashed core
 *   stale     - any of the above plus a dashed warning ring at the base
 *
 * The colour is currentColor (the legend sets a fuel token); the ring reads
 * --quality-warning.
 */
export function beamGlyph({ bucket = "measured", stale = false } = {}) {
  const q = qualityOpacity(bucket);
  const dash = bucket === "estimated" ? ` stroke-dasharray="2.2 1.6"` : "";
  const ring = stale
    ? `<circle class="beam-glyph-stale" cx="6" cy="13" r="3.4" fill="none" stroke-width="1.1" stroke-dasharray="1.6 1.4"/>`
    : "";
  return (
    `<svg class="beam-glyph" width="12" height="16" viewBox="0 0 12 16" aria-hidden="true" focusable="false">` +
    `<line x1="6" y1="14" x2="6" y2="2.5" stroke="currentColor" stroke-width="4" stroke-linecap="round" opacity="${(0.28 * q).toFixed(2)}"/>` +
    `<line x1="6" y1="14" x2="6" y2="2.5" stroke="currentColor" stroke-width="1.4"${dash} opacity="${q}"/>` +
    `<circle cx="6" cy="2.5" r="1.7" fill="currentColor" opacity="${q}"/>` +
    ring +
    `</svg>`
  );
}
