# Theme system design — Sunfire / Vellum / Eclipse

Date: 2026-04-27 · Status: **awaiting Simon review** · Author: Claude

## Goal

Decouple Every Last Joule's visual identity from its parent brand (Stacked) by introducing a runtime-switchable theme system. Ship three themes — **Sunfire** (default), **Vellum**, **Eclipse** — selectable via a toggle in the app header, persisted to `localStorage`. Lift night-side legibility on the globe at the same time. CSS-variable architecture so future colour or font tweaks are one-edit operations.

The dashboard is a documents-and-presentation reskin: no data-loader logic changes, no methodology revisions, no region additions.

## Background

The current palette is rooted in Stacked's brand teal (`#14afac`, sampled from the parent-brand logo). The dashboard now wants its own identity. During brainstorming Simon ruled out continuing teal as either a brand or data-semantic colour, and ruled out a single-theme reskin in favour of shipping three selectable themes.

Three concepts were explored visually (full mockups in `.superpowers/brainstorm/59067-1777238822/content/palettes-v2.html`):

- **Sunfire** — warm gold brand, ice-cyan renewable data, slab-serif display + sans body. *"The dashboard is about sunlight; sunlight is the brand."*
- **Vellum** — parchment + ink neutrals, signal-blue renewable data, editorial serif throughout. *"Research paper, not tech-startup."*
- **Eclipse** — pure black-and-white magazine spread, magenta renewable data, heavy display serif + neo-grotesque body. *"Sunday print supplement that happens to be live."*

**Aurora** (cool plasma blue) was explicitly rejected as too generic.

## Decisions locked during brainstorming

- **Default theme:** Sunfire.
- **Toggle UI:** three-chip group in the app header. Active chip filled.
- **Persistence:** `localStorage.elj-theme`.
- **No-FOUC:** inline `<head>` script reads localStorage and sets `data-theme` before paint.
- **OS `prefers-color-scheme`:** ignored. All three themes are dark-by-design.
- **BTC orange (`#f7931a`) for flare:** locked across all three themes (data-meaning).
- **Renewable data colour varies per theme:** Sunfire ice-cyan, Vellum ink-blue, Eclipse magenta.
- **Fonts self-hosted** as woff2 in `src/fonts/`. No CDN runtime dependency.
- **Existing Gotham font files** stay in place as fallback during transition; removal is a separate cleanup PR.
- **Light mode, og-image regeneration, favicon update, print stylesheet:** all out of scope.

## Architecture

### CSS variable structure

Every theme is a single block of CSS custom properties scoped to `:root[data-theme="<name>"]`. Themes share token *names*, vary token *values*. Components reference tokens, never literals.

```css
:root[data-theme="sunfire"] {
  /* brand identity */
  --brand:               #ffd05a;
  --brand-strong:        #e6a020;
  --brand-subtle:        rgba(255, 208, 90, 0.10);
  --brand-on:            #150e08;          /* fg on brand colour */

  /* surfaces */
  --surface-bg-1:        #2d1f0e;
  --surface-bg-2:        #1a1207;
  --surface-bg-3:        #0a0703;
  --surface-raised:      #1f160a;
  --hairline:            rgba(255, 248, 224, 0.08);
  --hairline-strong:     rgba(255, 248, 224, 0.16);

  /* foreground */
  --ink:                 #fff8e0;          /* primary text */
  --ink-muted:           rgba(255, 248, 224, 0.65);
  --ink-soft:            rgba(255, 248, 224, 0.40);

  /* data semantics */
  --data-renewable:      #67e8f9;          /* ice cyan */
  --data-renewable-tip:  #cffafe;
  --data-flare:          #f7931a;          /* btc orange — locked */
  --data-flare-tip:      #ffc46d;

  /* fuel breakouts */
  --fuel-solar:          #ffd05a;          /* warm — daytime */
  --fuel-wind:           #67e8f9;          /* ice — moving air */
  --fuel-hydro:          #b8cdff;          /* pale ice — water */

  /* globe */
  --globe-dot-day:       #fff8e0;
  --globe-dot-night:     #c9a662;
  --globe-border:        rgba(255, 208, 90, 0.35);
  --day-gradient-1:      rgba(255, 208, 90, 0.55);
  --day-gradient-2:      rgba(230, 160, 32, 0.25);
  --day-gradient-3:      rgba(0, 0, 0, 0);
  --night-overlay:       rgba(20, 14, 5, 0.42);

  /* state */
  --success:             #5eead4;
  --warning:             #ffb84d;
  --danger:              #f87171;

  /* type */
  --font-display:        "Fraunces", Georgia, "Times New Roman", serif;
  --font-body:           "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  --font-mono:           "IBM Plex Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --display-weight-strong: 800;
  --display-weight-base:   600;
}

:root[data-theme="vellum"] {
  --brand:               #ece4d2;
  --brand-strong:        #b3a684;
  --brand-subtle:        rgba(236, 228, 210, 0.10);
  --brand-on:            #1a1814;

  --surface-bg-1:        #221f1a;
  --surface-bg-2:        #15130f;
  --surface-bg-3:        #0c0b09;
  --surface-raised:      #1c1a16;
  --hairline:            rgba(236, 228, 210, 0.08);
  --hairline-strong:     rgba(236, 228, 210, 0.18);

  --ink:                 #ece4d2;
  --ink-muted:           rgba(236, 228, 210, 0.65);
  --ink-soft:            rgba(236, 228, 210, 0.40);

  --data-renewable:      #4f8cff;          /* ink blue */
  --data-renewable-tip:  #b8cdff;
  --data-flare:          #f7931a;
  --data-flare-tip:      #ffc46d;

  --fuel-solar:          #ece4d2;
  --fuel-wind:           #4f8cff;
  --fuel-hydro:          #6b9bff;

  --globe-dot-day:       #f8f1dc;
  --globe-dot-night:     #a89a76;
  --globe-border:        rgba(236, 228, 210, 0.30);
  --day-gradient-1:      rgba(236, 228, 210, 0.40);
  --day-gradient-2:      rgba(179, 166, 132, 0.20);
  --day-gradient-3:      rgba(0, 0, 0, 0);
  --night-overlay:       rgba(20, 18, 14, 0.40);

  --success:             #4f8cff;
  --warning:             #ffb84d;
  --danger:              #d64545;

  --font-display:        "Spectral", Georgia, "Times New Roman", serif;
  --font-body:           "Spectral", Georgia, "Times New Roman", serif;
  --font-mono:           "IBM Plex Mono", ui-monospace, monospace;
  --display-weight-strong: 700;
  --display-weight-base:   500;
}

:root[data-theme="eclipse"] {
  --brand:               #fafafa;
  --brand-strong:        #d4d4d4;
  --brand-subtle:        rgba(250, 250, 250, 0.08);
  --brand-on:            #050505;

  --surface-bg-1:        #0d0d0d;
  --surface-bg-2:        #050505;
  --surface-bg-3:        #020202;
  --surface-raised:      #111111;
  --hairline:            rgba(250, 250, 250, 0.08);
  --hairline-strong:     rgba(250, 250, 250, 0.18);

  --ink:                 #fafafa;
  --ink-muted:           rgba(250, 250, 250, 0.65);
  --ink-soft:            rgba(250, 250, 250, 0.38);

  --data-renewable:      #ec4899;          /* magenta */
  --data-renewable-tip:  #fbcfe8;
  --data-flare:          #f7931a;
  --data-flare-tip:      #ffc46d;

  --fuel-solar:          #fafafa;
  --fuel-wind:           #ec4899;
  --fuel-hydro:          #f0abfc;

  --globe-dot-day:       #ffffff;
  --globe-dot-night:     #888888;
  --globe-border:        rgba(250, 250, 250, 0.30);
  --day-gradient-1:      rgba(250, 250, 250, 0.40);
  --day-gradient-2:      rgba(212, 212, 212, 0.18);
  --day-gradient-3:      rgba(0, 0, 0, 0);
  --night-overlay:       linear-gradient(135deg, rgba(40, 30, 20, 0.30) 0%, rgba(15, 10, 5, 0.55) 100%);

  --success:             #ec4899;
  --warning:             #ffb84d;
  --danger:              #ff6b6b;

  --font-display:        "Frank Ruhl Libre", Georgia, "Times New Roman", serif;
  --font-body:           "IBM Plex Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  --font-mono:           "IBM Plex Mono", ui-monospace, monospace;
  --display-weight-strong: 900;
  --display-weight-base:   700;
}
```

### No-FOUC inline script

`src/index.md` head emits an inline boot script (synchronous, runs before any paint):

```html
<script>
  (function () {
    var t = localStorage.getItem("elj-theme");
    if (t !== "sunfire" && t !== "vellum" && t !== "eclipse") t = "sunfire";
    document.documentElement.setAttribute("data-theme", t);
  })();
</script>
```

This must be the first executable JS in the document. Observable Framework permits raw `<script>` blocks at the top of a markdown file before any code fence.

### Theme change event contract

When the toggle changes themes, it:

1. Sets `document.documentElement.dataset.theme = newTheme`.
2. Writes `localStorage.setItem("elj-theme", newTheme)`.
3. Dispatches `window.dispatchEvent(new CustomEvent("themechange", { detail: { theme: newTheme } }))`.

Any JS-driven painted surface (currently: `globe.js`) listens for `themechange` and re-reads its tokens via `getComputedStyle(document.documentElement)`. CSS-only consumers update automatically.

## File-by-file change list

| File | Status | Change |
|---|---|---|
| `src/style.css` | modify | Move existing `:root` block contents into `:root[data-theme="sunfire"]`. Add `[data-theme="vellum"]` and `[data-theme="eclipse"]` blocks. Add 14 new `@font-face` declarations (woff2). Replace 5–6 chrome rules referencing legacy `--teal-*` / `--slate-*` directly with new semantic tokens (`--brand`, `--ink`, `--surface-bg-*`). Existing `--teal-*` and `--slate-*` palette scales removed; `--btc-orange` retained as `--data-flare`. |
| `src/globe.js` | modify | Replace 8 hardcoded `rgba(...)` calls with `var(--globe-*)` reads via `getComputedStyle(document.documentElement).getPropertyValue(...)`. Read tokens at mount + on `themechange`. Apply night-side legibility fix (see below). |
| `src/components/region-tooltip.js` | modify | 3 hardcoded colours → tokens (freshness states, hairlines). |
| `src/components/timeline.js` | modify | 4 hardcoded colours → tokens (axis, area fills). |
| `src/lib/fuel.ts` | modify | `FUEL_COLOR` becomes `getFuelColor(fuel: Fuel): string` reading `--fuel-{solar,wind,hydro}` at call time. Existing consumers update to call the function. |
| `src/index.md` | modify | Add inline boot script in head. Mount `<ThemeToggle>` component in app-header. |
| `src/components/theme-toggle.js` | **new** | Three-chip toggle. See spec below. |
| `src/fonts/Fraunces-*.woff2` | **new** | 3 weights × 1 style = 3 files. |
| `src/fonts/Inter-*.woff2` | **new** | 3 weights × 1 style = 3 files. |
| `src/fonts/Spectral-*.woff2` | **new** | 3 weights × 1 style = 3 files. |
| `src/fonts/FrankRuhlLibre-*.woff2` | **new** | 2 weights = 2 files. |
| `src/fonts/IBMPlexSans-*.woff2` | **new** | 3 weights = 3 files. |
| `src/fonts/IBMPlexMono-*.woff2` | **new** | 1 weight = 1 file. Total ≈ 15 woff2 files, ~600 KB. |

**Files explicitly not changing:** all `src/data/*.json.ts` loaders, all `src/lib/*.ts` except `fuel.ts`, `src/methodology.md`, `src/about.md`, all tests under `tests/`.

## Night-side legibility fix

Located in `src/globe.js`. Three concrete changes:

### 1. Country-dot colour and brightness

Currently (`globe.js:172`):

```js
const brightness = 0.05 + fade * 0.12 + Math.pow(sunlit, 0.7) * 0.85;
ctx.fillStyle = `rgba(20, 175, 172, ${brightness})`;
```

Replace with:

```js
const brightness = 0.30 + fade * 0.10 + Math.pow(sunlit, 0.7) * 0.60;
const dotRGB = sunlit > 0.3 ? tokens.dotDay : tokens.dotNight;
ctx.fillStyle = `rgba(${dotRGB}, ${brightness})`;
```

`tokens.dotDay` and `tokens.dotNight` are computed once at mount + on `themechange` from the parsed `--globe-dot-day` / `--globe-dot-night` hex values into `r,g,b` strings.

Result: minimum dot brightness rises from 0.05 to 0.30 (visible at all hours). Dot colour itself transitions from day to night, not just intensity. Sunfire's night-tan `#c9a662` reads as warm-shaded earth; the previous near-black-teal disappeared into the background.

### 2. Country borders

Currently `globe.js:181, 187`: `rgba(20, 175, 172, 0.22)` and `rgba(20, 175, 172, 0.25)`. Replace with `var(--globe-border)`, alpha is baked into the token (`rgba(255,208,90,0.35)` in Sunfire — raised from 0.22 to 0.35).

### 3. Night overlay

Currently `globe.js:160`: `rgba(0, 0, 0, 0.55)`. Replace with `var(--night-overlay)`. Sunfire warm-tints the shadow (`rgba(20,14,5,0.42)`); Eclipse uses a linear-gradient warm overlay; Vellum uses a near-neutral graphite. All three are softer than the current pure-black overlay so the night side reads as "shaded" not "off."

### Day-side gradient

`globe.js:149-151`: existing `rgba(90, 150, 160, …)` cool-cyan radial. Replace with `var(--day-gradient-1)`, `var(--day-gradient-2)`, `var(--day-gradient-3)`. Each theme defines its own day-side warmth.

## Theme toggle component

**File:** `src/components/theme-toggle.js` (new).

**API:**

```js
export function mountThemeToggle(host /* HTMLElement */, opts = {}) {
  // Renders chip group inside host. Returns a cleanup function.
  // opts.themes (default: ["sunfire", "vellum", "eclipse"])
  // opts.labels (default: { sunfire: "Sunfire", vellum: "Vellum", eclipse: "Eclipse" })
}
```

**Markup (rendered):**

```html
<div class="theme-toggle" role="radiogroup" aria-label="Visual theme">
  <button type="button" role="radio" aria-checked="true"  data-theme="sunfire">Sunfire</button>
  <button type="button" role="radio" aria-checked="false" data-theme="vellum">Vellum</button>
  <button type="button" role="radio" aria-checked="false" data-theme="eclipse">Eclipse</button>
</div>
```

**CSS (added to `style.css`):**

```css
.theme-toggle {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border: 1px solid var(--hairline);
  border-radius: 999px;
  background: var(--surface-raised);
}
.theme-toggle button {
  font: 500 11px / 1 var(--font-mono);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 6px 12px;
  border-radius: 999px;
  border: 0;
  background: transparent;
  color: var(--ink-muted);
  cursor: pointer;
  transition: background 140ms ease, color 140ms ease;
}
.theme-toggle button:hover { color: var(--ink); }
.theme-toggle button[aria-checked="true"] {
  background: var(--brand-subtle);
  color: var(--brand);
}
.theme-toggle button:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: 2px;
}
```

**Behaviour:**

- Click on a chip:
  1. `document.documentElement.dataset.theme = newTheme`
  2. `localStorage.setItem("elj-theme", newTheme)`
  3. Update `aria-checked` on all chips.
  4. `window.dispatchEvent(new CustomEvent("themechange", { detail: { theme: newTheme } }))`.
- Keyboard: arrow-left/right cycles, space/enter activates focused chip.
- Initial state read from `document.documentElement.dataset.theme` (already set by no-FOUC boot script).

**Placement in `src/index.md`:** inside `.app-header`, between the existing primary nav and the `app-methodology` pill. The header layout currently uses `display: flex; justify-content: space-between` between `.app-title` (left) and a right-side cluster — the toggle joins that cluster. No layout reflow expected; the chip group's intrinsic width is ~280px.

## Fuel colour migration

`src/lib/fuel.ts` currently exports a frozen `FUEL_COLOR: Record<Fuel, string>`. Theming requires runtime resolution:

```ts
// before
export const FUEL_COLOR: Record<Fuel, string> = {
  solar: "#f5c542",
  wind:  "#14afac",
  hydro: "#3b82c4",
};

// after
const FUEL_VAR: Record<Fuel, string> = {
  solar: "--fuel-solar",
  wind:  "--fuel-wind",
  hydro: "--fuel-hydro",
};

export function getFuelColor(fuel: Fuel): string {
  if (typeof window === "undefined") {
    // SSR / loader-time fallback for build-time use (none expected, but safe)
    return { solar: "#ffd05a", wind: "#67e8f9", hydro: "#b8cdff" }[fuel];
  }
  return getComputedStyle(document.documentElement).getPropertyValue(FUEL_VAR[fuel]).trim();
}
```

Consumers of `FUEL_COLOR.solar` / `.wind` / `.hydro` change to `getFuelColor("solar")` etc. Search-and-replace across `src/index.md`, `src/components/timeline.js`, any other reference. Components that paint to canvas re-call `getFuelColor` on `themechange`; those that use it as a CSS variable reference can switch to `var(--fuel-*)` directly and skip the function entirely.

## Font hosting and weights

All fonts self-hosted as `.woff2` in `src/fonts/`. Concrete file list:

| Family | Weights | Files |
|---|---|---|
| Fraunces | 400, 600, 800 | `Fraunces-Regular.woff2`, `Fraunces-SemiBold.woff2`, `Fraunces-ExtraBold.woff2` |
| Inter | 400, 500, 700 | `Inter-Regular.woff2`, `Inter-Medium.woff2`, `Inter-Bold.woff2` |
| Spectral | 400, 500, 700 | `Spectral-Regular.woff2`, `Spectral-Medium.woff2`, `Spectral-Bold.woff2` |
| Frank Ruhl Libre | 700, 900 | `FrankRuhlLibre-Bold.woff2`, `FrankRuhlLibre-Black.woff2` |
| IBM Plex Sans | 400, 500, 700 | `IBMPlexSans-Regular.woff2`, `IBMPlexSans-Medium.woff2`, `IBMPlexSans-Bold.woff2` |
| IBM Plex Mono | 500 | `IBMPlexMono-Medium.woff2` |

Total: 15 files, ~600 KB. All sources are SIL Open Font License. Fetched once during the implementation step and committed under `src/fonts/`.

`@font-face` declarations live in `src/style.css` next to the existing Gotham declarations. Existing Gotham `.ttf` files stay in place; nothing references them after the reskin lands, but they are not removed in this pass to keep the diff scoped.

**Future font swap workflow:**
1. Add new woff2 to `src/fonts/`.
2. Add `@font-face` to `style.css`.
3. Change one line: `--font-display: "NewFont", ...;` in the relevant `[data-theme="..."]` block.
4. No other file edits required.

## Open question resolved

- **`prefers-color-scheme` respect:** ignored. All three themes are dark-by-design.

## Out of scope (deferred)

- `src/og-image.png` regeneration — needs theme-specific re-renders, separate image-gen task per theme.
- Favicon update.
- Print stylesheet.
- Light-mode variant of any theme.
- Removing the existing Gotham `.ttf` files.
- Stacked logo / wordmark — currently the app-mark is a coloured `●` glyph, not an image asset, so it themes automatically via `var(--brand)`.

## Risks and known unknowns

1. **Observable Framework + custom inline `<head>` script.** The no-FOUC boot script needs to land before paint. Observable Framework allows raw HTML in markdown, but the build pipeline may rewrite or hoist scripts. Implementation step verifies by inspecting the built HTML and confirming the `data-theme` attribute is set before the first stylesheet evaluation.

2. **`getComputedStyle` performance on theme change.** Three or four reads on `themechange` is negligible. Per-frame reads inside the globe's render loop would not be — implementation must cache the parsed token values in a local object and invalidate only on `themechange`, not per frame.

3. **Eclipse's `--night-overlay: linear-gradient(...)`.** Cannot be passed directly to a canvas `fillStyle` string — `globe.js` paints the night overlay into a canvas. For Eclipse the gradient must be reconstructed as a `ctx.createLinearGradient()` call. Implementation step handles this with a small helper that reads either an `rgba(...)` string (Sunfire/Vellum) or a synthesized canvas-gradient (Eclipse).

4. **Fuel-colour resolution timing.** `getFuelColor()` requires the theme to be applied to `documentElement` first. Boot ordering is: inline script sets attribute → CSS evaluates → first `getFuelColor` call. As long as no caller runs before the inline script resolves, this is safe.

5. **Vercel build assets.** Adding ~600 KB of fonts inflates the build. Verify Vercel build still completes within deployment limits and CDN caches the woff2 with long-lived `Cache-Control`. Observable Framework already does this for static assets; expected to work without configuration.

## Acceptance criteria

- Toggle visible in app header, persists choice across reloads, no flash of unstyled or wrong-themed content on boot.
- All three themes render the dashboard without visual breakage. Globe pillars, timeline, hotspot list, headline readout all theme correctly.
- Night side of globe is legibly populated with country dots in all three themes (verifiable by scrubbing the timeline to UTC 04 and confirming dim-hemisphere readability).
- Switching themes via the toggle re-paints the globe within one frame; no stale teal-rgba pixels remain on canvas.
- Existing tests pass without modification (theme system is presentation-only).
- `getComputedStyle` is called at most once per `themechange` per painted surface, not per render frame.
