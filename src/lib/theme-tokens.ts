/**
 * Theme-system helpers shared between the globe canvas and JS components.
 *
 * Globe.js paints colours into a 2-D canvas, where `fillStyle` and
 * `strokeStyle` accept rgba(...) strings but NOT bare CSS variable
 * references. We therefore read tokens once at mount + on `themechange`
 * and synthesise rgba(...) strings from them.
 */

/** Parse "#rrggbb" or "rrggbb" → "r,g,b" (decimal, comma-joined). */
export function parseHexToRGB(hex: string): string | null {
  if (typeof hex !== "string") return null;
  const trimmed = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(trimmed)) return null;
  const r = parseInt(trimmed.slice(0, 2), 16);
  const g = parseInt(trimmed.slice(2, 4), 16);
  const b = parseInt(trimmed.slice(4, 6), 16);
  return `${r},${g},${b}`;
}

/** Tokens needed by `globe.js`. Strings as they appear in CSS — caller
 *  decides whether to use directly (rgba), parse (hex), or treat as a
 *  linear-gradient sentinel (some themes ship `--night-overlay` as a
 *  gradient rather than a flat rgba). */
export interface GlobeTokens {
  /** "r,g,b" tuple parsed from --globe-dot-day. */
  dotDayRGB: string;
  /** "r,g,b" tuple parsed from --globe-dot-night. */
  dotNightRGB: string;
  /** Raw value of --globe-border (already an rgba string). */
  border: string;
  /** Hex for the flat night-side ocean fill (--globe-ocean). */
  oceanHex: string;
  /** Hex for the flat daylit-hemisphere ocean fill (--globe-ocean-lit).
   *  Painted over oceanHex inside the 90deg circle around the subsolar
   *  point, so the lit face reads without any gradient. */
  oceanLitHex: string;
  /** Hairline stroked along the day/night boundary (--globe-terminator). */
  terminator: string;
  /** Casing drawn under every pillar and region dot (--globe-keyline) so
   *  fuel colour never merges into the land beneath it. */
  keyline: string;
  /** Hex/colour for the degraded-feed amber warning ring (--quality-warning). */
  qualityWarning: string;
}

/** Read all globe-relevant tokens off the document element in one pass. */
export function readGlobeTokens(rootEl: HTMLElement): GlobeTokens {
  const cs = getComputedStyle(rootEl);
  const get = (name: string) => cs.getPropertyValue(name).trim();
  return {
    dotDayRGB:   parseHexToRGB(get("--globe-dot-day")) ?? "255,248,224",
    dotNightRGB: parseHexToRGB(get("--globe-dot-night")) ?? "201,166,98",
    border:       get("--globe-border")     || "rgba(255,248,224,0.16)",
    oceanHex:     get("--globe-ocean")      || get("--surface-bg-2") || "#15110a",
    oceanLitHex:  get("--globe-ocean-lit")  || "#2e2415",
    terminator:   get("--globe-terminator") || "rgba(255,248,224,0.30)",
    keyline:      get("--globe-keyline")    || "#17110a",
    qualityWarning: get("--quality-warning") || "#f7931a",
  };
}
