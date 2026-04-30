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

/**
 * Sanitise the --pillar-base-alpha token to a 2-char lowercase hex pair.
 * Accepts "aa", "0xAA", or "AA" — anything else falls back to the supplied
 * default so a typo never paints garbage onto the canvas via string concat.
 */
export function sanitisePillarAlpha(raw: unknown, fallback: string = "99"): string {
  if (typeof raw !== "string") return fallback;
  const cleaned = raw.trim().toLowerCase().replace(/^0x/, "");
  if (/^[0-9a-f]{2}$/.test(cleaned)) return cleaned;
  return fallback;
}

/** Tokens needed by `globe.js`. Strings as they appear in CSS — caller
 *  decides whether to use directly (rgba), parse (hex), or treat as a
 *  linear-gradient sentinel (Eclipse `--night-overlay`). */
export interface GlobeTokens {
  /** "r,g,b" tuple parsed from --globe-dot-day. */
  dotDayRGB: string;
  /** "r,g,b" tuple parsed from --globe-dot-night. */
  dotNightRGB: string;
  /** Raw value of --globe-border (already an rgba string). */
  border: string;
  /** Raw values of --day-gradient-{1,2,3} (already rgba strings). */
  dayGradient1: string;
  dayGradient2: string;
  dayGradient3: string;
  /** Raw value of --night-overlay. May be an rgba(...) string OR a
   *  linear-gradient(...) descriptor. Caller MUST detect the
   *  linear-gradient form and synthesise a canvas gradient. */
  nightOverlay: string;
  /** Hex for the sphere base fill (--surface-bg-2 is a sensible source). */
  spherebaseHex: string;
  /** 2-char hex pair appended to fuel hex for the pillar-gradient base
   *  stop. Theme-scoped so Vellum's parchment day-side can use a bolder
   *  base than Sunfire/Eclipse. */
  pillarBaseAlpha: string;
}

/** Read all globe-relevant tokens off the document element in one pass. */
export function readGlobeTokens(rootEl: HTMLElement): GlobeTokens {
  const cs = getComputedStyle(rootEl);
  const get = (name: string) => cs.getPropertyValue(name).trim();
  return {
    dotDayRGB:   parseHexToRGB(get("--globe-dot-day")) ?? "255,248,224",
    dotNightRGB: parseHexToRGB(get("--globe-dot-night")) ?? "201,166,98",
    border:       get("--globe-border")     || "rgba(255,208,90,0.35)",
    dayGradient1: get("--day-gradient-1")   || "rgba(255,208,90,0.55)",
    dayGradient2: get("--day-gradient-2")   || "rgba(230,160,32,0.25)",
    dayGradient3: get("--day-gradient-3")   || "rgba(0,0,0,0)",
    nightOverlay: get("--night-overlay")    || "rgba(20,14,5,0.42)",
    spherebaseHex: get("--surface-bg-2")    || "#1a1207",
    pillarBaseAlpha: sanitisePillarAlpha(get("--pillar-base-alpha"), "99"),
  };
}

/** True if the night-overlay token is a CSS gradient descriptor (Eclipse). */
export function isLinearGradientToken(value: string): boolean {
  return /^linear-gradient\s*\(/i.test(value.trim());
}
