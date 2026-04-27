/**
 * Theme-token readers for canvas-painted surfaces.
 *
 * CSS variables resolve only on real DOM nodes — calling
 * getComputedStyle(document.documentElement) once per frame is fine but wasteful;
 * we cache the parsed values and invalidate on the `themechange` window event.
 */

/**
 * Parse "#rrggbb" or "#rgb" or "rgb(...)/rgba(...)" into "r,g,b" string.
 * Returns null on values we can't interpret (e.g. linear-gradient(...)).
 */
export function parseColorToRgb(value) {
  const v = (value ?? "").trim();
  if (!v) return null;
  if (v.startsWith("#")) {
    let hex = v.slice(1);
    if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
    if (hex.length !== 6) return null;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    return `${r},${g},${b}`;
  }
  const m = v.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) return `${m[1]},${m[2]},${m[3]}`;
  return null;
}

/** True when the night-overlay token is a CSS gradient string (Eclipse). */
export function isGradientOverlay(value) {
  return typeof value === "string" && value.trim().startsWith("linear-gradient");
}

/**
 * Sanitise the --pillar-base-alpha token to a 2-char lowercase hex pair.
 * Accepts "aa", "0xAA", or "AA" — anything else falls back to the supplied
 * default so a typo never paints garbage onto the canvas via string concat.
 */
export function sanitisePillarAlpha(raw, fallback = "aa") {
  if (typeof raw !== "string") return fallback;
  const cleaned = raw.trim().toLowerCase().replace(/^0x/, "");
  if (/^[0-9a-f]{2}$/.test(cleaned)) return cleaned;
  return fallback;
}

/**
 * Read the current theme's globe-relevant tokens. Returned object is safe to
 * call in the canvas render path; values are pre-parsed.
 *
 * Shape:
 *   {
 *     dotDay:   "r,g,b"   // for the sun-side dot fill
 *     dotNight: "r,g,b"   // for the night-side dot fill
 *     border:   string    // raw CSS rgba(...) — fed to ctx.strokeStyle directly
 *     dayGrad1: string    // raw CSS rgba(...)
 *     dayGrad2: string
 *     dayGrad3: string
 *     nightOverlay:       string             // raw CSS value (rgba or gradient)
 *     nightOverlayKind:   "color"|"gradient"
 *     pillarBaseAlpha:    "aa"               // 2-char hex appended to fuel hex
 *                                             // for the pillar gradient base stop
 *   }
 */
export function readGlobeTokens(rootEl) {
  const root = rootEl ?? document.documentElement;
  const cs = getComputedStyle(root);
  const get = (name) => cs.getPropertyValue(name).trim();
  const overlayRaw = get("--night-overlay");
  return {
    dotDay:   parseColorToRgb(get("--globe-dot-day"))   ?? "255,248,224",
    dotNight: parseColorToRgb(get("--globe-dot-night")) ?? "201,166,98",
    border:   get("--globe-border")  || "rgba(255,208,90,0.35)",
    dayGrad1: get("--day-gradient-1") || "rgba(255,208,90,0.55)",
    dayGrad2: get("--day-gradient-2") || "rgba(230,160,32,0.25)",
    dayGrad3: get("--day-gradient-3") || "rgba(0,0,0,0)",
    nightOverlay: overlayRaw,
    nightOverlayKind: isGradientOverlay(overlayRaw) ? "gradient" : "color",
    pillarBaseAlpha: sanitisePillarAlpha(get("--pillar-base-alpha"), "aa"),
  };
}