import { needleGlyph } from "./needle-glyph.js";

/** Rows the "Largest now" rail renders (redesign plan 3: ten in both modes). */
export const RAIL_LIST_LIMIT = 10;

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/**
 * One rail row: rank, needle, name with its data-quality tag, bar and value.
 * CSS shows the parts each mode uses (the bar is the dark dock's).
 *
 * The tag is the list's non-colour statement of what the globe encodes by
 * shape (WCAG 1.4.1, redesign plan 6.1): "est." for an estimated region,
 * "stale" for a live feed more than 24 hours old.
 *
 * @param {{ rank?: number | null, region: { name: string }, fuel: string, bucket: string,
 *   stale?: boolean, value: string, unit?: string, barPct?: number, title?: string,
 *   extraClass?: string }} row
 * @returns {string}
 */
export function hotspotRow({
  rank = null, region, fuel, bucket, stale = false, value, unit = "GW", barPct = 0, title = "", extraClass = "",
}) {
  const tags = [];
  if (bucket === "estimated") tags.push(`<em class="hs-tag">est.</em>`);
  if (stale) tags.push(`<em class="hs-tag hs-tag--stale">stale</em>`);
  const cls = ["hotspot-item", `fuel-${fuel}`, extraClass].filter(Boolean).join(" ");
  const pct = Math.max(0, Math.min(100, Number(barPct) || 0)).toFixed(1);
  return (
    `<li class="${cls}"${title ? ` title="${esc(title)}"` : ""}>` +
    `<span class="hs-rank num-tabular">${rank == null ? "" : String(rank).padStart(2, "0")}</span>` +
    `<span class="hs-needle">${needleGlyph({ bucket, stale })}</span>` +
    `<span class="hotspot-name" title="${esc(region.name)}">${esc(region.name)}${tags.length ? " " + tags.join(" ") : ""}</span>` +
    `<span class="hs-bar" aria-hidden="true"><span style="width:${pct}%"></span></span>` +
    `<span class="hotspot-gw num-tabular">${esc(value)}${unit ? `<span class="hs-unit"> ${esc(unit)}</span>` : ""}</span>` +
    `</li>`
  );
}
