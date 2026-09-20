/**
 * brand-mark.ts — the Every Last Joule mark, as generated SVG.
 *
 * One radial histogram: 44 pillars standing off a gold disc, the first 26%
 * of them cyan (the curtailed share). The geometry here is the single source
 * of truth for every rendered brand asset — the page loader's animated mark,
 * the still used under `prefers-reduced-motion`, and the social avatars.
 * `scripts/build/build-mark-assets.ts` writes them; `tests/brand-mark.test.ts`
 * fails if a committed file has drifted from what this module renders.
 *
 * Colours are the site's own tokens, not new ones: GOLD is `--brand`
 * (#ffd05a), GOLD_DIM is `--brand-strong`, CYAN is the Sunfire `--fuel-wind`
 * default. They are literals here because these files are built once and
 * served as static assets, with no document to read custom properties from.
 *
 * The heights are decorative, not data: a fixed hash, identical in every
 * asset, so the mark is always the same shape. It is a logo, not a chart —
 * nothing here claims to plot a region.
 */

export const GOLD = "#ffd05a";
export const GOLD_DIM = "#e6a020";
export const CYAN = "#67e8f9";
export const CYAN_TIP = "#cffafe";
export const GOLD_TIP = "#ffe9a8";
export const GROUND = "#0a0703";

/** Geometry, in the 1000×1000 user space every asset shares. */
export const S = 1000;
export const SPOKES = 44;
export const CYAN_SHARE = 0.26;
export const DISC_R = 0.15 * S;
export const INNER_R = 0.2 * S;
export const REACH = 0.24 * S;
export const PILLAR_W = 16;
export const TICK_W = 12;
export const TICK_H = 18;
export const TICK_TRAVEL = 62;

/**
 * Timing of the "sweep and release" loop, in seconds.
 *
 * Up clockwise from 12 over RISE_WINDOW, hold, then down clockwise from 12
 * over FALL_WINDOW — the recession is the same sweep run again, not a
 * reverse. Each pillar fires a tick from its tip as it starts to drop.
 * The last tick finishes at FALL_START + FALL_WINDOW + TICK_DUR = 6.4s,
 * which is why CYCLE is 6.6s: the ring is empty and still for 0.2s before
 * the loop restarts.
 */
export const CYCLE = 6.6;
export const RISE_DUR = 0.5;
export const RISE_WINDOW = 2.6;
export const HOLD = 0.4;
export const FALL_DUR = 0.45;
export const FALL_WINDOW = 2.0;
export const FALL_START = RISE_WINDOW + RISE_DUR + HOLD;
export const TICK_DUR = 0.9;

export interface Pillar {
  /** Clockwise from 12 o'clock, in degrees. */
  angle: number;
  /** Length in user units, from INNER_R outwards. */
  length: number;
  curtailed: boolean;
  /** Seconds into the cycle at which this pillar starts to rise. */
  riseAt: number;
  /** Seconds into the cycle at which it starts to drop and releases its tick. */
  fallAt: number;
}

/** The fixed hash the pillar heights come from. Deterministic across runtimes. */
function hash(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function pillars(count = SPOKES): Pillar[] {
  const cut = Math.round(count * CYAN_SHARE);
  return Array.from({ length: count }, (_, i) => {
    const t = i / count;
    return {
      angle: t * 360,
      length: (0.3 + hash(i + 5) * 0.7) * REACH,
      curtailed: i < cut,
      riseAt: t * RISE_WINDOW,
      fallAt: FALL_START + t * FALL_WINDOW,
    };
  });
}

const r = (n: number): string => Number(n.toFixed(2)).toString();

/**
 * keyTimes are fractions of the cycle and must never decrease. Four decimal
 * places, not two: the first pillar starts at 0.0005 of the cycle, and
 * rounding that to 0 would leave two identical times in the list.
 */
const at = (seconds: number): string =>
  Number(Math.min(1, seconds / CYCLE).toFixed(4)).toString();

function pillarGroup(p: Pillar, body: string): string {
  // Rotate to the pillar's angle, then move the origin to its base on the
  // globe edge, so an animated scale grows it outwards instead of moving it.
  return (
    `<g transform="rotate(${r(p.angle)} ${S / 2} ${S / 2}) translate(${S / 2} ${r(S / 2 - INNER_R)})">` +
    body +
    `</g>`
  );
}

function pillarRect(p: Pillar, extra = ""): string {
  const fill = p.curtailed ? CYAN : GOLD_DIM;
  const opacity = p.curtailed ? "0.95" : "0.55";
  return (
    `<rect x="${-PILLAR_W / 2}" y="${r(-p.length)}" width="${PILLAR_W}" height="${r(p.length)}"` +
    ` rx="${PILLAR_W / 2}" fill="${fill}" opacity="${opacity}">${extra}</rect>`
  );
}

/**
 * SMIL rather than CSS keyframes: every pillar shares one 6.6s cycle but
 * enters and leaves at its own moment, which needs per-element keyTimes.
 * CSS can only stagger with a delay, which would smear the reset. SMIL also
 * runs inside an <img>, so the loader paints and animates before any script.
 */
function scaleAnimation(p: Pillar): string {
  const up0 = Math.max(p.riseAt / CYCLE, 0.0005);
  const up0s = Number(up0.toFixed(4)).toString();
  const up1 = at(p.riseAt + RISE_DUR);
  const down0 = at(p.fallAt);
  const down1 = at(p.fallAt + FALL_DUR);
  return (
    `<animateTransform attributeName="transform" type="scale"` +
    ` dur="${CYCLE}s" repeatCount="indefinite" calcMode="spline"` +
    ` values="1 0;1 0;1 1;1 1;1 0;1 0"` +
    ` keyTimes="0;${up0s};${up1};${down0};${down1};1"` +
    ` keySplines="0 0 1 1;.16 1 .3 1;0 0 1 1;.65 0 .85 .2;0 0 1 1"/>`
  );
}

function tick(p: Pillar): string {
  const fill = p.curtailed ? CYAN_TIP : GOLD_TIP;
  const start = at(p.fallAt);
  const lit = at(p.fallAt + TICK_DUR * 0.12);
  const gone = at(p.fallAt + TICK_DUR);
  return (
    `<rect x="${-TICK_W / 2}" y="${r(-p.length - 4)}" width="${TICK_W}" height="${TICK_H}"` +
    ` rx="${TICK_W / 2}" fill="${fill}" opacity="0">` +
    `<animate attributeName="opacity" dur="${CYCLE}s" repeatCount="indefinite"` +
    ` values="0;0;0.95;0;0" keyTimes="0;${start};${lit};${gone};1"/>` +
    `<animateTransform attributeName="transform" type="translate"` +
    ` dur="${CYCLE}s" repeatCount="indefinite"` +
    ` values="0 0;0 0;0 ${-TICK_TRAVEL};0 ${-TICK_TRAVEL}"` +
    ` keyTimes="0;${start};${gone};1"/>` +
    `</rect>`
  );
}

function disc(): string {
  return `<circle cx="${S / 2}" cy="${S / 2}" r="${r(DISC_R)}" fill="${GOLD}"/>`;
}

/** The dark round ground an avatar needs; the loader sits on the page itself. */
function ground(): string {
  return (
    `<defs><radialGradient id="glow" cx="50%" cy="50%" r="50%">` +
    `<stop offset="0%" stop-color="${GOLD}" stop-opacity="0.28"/>` +
    `<stop offset="55%" stop-color="${GOLD_DIM}" stop-opacity="0.09"/>` +
    `<stop offset="100%" stop-color="${GOLD}" stop-opacity="0"/>` +
    `</radialGradient></defs>` +
    `<circle cx="${S / 2}" cy="${S / 2}" r="${S / 2}" fill="${GROUND}"/>` +
    `<circle cx="${S / 2}" cy="${S / 2}" r="${S / 2}" fill="url(#glow)"/>`
  );
}

export interface MarkOptions {
  /** Paint the dark disc and glow behind the mark (avatars); loader is transparent. */
  withGround?: boolean;
  /** Frozen at full ring, no ticks — the still avatar and the reduced-motion loader. */
  still?: boolean;
  /** Rendered size in px; the viewBox is always 1000×1000. */
  size?: number;
  title: string;
}

export function renderMark(options: MarkOptions): string {
  const { withGround = false, still = false, size = 1000, title } = options;
  const parts = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}"` +
      ` width="${size}" height="${size}" role="img" aria-label="${title}">`,
    `<title>${title}</title>`,
  ];
  if (withGround) parts.push(ground());
  for (const p of pillars()) {
    parts.push(
      pillarGroup(p, still ? pillarRect(p) : pillarRect(p, scaleAnimation(p)) + tick(p)),
    );
  }
  parts.push(disc(), `</svg>`, ``);
  return parts.join("\n");
}


/* ────────────────────────────────────────────────────────────────────────
 * The loading screen's mark: HTML elements + CSS transforms, not SVG.
 *
 * It was SMIL inside an <img>, which is driven by the MAIN THREAD. On the
 * loading screen the main thread is saturated — ~135 data files arriving,
 * parsing, the globe initialising — so the mark froze a few hundred
 * milliseconds in (right after the cyan arc) and only jumped to a full ring
 * once the work finished. Measured: during a 4s synthetic block the SMIL
 * version rendered a bare disc the whole time.
 *
 * CSS transform/opacity animations on HTML elements are composited off the
 * main thread, so they keep running no matter what the page is doing. That is
 * the whole point of this screen's animation: it is a sign of life, and it has
 * to be truthful about being alive.
 *
 * Each pillar gets its OWN @keyframes rule, which is what buys the
 * choreography: every pillar shares one 6.6s period with zero delay, so the
 * cycle restarts for all of them at the same instant, while its own keyframe
 * percentages place its rise, its fall and its tick inside that cycle. A
 * shared keyframe plus animation-delay cannot do this — the delay shifts each
 * pillar's cycle boundary too, which smears the reset into a second wave.
 * ──────────────────────────────────────────────────────────────────────── */

/** Percentage of the cycle, as a keyframe selector. */
const pct = (seconds: number): string =>
  Number(((seconds / CYCLE) * 100).toFixed(3)).toString();

/** The markup: geometry and timing live in the stylesheet, keyed by class. */
export function markLoaderHtml(): string {
  const pillars_ = pillars();
  const bars = pillars_.map((_, i) => `<i class="p${i}"><b></b></i>`).join("");
  return `<div class="loader-mark" aria-hidden="true">${bars}<u></u></div>`;
}

/**
 * The stylesheet block: one rule + one keyframes per pillar, plus its tick.
 *
 * Every length is in `em`, where 1em is the mark's diameter — so the whole
 * thing scales from a single font-size (148px on desktop, 112px on phones)
 * with no wrapper transform to fight the layout.
 */
export function markLoaderCss(): string {
  const out: string[] = [];
  const em = (userUnits: number): string => Number((userUnits / S).toFixed(4)) + "em";

  out.push(
    `.loader-mark{position:relative;width:1em;height:1em;flex-shrink:0;line-height:0}`,
    `.loader-mark u{position:absolute;left:50%;top:50%;width:${em(DISC_R * 2)};height:${em(DISC_R * 2)};` +
      `margin:${em(-DISC_R)} 0 0 ${em(-DISC_R)};border-radius:50%;background:${GOLD}}`,
    `.loader-mark i{position:absolute;left:50%;top:50%;width:${em(PILLAR_W)};margin-left:${em(-PILLAR_W / 2)}}`,
    `.loader-mark b{display:block;width:100%;height:100%;border-radius:${em(PILLAR_W / 2)};` +
      `transform-origin:50% 100%;transform:scaleY(0);animation-duration:${CYCLE}s;` +
      `animation-timing-function:linear;animation-iteration-count:infinite}`,
    `.loader-mark i::after{content:"";position:absolute;left:0;top:${em(-TICK_H - 4)};width:100%;` +
      `height:${em(TICK_H)};border-radius:${em(PILLAR_W / 2)};opacity:0;animation-duration:${CYCLE}s;` +
      `animation-timing-function:cubic-bezier(.25,.6,.5,1);animation-iteration-count:infinite}`,
  );

  pillars().forEach((p, i) => {
    const fill = p.curtailed ? CYAN : GOLD_DIM;
    const alpha = p.curtailed ? "0.95" : "0.55";
    const tickFill = p.curtailed ? CYAN_TIP : GOLD_TIP;
    out.push(
      // The bar's top-centre sits on the mark's centre (left/top 50% plus the
      // negative margin), so that is the pivot: `50% 0`. Anything else rotates
      // each bar about a point off the centre and the ring comes apart.
      // Composed right-to-left: lift the bar out to its radius, then rotate.
      `.loader-mark .p${i}{height:${em(p.length)};transform-origin:50% 0;` +
        `transform:rotate(${r(p.angle)}deg) translateY(${em(-INNER_R - p.length)})}`,
      `.loader-mark .p${i} b{background:${fill};opacity:${alpha};animation-name:elj-p${i}}`,
      `.loader-mark .p${i}::after{background:${tickFill};animation-name:elj-t${i}}`,
      // Easing is declared inside the keyframe that STARTS each segment, which
      // is how the A6 curves survive: ease-out on the way up, ease-in down.
      // (A stop at 0% would repeat as "0%,0%" for the first pillar.)
      `@keyframes elj-p${i}{${pct(p.riseAt) === "0" ? "0%" : `0%,${pct(p.riseAt)}%`}` +
        `{transform:scaleY(0);animation-timing-function:cubic-bezier(.16,1,.3,1)}` +
        `${pct(p.riseAt + RISE_DUR)}%,${pct(p.fallAt)}%` +
        `{transform:scaleY(1);animation-timing-function:cubic-bezier(.65,0,.85,.2)}` +
        `${pct(p.fallAt + FALL_DUR)}%,100%{transform:scaleY(0)}}`,
      `@keyframes elj-t${i}{${pct(p.fallAt) === "0" ? "0%" : `0%,${pct(p.fallAt)}%`}{transform:translateY(0);opacity:0}` +
        `${pct(p.fallAt + TICK_DUR * 0.12)}%{opacity:0.95}` +
        `${pct(p.fallAt + TICK_DUR)}%,100%{transform:translateY(${em(-TICK_TRAVEL)});opacity:0}}`,
    );
  });

  // Reduced motion: hold the full ring, no sweep, no ticks.
  out.push(
    `@media (prefers-reduced-motion: reduce){`,
    `.loader-mark b{animation:none;transform:scaleY(1)}`,
    `.loader-mark i::after{animation:none;opacity:0}}`,
  );
  return out.join("\n");
}

/** Every generated asset, keyed by its path under `src/`. */
export function markAssets(): Record<string, string> {
  return {
    "brand/mark-loop.svg": renderMark({
      title: "Every Last Joule",
      size: 400,
    }),
    "brand/mark-still.svg": renderMark({
      title: "Every Last Joule",
      size: 400,
      still: true,
    }),
    "brand/avatar-loop.svg": renderMark({
      title: "Every Last Joule",
      size: 1000,
      withGround: true,
    }),
    "brand/avatar-still.svg": renderMark({
      title: "Every Last Joule",
      size: 1000,
      withGround: true,
      still: true,
    }),
  };
}
