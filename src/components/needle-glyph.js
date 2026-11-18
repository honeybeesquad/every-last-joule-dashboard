/**
 * The needle glyph: the globe's quality encoding (redesign plan 6.1), drawn
 * small for the rail rows and the legend so the key matches the marks.
 *
 *   measured  - solid line, solid head
 *   anchored  - solid line, hollow head
 *   estimated - dashed line, solid head
 *   stale     - any of the above plus a dashed warning ring round the head
 *
 * The colour is currentColor, so a `fuel-<fuel>` class (or an inline
 * `color`) picks the fuel token; the ring reads --quality-warning.
 */
export function needleGlyph({ bucket = "measured", stale = false, width = 26 } = {}) {
  const head = width - 5;
  const lineEnd = head - 3;
  const dash = bucket === "estimated" ? ` stroke-dasharray="3 3"` : "";
  const headMark = bucket === "anchored"
    ? `<circle cx="${head}" cy="7" r="3" fill="none" stroke="currentColor" stroke-width="1.4"/>`
    : `<circle cx="${head}" cy="7" r="3.6" fill="currentColor"/>`;
  const ring = stale
    ? `<circle class="needle-glyph-stale" cx="${head}" cy="7" r="5.6" fill="none" stroke-width="1.2" stroke-dasharray="1.6 1.4"/>`
    : "";
  return (
    `<svg class="needle-glyph" width="${width}" height="14" viewBox="0 0 ${width} 14" aria-hidden="true" focusable="false">` +
    `<line x1="2" y1="7" x2="${lineEnd}" y2="7" stroke="currentColor" stroke-width="1.6"${dash}/>` +
    headMark +
    `<circle cx="2" cy="7" r="1.6" fill="currentColor"/>` +
    ring +
    `</svg>`
  );
}
