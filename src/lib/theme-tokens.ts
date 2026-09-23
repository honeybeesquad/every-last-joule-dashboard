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
  /** Sphere body gradient stops, lit side to shadow side (--globe-body-*). */
  bodyHi: string;
  bodyMid: string;
  bodyLo: string;
  /** "r,g,b" of the neutral land-dot tint (--globe-dot-neutral). */
  dotNeutralRGB: string;
  /** "r,g,b" of the brand colour, used for the halo and rim (--brand-rgb). */
  brandRGB: string;
  /** Page ink (--ink): the selected-region ring, in both modes. */
  ink: string;
  /** "r,g,b" the light (engraved) globe draws its line screen, stipple,
   *  coastline and limb in (--globe-ink-rgb). */
  inkRGB: string;
  /** Paper colour: the light globe's land knock-out and needle halos (--globe-paper). */
  paper: string;
  /** "r,g,b" of the dark (horizon) globe's atmosphere (--globe-atmosphere-rgb). */
  atmosphereRGB: string;
  /** "r,g,b" of the dark globe's land dots (--globe-land-rgb). */
  landRGB: string;
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
    bodyHi:  get("--globe-body-hi")  || "#4a3414",
    bodyMid: get("--globe-body-mid") || "#1f160a",
    bodyLo:  get("--globe-body-lo")  || "#0c0804",
    dotNeutralRGB: parseHexToRGB(get("--globe-dot-neutral")) ?? "228,220,204",
    brandRGB: (get("--brand-rgb") || "255, 208, 90").replace(/\s+/g, ""),
    // The redesign's tokens. Fallbacks are the dark (Horizon) values. The
    // Sunfire-pinned paper figure defines none of the four globe-* ones and
    // never draws with them.
    ink:           get("--ink") || "#F2F5F9",
    inkRGB:        (get("--globe-ink-rgb") || "242, 245, 249").replace(/\s+/g, ""),
    paper:         get("--globe-paper") || "#05070B",
    atmosphereRGB: (get("--globe-atmosphere-rgb") || "110, 190, 255").replace(/\s+/g, ""),
    landRGB:       (get("--globe-land-rgb") || "170, 200, 230").replace(/\s+/g, ""),
  };
}
