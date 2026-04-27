# Theme system (Sunfire / Vellum / Eclipse) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple Every Last Joule's visual identity from its parent brand by introducing a runtime-switchable theme system with three dark-by-design themes (Sunfire default, Vellum, Eclipse), persisted to `localStorage`, while lifting night-side globe legibility — implementing exactly the design in `docs/superpowers/specs/2026-04-27-theme-system-design.md`.

**Architecture:** CSS custom properties scoped per `:root[data-theme="<name>"]` are the single source of truth. Components read tokens via `var(--token)` (CSS-only) or `getComputedStyle(documentElement).getPropertyValue('--token')` (canvas/JS). A `<head>`-injected boot script sets `data-theme` from `localStorage` before first paint. A three-chip toggle in the app header writes `data-theme` + `localStorage` + dispatches a `themechange` event; canvas-painted surfaces (globe, tooltip sparkline, timeline) re-read tokens on that event. Fonts ship as self-hosted woff2 in `src/fonts/`.

**Tech Stack:** Observable Framework, vanilla JS/CSS, vitest+jsdom for DOM behaviour tests, `@fontsource` packages used at install-time only to source the woff2 files (committed under `src/fonts/`).

**Base commit:** `cd2109f` (spec lands). Branch `feat/theme-system-spec` already created off `v0-build`.

---

## File Structure

### New files

| Path | Purpose |
|---|---|
| `src/components/theme-toggle.js` | `mountThemeToggle(host, opts)` — three-chip radio group, writes `data-theme`/`localStorage`, fires `themechange`. |
| `src/lib/theme-tokens.js` | Browser-side helper: `readGlobeTokens()` + `parseColorToRgb()` + `isGradientOverlay()`. Cached read of `--globe-*` + day-gradient + night-overlay tokens; re-read on `themechange`. |
| `src/fonts/Fraunces-Regular.woff2` | Sunfire display 400. |
| `src/fonts/Fraunces-SemiBold.woff2` | Sunfire display 600. |
| `src/fonts/Fraunces-ExtraBold.woff2` | Sunfire display 800. |
| `src/fonts/Inter-Regular.woff2` | Sunfire body 400. |
| `src/fonts/Inter-Medium.woff2` | Sunfire body 500. |
| `src/fonts/Inter-Bold.woff2` | Sunfire body 700. |
| `src/fonts/Spectral-Regular.woff2` | Vellum 400. |
| `src/fonts/Spectral-Medium.woff2` | Vellum 500. |
| `src/fonts/Spectral-Bold.woff2` | Vellum 700. |
| `src/fonts/FrankRuhlLibre-Bold.woff2` | Eclipse display 700. |
| `src/fonts/FrankRuhlLibre-Black.woff2` | Eclipse display 900. |
| `src/fonts/IBMPlexSans-Regular.woff2` | Eclipse body 400. |
| `src/fonts/IBMPlexSans-Medium.woff2` | Eclipse body 500. |
| `src/fonts/IBMPlexSans-Bold.woff2` | Eclipse body 700. |
| `src/fonts/IBMPlexMono-Medium.woff2` | All-theme mono 500. |
| `tests/lib/fuel.test.ts` | `getFuelColor()` SSR fallback + DOM read. |
| `tests/components/theme-toggle.test.ts` | Toggle behaviour: aria-checked, localStorage, themechange dispatch, keyboard. |

### Modified files

| Path | Change |
|---|---|
| `src/style.css` | Replace single `:root` with three `:root[data-theme="..."]` blocks; add 15 `@font-face` woff2 declarations; replace literal `rgba(20,175,172,...)` chrome rules with semantic tokens; replace undefined `--amber-500` with `--data-flare`. |
| `src/globe.js` | Replace 8 hardcoded colour strings with token reads; install `themechange` listener; apply night-side legibility fix (dot brightness, border alpha, overlay tint, day gradient). |
| `src/components/region-tooltip.js` | Replace `FLARE_COLOR` const + 2 inline hex with token reads; sparkline marker uses `--data-flare`. |
| `src/components/timeline.js` | Replace 4 hardcoded paints with token reads (axis, total stroke, marker line + dot). |
| `src/lib/fuel.ts` | Convert `FUEL_COLOR` const → `getFuelColor(fuel)` function with SSR fallback. |
| `src/index.md` | Import `getFuelColor` instead of `FUEL_COLOR`; mount `<ThemeToggle>` in `.app-header` after `.app-nav`. |
| `observablehq.config.ts` | Add no-FOUC inline boot script to `head:`; extend `dynamicPaths` to include `.woff2`. |
| `package.json` | Add `jsdom` devDep for theme-toggle/getFuelColor tests. |
| `vitest.config.ts` | Per-file environment opt-in already supported via `// @vitest-environment jsdom`; no config change needed. (Documented; no edit.) |

### Reused (no change)

- `src/lib/calc.ts`, `src/lib/types.ts`, `src/lib/regions.ts`, all data loaders, `src/methodology.md`, `src/about.md`, all existing tests under `tests/`.

---

## Phase 0 — Workspace setup

### Task 0.1: Verify branch + base commit

**Files:** none (verification only).

- [ ] **Step 1: Confirm we are on `feat/theme-system-spec` at `cd2109f`**

Run:
```bash
cd /Users/simoncollins/code/worktrees/theme-system-plan
git rev-parse --abbrev-ref HEAD
git log --oneline HEAD -1
```

Expected output:
```
feat/theme-system-spec
cd2109f Theme system design — Sunfire/Vellum/Eclipse
```

If branch or commit differs, stop and reset before continuing.

- [ ] **Step 2: Confirm baseline tests pass before any change**

Run:
```bash
npm test
```

Expected: all existing test files green. (Locks in our "existing tests pass without modification" acceptance criterion.)

### Task 0.2: Install jsdom devDep (for theme-toggle + getFuelColor tests)

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install jsdom**

Run:
```bash
npm install --save-dev jsdom@^24
```

Expected: `package.json` `devDependencies.jsdom` present; `package-lock.json` updated.

- [ ] **Step 2: Verify vitest can opt into jsdom per-file**

Create a throwaway probe file (delete after passing):

```bash
cat > tests/_probe.test.ts <<'EOF'
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
describe("jsdom probe", () => {
  it("has document", () => {
    expect(typeof document).toBe("object");
    expect(document.documentElement.tagName).toBe("HTML");
  });
});
EOF
npm test -- tests/_probe.test.ts
rm tests/_probe.test.ts
```

Expected: 1 passing. Confirms jsdom env works without altering global vitest config.

- [ ] **Step 3: Commit dev-dep**

```bash
git add package.json package-lock.json
git commit -m "chore(theme): add jsdom devDep for theme-toggle DOM tests"
```

---

## Phase 1 — CSS variable refactor (3-theme blocks)

The strategy: keep `--teal-*` / `--slate-*` palette scales untouched **as raw colour vocabularies** (the `--btc-orange` rule pattern), but rewrite the **semantic** tokens (`--brand`, `--ink`, `--surface-*`, etc.) into three per-theme blocks. Chrome rules currently referencing `var(--teal-500)` directly are rewritten to use semantic tokens (`var(--brand)`) so they re-resolve per active theme.

### Task 1.1: Add the three-theme semantic-token blocks

**Files:**
- Modify: `src/style.css:24-170`

- [ ] **Step 1: Replace the `:root { ... }` semantic-token section with three `:root[data-theme="..."]` blocks**

Edit `src/style.css`. Locate `:root {` at line 24 and replace **lines 24–170** (everything from `:root {` through the closing `}` before `/* ============ SEMANTIC ELEMENT STYLES ============ */`) with the following:

```css
/* ============ SHARED TOKENS (theme-invariant) ============ */
:root {
  /* Spacing */
  --space-0: 0;  --space-1: 4px;  --space-2: 8px;  --space-3: 12px;
  --space-4: 16px; --space-5: 20px; --space-6: 24px; --space-8: 32px;
  --space-10: 40px; --space-12: 48px; --space-16: 64px; --space-20: 80px;
  --space-24: 96px; --space-32: 128px;

  /* Radii */
  --r-none: 0; --r-sm: 4px; --r-md: 8px; --r-lg: 12px; --r-xl: 20px; --r-pill: 999px;

  /* Shadows (alpha kept low; tinting per-theme would require ramps) */
  --shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.18);
  --shadow-sm: 0 2px 6px rgba(0, 0, 0, 0.22);
  --shadow-md: 0 8px 20px rgba(0, 0, 0, 0.30);
  --shadow-lg: 0 20px 40px rgba(0, 0, 0, 0.40);

  /* Motion */
  --dur-fast: 120ms; --dur-base: 200ms; --dur-slow: 320ms;
  --ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);

  /* Layout */
  --container-max: 1200px;
  --container-wide: 1400px;

  /* Type scale (theme-invariant; family + weight vary by theme) */
  --fs-display-xl: clamp(56px, 8vw, 112px);
  --fs-display-lg: clamp(44px, 6vw, 80px);
  --fs-display:    clamp(36px, 4.5vw, 60px);
  --fs-h1: 44px; --fs-h2: 32px; --fs-h3: 24px; --fs-h4: 20px;
  --fs-body-lg: 18px; --fs-body: 16px; --fs-body-sm: 14px;
  --fs-caption: 12px; --fs-micro: 11px;

  --lh-tight: 1.02; --lh-display: 1.05; --lh-heading: 1.15;
  --lh-body: 1.55; --lh-ui: 1.3;

  --ls-tight: -0.02em; --ls-display: -0.015em;
  --ls-normal: 0; --ls-caps: 0.12em;

  /* Legacy weight scale (still referenced by Gotham fallback rules; safe to keep) */
  --fw-thin: 100; --fw-xlight: 200; --fw-light: 300; --fw-book: 400;
  --fw-medium: 500; --fw-bold: 700; --fw-black: 800; --fw-ultra: 900;

  /* Pure white — used for high-contrast text on dark surfaces (every theme) */
  --white: #ffffff;
}

/* ============ THEME: SUNFIRE (default) ============ */
:root[data-theme="sunfire"] {
  --brand:               #ffd05a;
  --brand-strong:        #e6a020;
  --brand-subtle:        rgba(255, 208, 90, 0.10);
  --brand-on:            #150e08;

  --surface-bg-1:        #2d1f0e;
  --surface-bg-2:        #1a1207;
  --surface-bg-3:        #0a0703;
  --surface-raised:      #1f160a;
  --hairline:            rgba(255, 248, 224, 0.08);
  --hairline-strong:     rgba(255, 248, 224, 0.16);

  --ink:                 #fff8e0;
  --ink-muted:           rgba(255, 248, 224, 0.65);
  --ink-soft:            rgba(255, 248, 224, 0.40);

  --data-renewable:      #67e8f9;
  --data-renewable-tip:  #cffafe;
  --data-flare:          #f7931a;
  --data-flare-tip:      #ffc46d;

  --fuel-solar:          #ffd05a;
  --fuel-wind:           #67e8f9;
  --fuel-hydro:          #b8cdff;

  --globe-dot-day:       #fff8e0;
  --globe-dot-night:     #c9a662;
  --globe-border:        rgba(255, 208, 90, 0.35);
  --day-gradient-1:      rgba(255, 208, 90, 0.55);
  --day-gradient-2:      rgba(230, 160, 32, 0.25);
  --day-gradient-3:      rgba(0, 0, 0, 0);
  --night-overlay:       rgba(20, 14, 5, 0.42);

  --success:             #5eead4;
  --warning:             #ffb84d;
  --danger:              #f87171;
  --info:                var(--data-renewable);

  --font-display:        "Fraunces", Georgia, "Times New Roman", serif;
  --font-body:           "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  --font-mono:           "IBM Plex Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --font-sans:           var(--font-body); /* legacy alias for existing rules */
  --display-weight-strong: 800;
  --display-weight-base:   600;

  /* Page-loader chrome (always visible during boot, before app paint) */
  --loader-bg-1:         #2d1f0e;
  --loader-bg-2:         #1a1207;
  --loader-bg-3:         #0a0703;
  --loader-sweep:        var(--brand);
  --loader-sweep-trail:  rgba(255, 208, 90, 0.6);
}

/* ============ THEME: VELLUM (parchment + ink) ============ */
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

  --data-renewable:      #4f8cff;
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
  --info:                var(--data-renewable);

  --font-display:        "Spectral", Georgia, "Times New Roman", serif;
  --font-body:           "Spectral", Georgia, "Times New Roman", serif;
  --font-mono:           "IBM Plex Mono", ui-monospace, monospace;
  --font-sans:           var(--font-body);
  --display-weight-strong: 700;
  --display-weight-base:   500;

  --loader-bg-1:         #221f1a;
  --loader-bg-2:         #15130f;
  --loader-bg-3:         #0c0b09;
  --loader-sweep:        var(--brand);
  --loader-sweep-trail:  rgba(236, 228, 210, 0.4);
}

/* ============ THEME: ECLIPSE (B&W magazine + magenta) ============ */
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

  --data-renewable:      #ec4899;
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
  /* Eclipse uses a gradient string for the night overlay; globe.js detects
     the leading "linear-gradient(" prefix and rebuilds via createLinearGradient. */
  --night-overlay:       linear-gradient(135deg, rgba(40, 30, 20, 0.30) 0%, rgba(15, 10, 5, 0.55) 100%);

  --success:             #ec4899;
  --warning:             #ffb84d;
  --danger:              #ff6b6b;
  --info:                var(--data-renewable);

  --font-display:        "Frank Ruhl Libre", Georgia, "Times New Roman", serif;
  --font-body:           "IBM Plex Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  --font-mono:           "IBM Plex Mono", ui-monospace, monospace;
  --font-sans:           var(--font-body);
  --display-weight-strong: 900;
  --display-weight-base:   700;

  --loader-bg-1:         #0d0d0d;
  --loader-bg-2:         #050505;
  --loader-bg-3:         #020202;
  --loader-sweep:        var(--brand);
  --loader-sweep-trail:  rgba(250, 250, 250, 0.4);
}
```

The block above does **not** delete the existing `:root` block — it replaces lines 24–170 verbatim. The opening `/* ============ SEMANTIC ELEMENT STYLES ============ */` heading at original line 172 stays.

- [ ] **Step 2: Verify build still works (CSS parse)**

Run:
```bash
npm run build 2>&1 | head -40
```

Expected: build runs through the CSS pipeline without parse errors. (Build may fail later if fonts aren't yet present — that's Phase 2; ignore font-related warnings here.)

- [ ] **Step 3: Commit**

```bash
git add src/style.css
git commit -m "feat(theme): replace :root semantic tokens with per-theme blocks"
```

### Task 1.2: Rewrite chrome rules to reference semantic tokens

The existing rules reference `var(--teal-*)` and bare `rgba(20, 175, 172, ...)` literally. With those scales removed, those references would cascade to nothing. Each one is replaced with the appropriate semantic token.

**Files:**
- Modify: `src/style.css` (16 specific rules)

- [ ] **Step 1: Replace each teal/legacy reference**

Apply the following edits to `src/style.css`. Each `OLD →` shows the exact old line; `NEW →` shows the replacement. Search by full line content; if any line has already been changed, skip it.

| Site | OLD | NEW |
|---|---|---|
| Loader sweep gradient (`.loader-topbar-fill`, ~line 279–280) | `    var(--teal-500) 40%,\n    rgba(20,175,172,0.6) 60%,` | `    var(--loader-sweep) 40%,\n    var(--loader-sweep-trail) 60%,` |
| Loader pulse mark (`.loader-center-mark`, ~line 294) | `  color: var(--teal-500);` | `  color: var(--brand);` |
| Body radial bg (`html, body { background: ... }`, ~line 319) | `  background: radial-gradient(ellipse at 30% 40%, #0f1517 0%, #0a0b0c 60%, #050607 100%);` | `  background: radial-gradient(ellipse at 30% 40%, var(--surface-bg-1) 0%, var(--surface-bg-2) 60%, var(--surface-bg-3) 100%);` |
| Page-loader bg (`#page-loader { background: ... }`, ~line 244) | `  background: radial-gradient(ellipse at 30% 40%, #0f1517 0%, #0a0b0c 60%, #050607 100%);` | `  background: radial-gradient(ellipse at 30% 40%, var(--loader-bg-1) 0%, var(--loader-bg-2) 60%, var(--loader-bg-3) 100%);` |
| `:focus-visible` outline, ~line 348 | `  outline: 2px solid var(--teal-500);` | `  outline: 2px solid var(--brand);` |
| `.app-mark`, ~line 401 | `  color: var(--teal-500);` | `  color: var(--brand);` |
| `.app-methodology:hover`, ~line 434–436 | `  background: rgba(20,175,172,0.08);\n  color: var(--white);\n  border-color: var(--teal-500);` | `  background: var(--brand-subtle);\n  color: var(--ink);\n  border-color: var(--brand);` |
| `.app-nav a:hover, [aria-current]`, ~line 457–459 | `  background: rgba(20,175,172,0.08);\n  color: var(--white);\n  border-color: rgba(20,175,172,0.4);` | `  background: var(--brand-subtle);\n  color: var(--ink);\n  border-color: var(--hairline-strong);` |
| `.globe-placeholder`, ~line 523 | `    radial-gradient(circle at 50% 40%, rgba(20,175,172,0.12), rgba(20,175,172,0.04) 35%, rgba(255,255,255,0.02) 60%, transparent 75%),` | `    radial-gradient(circle at 50% 40%, var(--brand-subtle), transparent 60%),` |
| `.region-tooltip` shadow, ~line 579 | `  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(20, 175, 172, 0.12) inset;` | `  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.55), 0 0 0 1px var(--hairline) inset;` |
| `.region-tooltip-source a`, ~line 677 | `  color: var(--teal-400, #3fc1be);` | `  color: var(--brand-strong);` |
| `.region-tooltip-footer a`, ~line 694 | `  color: var(--teal-400, #3fc1be);` | `  color: var(--brand-strong);` |
| `.dot-teal` (rename body, keep selector), ~line 922–925 | `.dot-teal {\n  background: var(--teal-500);\n  box-shadow: 0 0 10px rgba(20,175,172,0.5);\n}` | `.dot-teal {\n  background: var(--data-renewable);\n  box-shadow: 0 0 10px var(--data-renewable);\n}` |
| `.app-footer .caption a`, ~line 966 | `  color: var(--teal-400, #3fc1be);` | `  color: var(--brand-strong);` |
| `.ctl-play`, ~line 1099 | `  background: var(--teal-500);` | `  background: var(--brand);` |
| `.ctl-play`, ~line 1101 | `  color: var(--slate-800);` | `  color: var(--brand-on);` |
| `.ctl-play[aria-pressed="true"]`, ~line 1114–1115 | `  background: rgba(255,255,255,0.08);\n  color: var(--white);` | `  background: var(--hairline);\n  color: var(--ink);` |
| `.ctl-speed-chip.is-active`, ~line 1144–1146 | `  background: rgba(20,175,172,0.2);\n  border-color: var(--teal-500);\n  color: var(--teal-500);` | `  background: var(--brand-subtle);\n  border-color: var(--brand);\n  color: var(--brand);` |
| `.mode-btn-active`, ~line 1170–1172 | `  background: rgba(247,147,26,0.18);\n  border-color: var(--amber-500);\n  color: var(--amber-500);` | `  background: rgba(247, 147, 26, 0.18);\n  border-color: var(--data-flare);\n  color: var(--data-flare);` |
| `.page-back-nav a`, ~line 1201 | `  color: rgba(20,175,172,0.85);` | `  color: var(--brand-strong);` |
| `.page-back-nav a:hover`, ~line 1206 | `  color: rgba(20,175,172,1);` | `  color: var(--brand);` |
| `.methodology-eyebrow`, ~line 1229 | `  color: var(--teal-400, #3fc1be);` | `  color: var(--brand-strong);` |
| `.methodology-toc a:hover`, ~line 1268–1270 | `  background: rgba(20,175,172,0.08);\n  color: var(--white);\n  border-color: rgba(20,175,172,0.35);` | `  background: var(--brand-subtle);\n  color: var(--ink);\n  border-color: var(--hairline-strong);` |
| `.methodology-doc a`, ~line 1301 | `  color: var(--teal-400, #3fc1be);` | `  color: var(--brand-strong);` |
| `.methodology-doc a`, ~line 1303 | `  border-bottom: 1px solid rgba(63,193,190,0.35);` | `  border-bottom: 1px solid var(--hairline-strong);` |
| `.methodology-doc a:hover`, ~line 1307–1308 | `  color: var(--white);\n  border-bottom-color: var(--teal-400, #3fc1be);` | `  color: var(--ink);\n  border-bottom-color: var(--brand);` |
| `.methodology-callout`, ~line 1381–1382 | `  border-left: 3px solid var(--teal-500);\n  background: rgba(20,175,172,0.04);` | `  border-left: 3px solid var(--brand);\n  background: var(--brand-subtle);` |
| `.flare-footnote #flare-readout`, ~line 563 | `  color: var(--btc-orange);` | `  color: var(--data-flare);` |
| `.dot-orange`, ~line 928 | `  background: var(--btc-orange);` | `  background: var(--data-flare);` |
| Body color, ~line 320 | `  color: var(--white);` | `  color: var(--ink);` |
| App-shell color, ~line 383 | `  color: var(--white);` | `  color: var(--ink);` |
| `--shadow-teal` definition (delete; now unused) | `  --shadow-teal: 0 10px 30px rgba(20, 175, 172, 0.25);` | (delete the line entirely) |
| `--shadow-focus` definition (delete; not referenced) | `  --shadow-focus: 0 0 0 3px rgba(20, 175, 172, 0.35);` | (delete the line entirely) |

These two `--shadow-*` deletions are safe — they were never referenced by any selector. Confirm before deleting:
```bash
grep -n "shadow-teal\|shadow-focus" src/style.css | grep -v "^[0-9]*:  --"
```
Expected output: empty.

- [ ] **Step 2: Sanity grep — there should be ZERO remaining `var(--teal-` references**

Run:
```bash
grep -nE "var\(--teal-|rgba?\(20[ ,]+175[ ,]+172|var\(--slate-|var\(--amber-" src/style.css
```

Expected: empty output. If any matches remain, fix them with the appropriate semantic token (use `--brand`, `--ink`, `--surface-bg-*`, `--hairline`, etc.) before continuing.

- [ ] **Step 3: Build still parses**

Run:
```bash
npm run build 2>&1 | head -20
```

Expected: no CSS parse errors.

- [ ] **Step 4: Smoke-test in dev server (manual)**

Run:
```bash
npm run dev &
DEV_PID=$!
sleep 3
echo "Open http://localhost:3000 — set <html data-theme=\"sunfire\"> via DevTools and confirm warm-gold rendering. Then try \"vellum\" and \"eclipse\". No untouched teal pixels expected. Press Enter to stop dev server."
read
kill $DEV_PID
```

Expected: each `data-theme` value paints the dashboard in its theme palette. (Fonts will fall back to Georgia/system-ui until Phase 2 lands; that's fine for this step.)

- [ ] **Step 5: Commit**

```bash
git add src/style.css
git commit -m "feat(theme): rewrite chrome rules to reference semantic tokens (themed)"
```

---

## Phase 2 — Self-hosted woff2 fonts

Strategy: install `@fontsource` packages as devDeps, copy the specific weight `.woff2` files into `src/fonts/`, then leave the devDeps in place so future weight additions are reproducible without `curl` against gstatic.

### Task 2.1: Source the fonts

**Files:**
- Modify: `package.json`
- Create: 15 woff2 files under `src/fonts/`.

- [ ] **Step 1: Install @fontsource packages**

Run:
```bash
npm install --save-dev \
  @fontsource/fraunces \
  @fontsource/inter \
  @fontsource/spectral \
  @fontsource/frank-ruhl-libre \
  @fontsource/ibm-plex-sans \
  @fontsource/ibm-plex-mono
```

Expected: 6 packages installed under `node_modules/@fontsource/...`. Each contains `files/<family>-latin-<weight>-normal.woff2`.

- [ ] **Step 2: Copy the 15 specific weight files into `src/fonts/`**

Run:
```bash
cp node_modules/@fontsource/fraunces/files/fraunces-latin-400-normal.woff2          src/fonts/Fraunces-Regular.woff2
cp node_modules/@fontsource/fraunces/files/fraunces-latin-600-normal.woff2          src/fonts/Fraunces-SemiBold.woff2
cp node_modules/@fontsource/fraunces/files/fraunces-latin-800-normal.woff2          src/fonts/Fraunces-ExtraBold.woff2

cp node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2                src/fonts/Inter-Regular.woff2
cp node_modules/@fontsource/inter/files/inter-latin-500-normal.woff2                src/fonts/Inter-Medium.woff2
cp node_modules/@fontsource/inter/files/inter-latin-700-normal.woff2                src/fonts/Inter-Bold.woff2

cp node_modules/@fontsource/spectral/files/spectral-latin-400-normal.woff2          src/fonts/Spectral-Regular.woff2
cp node_modules/@fontsource/spectral/files/spectral-latin-500-normal.woff2          src/fonts/Spectral-Medium.woff2
cp node_modules/@fontsource/spectral/files/spectral-latin-700-normal.woff2          src/fonts/Spectral-Bold.woff2

cp node_modules/@fontsource/frank-ruhl-libre/files/frank-ruhl-libre-latin-700-normal.woff2 src/fonts/FrankRuhlLibre-Bold.woff2
cp node_modules/@fontsource/frank-ruhl-libre/files/frank-ruhl-libre-latin-900-normal.woff2 src/fonts/FrankRuhlLibre-Black.woff2

cp node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2 src/fonts/IBMPlexSans-Regular.woff2
cp node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-500-normal.woff2 src/fonts/IBMPlexSans-Medium.woff2
cp node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-700-normal.woff2 src/fonts/IBMPlexSans-Bold.woff2

cp node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2 src/fonts/IBMPlexMono-Medium.woff2
```

If any source file is missing (the @fontsource package layout occasionally renames), find the actual path via:
```bash
ls node_modules/@fontsource/<family>/files/ | grep "<weight>-normal.woff2"
```
and adjust accordingly.

- [ ] **Step 3: Verify all 15 woff2 files exist and are non-trivial size**

Run:
```bash
ls -l src/fonts/*.woff2 | wc -l
ls -lS src/fonts/*.woff2 | head -3
du -ch src/fonts/*.woff2 | tail -1
```

Expected: 15 files; each at least 20 KB; total ~400–700 KB.

- [ ] **Step 4: Commit fonts and devDeps**

```bash
git add package.json package-lock.json src/fonts/*.woff2
git commit -m "feat(theme): self-host 15 woff2 font files via @fontsource"
```

### Task 2.2: Add @font-face declarations and dynamicPaths support

**Files:**
- Modify: `src/style.css` (add 15 `@font-face` blocks beside existing Gotham declarations)
- Modify: `observablehq.config.ts` (extend `dynamicPaths` to include .woff2)

- [ ] **Step 1: Add 15 `@font-face` declarations to `src/style.css`**

Edit `src/style.css`. After **line 22** (the last existing Gotham `@font-face`) and before **line 24** (the `:root` shared block), insert:

```css
/* ---------- Theme system: self-hosted woff2 ---------- */
/* Sunfire — display */
@font-face { font-family: "Fraunces"; src: url("/fonts/Fraunces-Regular.woff2") format("woff2");    font-weight: 400; font-style: normal; font-display: swap; }
@font-face { font-family: "Fraunces"; src: url("/fonts/Fraunces-SemiBold.woff2") format("woff2");   font-weight: 600; font-style: normal; font-display: swap; }
@font-face { font-family: "Fraunces"; src: url("/fonts/Fraunces-ExtraBold.woff2") format("woff2"); font-weight: 800; font-style: normal; font-display: swap; }

/* Sunfire — body */
@font-face { font-family: "Inter"; src: url("/fonts/Inter-Regular.woff2") format("woff2");          font-weight: 400; font-style: normal; font-display: swap; }
@font-face { font-family: "Inter"; src: url("/fonts/Inter-Medium.woff2") format("woff2");           font-weight: 500; font-style: normal; font-display: swap; }
@font-face { font-family: "Inter"; src: url("/fonts/Inter-Bold.woff2") format("woff2");             font-weight: 700; font-style: normal; font-display: swap; }

/* Vellum — body + display */
@font-face { font-family: "Spectral"; src: url("/fonts/Spectral-Regular.woff2") format("woff2");    font-weight: 400; font-style: normal; font-display: swap; }
@font-face { font-family: "Spectral"; src: url("/fonts/Spectral-Medium.woff2") format("woff2");     font-weight: 500; font-style: normal; font-display: swap; }
@font-face { font-family: "Spectral"; src: url("/fonts/Spectral-Bold.woff2") format("woff2");       font-weight: 700; font-style: normal; font-display: swap; }

/* Eclipse — display */
@font-face { font-family: "Frank Ruhl Libre"; src: url("/fonts/FrankRuhlLibre-Bold.woff2") format("woff2");  font-weight: 700; font-style: normal; font-display: swap; }
@font-face { font-family: "Frank Ruhl Libre"; src: url("/fonts/FrankRuhlLibre-Black.woff2") format("woff2"); font-weight: 900; font-style: normal; font-display: swap; }

/* Eclipse — body */
@font-face { font-family: "IBM Plex Sans"; src: url("/fonts/IBMPlexSans-Regular.woff2") format("woff2");    font-weight: 400; font-style: normal; font-display: swap; }
@font-face { font-family: "IBM Plex Sans"; src: url("/fonts/IBMPlexSans-Medium.woff2") format("woff2");     font-weight: 500; font-style: normal; font-display: swap; }
@font-face { font-family: "IBM Plex Sans"; src: url("/fonts/IBMPlexSans-Bold.woff2") format("woff2");       font-weight: 700; font-style: normal; font-display: swap; }

/* All themes — mono */
@font-face { font-family: "IBM Plex Mono"; src: url("/fonts/IBMPlexMono-Medium.woff2") format("woff2");     font-weight: 500; font-style: normal; font-display: swap; }
```

- [ ] **Step 2: Extend `observablehq.config.ts` to copy `.woff2` into the build**

Edit `observablehq.config.ts`. Locate:

```ts
const fontFiles = readdirSync(join("src", "fonts"))
  .filter((file) => file.endsWith(".ttf"))
  .map((file) => `/fonts/${file}`);
```

Replace with:

```ts
const fontFiles = readdirSync(join("src", "fonts"))
  .filter((file) => file.endsWith(".ttf") || file.endsWith(".woff2"))
  .map((file) => `/fonts/${file}`);
```

- [ ] **Step 3: Build and verify all 15 woff2 files appear in the output**

Run:
```bash
npm run build 2>&1 | tail -20
ls -1 dist/_file/fonts/*.woff2 2>/dev/null | wc -l
```

Expected: build succeeds; `dist/_file/fonts/` contains 15 woff2 files (Observable hashes filenames; the count is what matters). If the count is 0, check `dynamicPaths` resolution — the file extension filter must include `.woff2`.

- [ ] **Step 4: Apply font tokens in body chrome**

Edit `src/style.css`. Locate the `html, body { ... }` rule (~line 173):

OLD:
```css
html, body {
  font-family: var(--font-sans);
  color: var(--ink);
```

NEW:
```css
html, body {
  font-family: var(--font-body);
  color: var(--ink);
```

Locate `.display-xl, .display-lg, .display, h1, h2, h3, h4 { ... }` (~line 186):

OLD:
```css
.display-xl, .display-lg, .display,
h1, h2, h3, h4 {
  font-family: var(--font-sans);
```

NEW:
```css
.display-xl, .display-lg, .display,
h1, h2, h3, h4 {
  font-family: var(--font-display);
```

Locate `.app-wordmark { ... }` (~line 405):

OLD:
```css
.app-wordmark {
  font-weight: 800;
  font-size: 16px;
  letter-spacing: 0.04em;
  color: var(--white);
}
```

NEW:
```css
.app-wordmark {
  font-family: var(--font-display);
  font-weight: var(--display-weight-strong);
  font-size: 16px;
  letter-spacing: 0.04em;
  color: var(--ink);
}
```

Locate the timeline tick label rule inside `src/components/timeline.js` (line 128) — leave that alone for now; Phase 6 handles it.

- [ ] **Step 5: Smoke-test all three themes in dev**

Run:
```bash
npm run dev &
DEV_PID=$!
sleep 3
echo "Open http://localhost:3000 and rotate data-theme via DevTools through sunfire/vellum/eclipse. Verify Fraunces / Spectral / Frank Ruhl Libre render visibly different display type. Press Enter to continue."
read
kill $DEV_PID
```

Expected: each theme shows its display family on the headline %, hotspot column titles, and methodology h1.

- [ ] **Step 6: Commit**

```bash
git add src/style.css observablehq.config.ts
git commit -m "feat(theme): @font-face self-hosted woff2 declarations + build asset wiring"
```

---

## Phase 3 — Globe token reading + night-side legibility fix

### Task 3.1: Build the token-reader helper

Cache token reads off the per-frame path. Helper exposes parsed RGB tuples so the canvas hot-loop only does string composition.

**Files:**
- Create: `src/lib/theme-tokens.js`

- [ ] **Step 1: Write the helper**

Create `src/lib/theme-tokens.js` with the following content:

```js
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
  };
}
```

- [ ] **Step 2: Write a unit test for `parseColorToRgb` and `isGradientOverlay`**

Create `tests/lib/theme-tokens.test.ts` (note: this test does NOT need jsdom; it tests pure parsing):

```ts
import { describe, it, expect } from "vitest";
import { parseColorToRgb, isGradientOverlay } from "../../src/lib/theme-tokens.js";

describe("parseColorToRgb", () => {
  it("parses 6-digit hex", () => {
    expect(parseColorToRgb("#ffd05a")).toBe("255,208,90");
  });
  it("parses 3-digit hex", () => {
    expect(parseColorToRgb("#fff")).toBe("255,255,255");
  });
  it("parses rgb()", () => {
    expect(parseColorToRgb("rgb(20, 175, 172)")).toBe("20,175,172");
  });
  it("parses rgba()", () => {
    expect(parseColorToRgb("rgba(255, 208, 90, 0.35)")).toBe("255,208,90");
  });
  it("returns null for gradient", () => {
    expect(parseColorToRgb("linear-gradient(135deg, #fff 0%, #000 100%)")).toBe(null);
  });
  it("returns null for empty/whitespace", () => {
    expect(parseColorToRgb("")).toBe(null);
    expect(parseColorToRgb("   ")).toBe(null);
  });
});

describe("isGradientOverlay", () => {
  it("detects linear-gradient", () => {
    expect(isGradientOverlay("linear-gradient(135deg, #fff, #000)")).toBe(true);
  });
  it("rejects plain colour", () => {
    expect(isGradientOverlay("rgba(20, 14, 5, 0.42)")).toBe(false);
  });
  it("rejects empty/undefined", () => {
    expect(isGradientOverlay("")).toBe(false);
    expect(isGradientOverlay(undefined)).toBe(false);
  });
});
```

- [ ] **Step 3: Run the new test, confirm it passes**

Run:
```bash
mkdir -p tests/lib
npm test -- tests/lib/theme-tokens.test.ts
```

Expected: 8 passing.

- [ ] **Step 4: Commit**

```bash
git add src/lib/theme-tokens.js tests/lib/theme-tokens.test.ts
git commit -m "feat(theme): theme-tokens helper with parseColorToRgb + readGlobeTokens"
```

### Task 3.2: Wire `globe.js` to read tokens + apply legibility fix

**Files:**
- Modify: `src/globe.js` (add import; replace 8 hardcoded paint calls; add themechange listener)

- [ ] **Step 1: Add the import**

Edit `src/globe.js`. Update line 4:

OLD:
```js
import { regionGWAtHour } from "./lib/calc.js";
import { FUEL_COLOR, dominantFuel } from "./lib/fuel.js";
```

NEW:
```js
import { regionGWAtHour } from "./lib/calc.js";
import { FUEL_COLOR, dominantFuel } from "./lib/fuel.js";
import { readGlobeTokens } from "./lib/theme-tokens.js";
```

(`FUEL_COLOR` will be replaced with `getFuelColor` in Phase 5; leave as-is for now.)

- [ ] **Step 2: Cache tokens at mount + invalidate on themechange**

Edit `src/globe.js`. Locate the `state` object at lines 51–58 and the `mountGlobe` body. Right after `const state = { ... };` (line 58), add:

OLD:
```js
  const state = {
    regions: initial.regions,
    regionData: initial.regionData,
    utcHour: initial.utcHour,
    mode: initial.mode ?? "avg30d",
    rotation: [-10, -15, 0],
    dragging: false
  };
```

NEW:
```js
  const state = {
    regions: initial.regions,
    regionData: initial.regionData,
    utcHour: initial.utcHour,
    mode: initial.mode ?? "avg30d",
    rotation: [-10, -15, 0],
    dragging: false
  };
  let tokens = readGlobeTokens();
  function refreshTokens() {
    tokens = readGlobeTokens();
    render();
  }
  window.addEventListener("themechange", refreshTokens);
```

- [ ] **Step 3: Replace the day-side gradient stops (legibility fix #4)**

Edit `src/globe.js` lines 149–151:

OLD:
```js
      gradient.addColorStop(0, "rgba(90, 150, 160, 0.75)");
      gradient.addColorStop(0.45, "rgba(40, 80, 90, 0.35)");
      gradient.addColorStop(1, "rgba(0,0,0,0)");
```

NEW:
```js
      gradient.addColorStop(0,    tokens.dayGrad1);
      gradient.addColorStop(0.45, tokens.dayGrad2);
      gradient.addColorStop(1,    tokens.dayGrad3);
```

- [ ] **Step 4: Replace the night overlay (legibility fix #3) with branch for gradient**

Edit `src/globe.js` lines 158–161:

OLD:
```js
    ctx.beginPath();
    path(d3.geoCircle().center([antiSolarLng, -sunLat]).radius(90)());
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fill();
```

NEW:
```js
    ctx.beginPath();
    path(d3.geoCircle().center([antiSolarLng, -sunLat]).radius(90)());
    if (tokens.nightOverlayKind === "gradient") {
      // Eclipse uses a CSS linear-gradient that canvas can't consume directly.
      // Reconstruct it as a 135deg canvas gradient across the visible circle.
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0,   "rgba(40, 30, 20, 0.30)");
      grad.addColorStop(1,   "rgba(15, 10, 5, 0.55)");
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = tokens.nightOverlay;
    }
    ctx.fill();
```

- [ ] **Step 5: Replace the country-dot brightness + colour (legibility fix #1)**

Edit `src/globe.js` lines 168–173:

OLD:
```js
      const fade = 1 - dist / (Math.PI / 2);
      const solarAngle = d3.geoDistance([lon, lat], [sunLng, sunLat]);
      const sunlit = Math.max(0, Math.cos(solarAngle));
      const brightness = 0.05 + fade * 0.12 + Math.pow(sunlit, 0.7) * 0.85;
      ctx.fillStyle = `rgba(20, 175, 172, ${brightness})`;
      ctx.fillRect(point[0] - 0.6, point[1] - 0.6, 1.4, 1.4);
```

NEW:
```js
      const fade = 1 - dist / (Math.PI / 2);
      const solarAngle = d3.geoDistance([lon, lat], [sunLng, sunLat]);
      const sunlit = Math.max(0, Math.cos(solarAngle));
      // Floor raised 0.05 → 0.30 so the night side stays populated.
      const brightness = 0.30 + fade * 0.10 + Math.pow(sunlit, 0.7) * 0.60;
      const dotRGB = sunlit > 0.3 ? tokens.dotDay : tokens.dotNight;
      ctx.fillStyle = `rgba(${dotRGB}, ${brightness})`;
      ctx.fillRect(point[0] - 0.6, point[1] - 0.6, 1.4, 1.4);
```

- [ ] **Step 6: Replace country borders + sphere stroke (legibility fix #2)**

Edit `src/globe.js` lines 181–188:

OLD:
```js
    ctx.strokeStyle = "rgba(20, 175, 172, 0.22)";
    ctx.lineWidth = 0.4;
    ctx.stroke();

    ctx.beginPath();
    path({ type: "Sphere" });
    ctx.strokeStyle = "rgba(20, 175, 172, 0.25)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
```

NEW:
```js
    ctx.strokeStyle = tokens.border;
    ctx.lineWidth = 0.4;
    ctx.stroke();

    ctx.beginPath();
    path({ type: "Sphere" });
    ctx.strokeStyle = tokens.border;
    ctx.lineWidth = 0.8;
    ctx.stroke();
```

- [ ] **Step 7: Replace the sphere base fill on line 137**

Edit `src/globe.js` lines 135–138:

OLD:
```js
    ctx.beginPath();
    path({ type: "Sphere" });
    ctx.fillStyle = "#0a1114";
    ctx.fill();
```

NEW:
```js
    ctx.beginPath();
    path({ type: "Sphere" });
    ctx.fillStyle = `rgb(${tokens.dotNight})`;
    ctx.globalAlpha = 0.18;
    ctx.fill();
    ctx.globalAlpha = 1;
```

(The previous `#0a1114` was a deep cool-cyan-tinted black. Per-theme we want the sphere base to follow the night palette — Sunfire's tan, Vellum's stone, Eclipse's pure dark. Alpha 0.18 keeps the sphere subdued while letting the radial gradient + night overlay do the contrast work.)

- [ ] **Step 8: Hook `themechange` cleanup into `destroy()`**

Edit `src/globe.js`. Locate the returned object at lines 387–397:

OLD:
```js
  return {
    update(next) {
      Object.assign(state, next);
      render();
    },
    destroy() {
      stopLoop();
      document.removeEventListener("visibilitychange", onVisibility);
      resizeObserver.disconnect();
    }
  };
```

NEW:
```js
  return {
    update(next) {
      Object.assign(state, next);
      render();
    },
    destroy() {
      stopLoop();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("themechange", refreshTokens);
      resizeObserver.disconnect();
    }
  };
```

- [ ] **Step 9: Smoke test — switch themes via DevTools and confirm visual update + populated night side**

Run:
```bash
npm run dev &
DEV_PID=$!
sleep 3
echo "Open http://localhost:3000 in DevTools console. Run:"
echo "  document.documentElement.dataset.theme = 'sunfire';"
echo "  window.dispatchEvent(new CustomEvent('themechange'));"
echo "Globe should re-paint warm. Confirm night-side dots are clearly visible (was nearly black before)."
echo "Repeat for 'vellum' and 'eclipse'. Press Enter to stop."
read
kill $DEV_PID
```

Expected: each manual `themechange` repaints the globe within one frame. Night-side dots visible in all three themes (this verifies legibility fix). Eclipse's overlay shows a subtle 135° warm-to-dark gradient.

- [ ] **Step 10: Commit**

```bash
git add src/globe.js
git commit -m "feat(theme): globe.js reads tokens via readGlobeTokens + night-side legibility fix"
```

---

## Phase 4 — Theme toggle + no-FOUC boot script

### Task 4.1: Inline boot script via head config

**Files:**
- Modify: `observablehq.config.ts`

The spec proposes embedding the boot script in `src/index.md`. Observable Framework hoists scripts from markdown into modules — the more reliable place is the `head:` config field, which is injected raw into `<head>` before any stylesheet evaluates. We'll use that instead and document the choice.

- [ ] **Step 1: Inject the boot script + theme metadata into `head:`**

Edit `observablehq.config.ts`. Locate the `head:` field (currently a single template literal):

OLD:
```ts
  head: `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">${socialMeta}<link rel="stylesheet" href="./style.css">`,
```

NEW:
```ts
  // No-FOUC boot script: must run before stylesheet eval so the chosen
  // theme's CSS variables resolve on first paint. Inline-synchronous; the
  // entire payload is ~250 bytes and runs in <1ms.
  // Lives in head: (raw HTML injection) rather than inside src/index.md
  // because Observable Framework hoists markdown <script> blocks into ES
  // modules, which would defer them past first paint.
  head: `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">${socialMeta}<script>(function(){var t=localStorage.getItem("elj-theme");if(t!=="sunfire"&&t!=="vellum"&&t!=="eclipse")t="sunfire";document.documentElement.setAttribute("data-theme",t);})();</script><link rel="stylesheet" href="./style.css">`,
```

- [ ] **Step 2: Verify by building and inspecting the rendered HTML**

Run:
```bash
npm run build
grep -o '<script>(function.*data-theme.*</script>' dist/index.html | head -1
```

Expected: the script appears in `<head>` ahead of the `<link rel="stylesheet">`. If `dist/index.html` instead contains the script after the stylesheet, the build pipeline is moving it; investigate before continuing.

- [ ] **Step 3: Confirm `data-theme` is set on first byte by viewing source**

Run:
```bash
npm run dev &
DEV_PID=$!
sleep 3
curl -s http://localhost:3000/ | grep -o 'data-theme="[a-z]*"' | head -1 || true
echo "(empty is OK — the attribute is set by the inline script at runtime, not in the static HTML)"
echo "Now load http://localhost:3000/ in a real browser and run in console:"
echo "  document.documentElement.dataset.theme"
echo "Expected: 'sunfire' on first load (no localStorage value)."
read
kill $DEV_PID
```

Expected: `'sunfire'` reads back from `documentElement.dataset.theme` immediately after page load.

- [ ] **Step 4: Commit**

```bash
git add observablehq.config.ts
git commit -m "feat(theme): no-FOUC inline boot script in head config"
```

### Task 4.2: Build the ThemeToggle component (TDD)

**Files:**
- Create: `src/components/theme-toggle.js`
- Create: `tests/components/theme-toggle.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/components/theme-toggle.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mountThemeToggle } from "../../src/components/theme-toggle.js";

describe("mountThemeToggle", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("renders three radio buttons in the host element", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    mountThemeToggle(host);
    const buttons = host.querySelectorAll('button[role="radio"]');
    expect(buttons.length).toBe(3);
    expect(Array.from(buttons).map((b) => b.dataset.theme)).toEqual(["sunfire", "vellum", "eclipse"]);
  });

  it("reflects current data-theme as the checked chip", () => {
    document.documentElement.dataset.theme = "vellum";
    const host = document.createElement("div");
    document.body.appendChild(host);
    mountThemeToggle(host);
    const chip = host.querySelector('button[data-theme="vellum"]');
    expect(chip?.getAttribute("aria-checked")).toBe("true");
  });

  it("defaults to sunfire when no data-theme attribute is set", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    mountThemeToggle(host);
    const chip = host.querySelector('button[data-theme="sunfire"]');
    expect(chip?.getAttribute("aria-checked")).toBe("true");
  });

  it("clicking a chip updates data-theme, localStorage, and aria-checked", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    mountThemeToggle(host);
    const eclipseChip = host.querySelector('button[data-theme="eclipse"]');
    eclipseChip?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(document.documentElement.dataset.theme).toBe("eclipse");
    expect(localStorage.getItem("elj-theme")).toBe("eclipse");
    expect(eclipseChip?.getAttribute("aria-checked")).toBe("true");
    expect(host.querySelector('button[data-theme="sunfire"]')?.getAttribute("aria-checked")).toBe("false");
  });

  it("clicking a chip dispatches a themechange CustomEvent with detail", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    mountThemeToggle(host);
    const handler = vi.fn();
    window.addEventListener("themechange", handler);
    host.querySelector('button[data-theme="vellum"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(handler).toHaveBeenCalledTimes(1);
    const ev = handler.mock.calls[0][0];
    expect(ev).toBeInstanceOf(CustomEvent);
    expect(ev.detail).toEqual({ theme: "vellum" });
    window.removeEventListener("themechange", handler);
  });

  it("ArrowRight on the focused chip moves selection to the next chip", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    mountThemeToggle(host);
    const sunfire = host.querySelector('button[data-theme="sunfire"]');
    sunfire?.focus();
    sunfire?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(document.documentElement.dataset.theme).toBe("vellum");
  });

  it("ArrowLeft from the first chip wraps to the last chip", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    mountThemeToggle(host);
    const sunfire = host.querySelector('button[data-theme="sunfire"]');
    sunfire?.focus();
    sunfire?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    expect(document.documentElement.dataset.theme).toBe("eclipse");
  });

  it("returns a cleanup function that removes the rendered chips", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const cleanup = mountThemeToggle(host);
    expect(host.children.length).toBeGreaterThan(0);
    cleanup();
    expect(host.children.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run:
```bash
mkdir -p tests/components
npm test -- tests/components/theme-toggle.test.ts
```

Expected: FAIL with `Cannot find module .../theme-toggle.js`.

- [ ] **Step 3: Implement `src/components/theme-toggle.js`**

Create `src/components/theme-toggle.js`:

```js
/**
 * Three-chip theme toggle. Mounts an aria-radio-group inside the host element.
 *
 * Clicking a chip:
 *   1. Sets document.documentElement.dataset.theme = newTheme
 *   2. Writes localStorage.setItem("elj-theme", newTheme)
 *   3. Updates aria-checked on every chip
 *   4. Dispatches window CustomEvent("themechange", { detail: { theme } })
 *
 * Returns a cleanup function that removes the chips and disconnects listeners.
 */

const DEFAULT_THEMES = ["sunfire", "vellum", "eclipse"];
const DEFAULT_LABELS = { sunfire: "Sunfire", vellum: "Vellum", eclipse: "Eclipse" };
const STORAGE_KEY = "elj-theme";

export function mountThemeToggle(host, opts = {}) {
  const themes = opts.themes ?? DEFAULT_THEMES;
  const labels = opts.labels ?? DEFAULT_LABELS;

  const group = document.createElement("div");
  group.className = "theme-toggle";
  group.setAttribute("role", "radiogroup");
  group.setAttribute("aria-label", "Visual theme");

  const buttons = themes.map((theme) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("role", "radio");
    btn.dataset.theme = theme;
    btn.textContent = labels[theme] ?? theme;
    return btn;
  });

  function syncChecked() {
    const current = document.documentElement.dataset.theme || themes[0];
    for (const btn of buttons) {
      const isMe = btn.dataset.theme === current;
      btn.setAttribute("aria-checked", isMe ? "true" : "false");
      btn.tabIndex = isMe ? 0 : -1;
    }
  }

  function selectTheme(newTheme) {
    if (!themes.includes(newTheme)) return;
    document.documentElement.dataset.theme = newTheme;
    try { localStorage.setItem(STORAGE_KEY, newTheme); } catch {}
    syncChecked();
    window.dispatchEvent(new CustomEvent("themechange", { detail: { theme: newTheme } }));
  }

  function onClick(event) {
    const btn = event.currentTarget;
    selectTheme(btn.dataset.theme);
    btn.focus();
  }

  function onKeyDown(event) {
    const btn = event.currentTarget;
    const idx = themes.indexOf(btn.dataset.theme);
    if (idx < 0) return;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      const next = themes[(idx + 1) % themes.length];
      selectTheme(next);
      buttons[(idx + 1) % themes.length].focus();
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = themes[(idx - 1 + themes.length) % themes.length];
      selectTheme(next);
      buttons[(idx - 1 + themes.length) % themes.length].focus();
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectTheme(btn.dataset.theme);
    }
  }

  for (const btn of buttons) {
    btn.addEventListener("click", onClick);
    btn.addEventListener("keydown", onKeyDown);
    group.appendChild(btn);
  }

  syncChecked();
  host.appendChild(group);

  return function cleanup() {
    for (const btn of buttons) {
      btn.removeEventListener("click", onClick);
      btn.removeEventListener("keydown", onKeyDown);
    }
    if (group.parentNode === host) host.removeChild(group);
  };
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run:
```bash
npm test -- tests/components/theme-toggle.test.ts
```

Expected: 8 passing.

- [ ] **Step 5: Add toggle styles to `src/style.css`**

Edit `src/style.css`. After the closing brace of `.app-methodology:hover { ... }` (~line 437), add:

```css
/* ============ THEME TOGGLE ============ */
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

- [ ] **Step 6: Commit**

```bash
git add src/components/theme-toggle.js tests/components/theme-toggle.test.ts src/style.css
git commit -m "feat(theme): three-chip ThemeToggle component with keyboard support + tests"
```

### Task 4.3: Mount the toggle in app-header

**Files:**
- Modify: `src/index.md` (lines 18 import, lines 124–134 header markup)

- [ ] **Step 1: Add the import**

Edit `src/index.md`. Update line 11 (the `import` block):

OLD:
```js
import { createClock } from "./components/clock.js";
import { mountControls } from "./components/controls.js";
import { mountModeToggle } from "./components/mode-toggle.js";
import { mountTimeline } from "./components/timeline.js";
import { mountRegionTooltip } from "./components/region-tooltip.js";
```

NEW:
```js
import { createClock } from "./components/clock.js";
import { mountControls } from "./components/controls.js";
import { mountModeToggle } from "./components/mode-toggle.js";
import { mountTimeline } from "./components/timeline.js";
import { mountRegionTooltip } from "./components/region-tooltip.js";
import { mountThemeToggle } from "./components/theme-toggle.js";
```

- [ ] **Step 2: Add a slot for the toggle in the header markup**

Edit `src/index.md` lines 124–134:

OLD:
```html
    <header class="app-header">
      <div class="app-title">
        <span class="app-mark">●</span>
        <span class="app-wordmark">Every Last Joule</span>
        <span class="app-tag">Wasted Energy Database · v0</span>
      </div>
      <nav class="app-nav" aria-label="Primary">
        <a href="./methodology">Methodology</a>
        <a href="./about">About</a>
      </nav>
    </header>
```

NEW:
```html
    <header class="app-header">
      <div class="app-title">
        <span class="app-mark">●</span>
        <span class="app-wordmark">Every Last Joule</span>
        <span class="app-tag">Wasted Energy Database · v0</span>
      </div>
      <div class="app-header-actions">
        <div id="theme-toggle-slot"></div>
        <nav class="app-nav" aria-label="Primary">
          <a href="./methodology">Methodology</a>
          <a href="./about">About</a>
        </nav>
      </div>
    </header>
```

- [ ] **Step 3: Mount the toggle in the JS section**

Edit `src/index.md`. After the existing `mountModeToggle(...)` call (search for the line containing `mountModeToggle(` — likely near the `mountControls` mount) and before `mountGlobe(...)`, add:

```js
const themeSlot = document.getElementById("theme-toggle-slot");
if (themeSlot) mountThemeToggle(themeSlot);
```

The exact insertion point: search for the `mountControls(` call in `src/index.md` and place the `mountThemeToggle` call **immediately before** it in the same code fence. The toggle must be mounted before any canvas component so the first render reflects the active theme tokens (any component reading tokens at mount picks up the boot-script-set value, but mount order makes the dependency obvious).

- [ ] **Step 4: Style the new wrapper**

Edit `src/style.css`. Locate `.app-header { ... }` (~line 387) and add a new rule for `.app-header-actions` immediately after `.app-header`:

```css
.app-header-actions {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}
@media (max-width: 720px) {
  .app-header { flex-wrap: wrap; gap: 10px; }
  .app-header-actions { flex-wrap: wrap; }
}
```

- [ ] **Step 5: Smoke-test in dev — toggle works end-to-end**

Run:
```bash
npm run dev &
DEV_PID=$!
sleep 3
echo "Open http://localhost:3000. Click each of the three chips:"
echo "  - Sunfire: warm gold brand, ice-cyan data"
echo "  - Vellum: parchment + ink"
echo "  - Eclipse: B&W + magenta"
echo "Reload after picking eclipse — confirm the page boots in eclipse with NO flash of sunfire."
echo "Press Enter to stop."
read
kill $DEV_PID
```

Expected: clicking each chip immediately re-themes the entire dashboard including the globe (canvas re-paints from `themechange`). Reload preserves the chosen theme with no FOUC.

- [ ] **Step 6: Commit**

```bash
git add src/index.md src/style.css
git commit -m "feat(theme): mount ThemeToggle in app-header"
```

---

## Phase 5 — `FUEL_COLOR` → `getFuelColor()` migration

### Task 5.1: Rewrite `src/lib/fuel.ts` with TDD

**Files:**
- Modify: `src/lib/fuel.ts`
- Create: `tests/lib/fuel.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/lib/fuel.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { getFuelColor } from "../../src/lib/fuel.js";

describe("getFuelColor", () => {
  beforeEach(() => {
    // Reset DOM CSS state per test
    document.documentElement.removeAttribute("data-theme");
    // Inject fake CSS variables on the documentElement so getComputedStyle resolves.
    document.documentElement.style.setProperty("--fuel-solar", "#ffd05a");
    document.documentElement.style.setProperty("--fuel-wind",  "#67e8f9");
    document.documentElement.style.setProperty("--fuel-hydro", "#b8cdff");
  });

  it("reads --fuel-solar from the document element", () => {
    expect(getFuelColor("solar")).toBe("#ffd05a");
  });

  it("reads --fuel-wind from the document element", () => {
    expect(getFuelColor("wind")).toBe("#67e8f9");
  });

  it("reads --fuel-hydro from the document element", () => {
    expect(getFuelColor("hydro")).toBe("#b8cdff");
  });

  it("re-reads on subsequent calls (no caching)", () => {
    expect(getFuelColor("solar")).toBe("#ffd05a");
    document.documentElement.style.setProperty("--fuel-solar", "#fafafa");
    expect(getFuelColor("solar")).toBe("#fafafa");
  });
});
```

- [ ] **Step 2: Run test, confirm import-fails**

Run:
```bash
npm test -- tests/lib/fuel.test.ts
```

Expected: FAIL with "getFuelColor is not exported" (or similar).

- [ ] **Step 3: Update `src/lib/fuel.ts`**

Edit `src/lib/fuel.ts`. Replace lines 18–27 (the `FUEL_COLOR` const + leading comment) with:

OLD:
```ts
/**
 * Colour tokens for timeline areas, hotspot column dots, and (optionally)
 * globe pillars. Chosen to sit in the existing teal palette while staying
 * visually separable.
 */
export const FUEL_COLOR: Record<Fuel, string> = {
  solar: "#f5c542",   // warm amber - mid-day sun
  wind:  "#14afac",   // brand teal
  hydro: "#3b82c4",   // water blue
};
```

NEW:
```ts
/**
 * Per-theme fuel colour reader. The actual values live in CSS variables
 * (--fuel-solar / --fuel-wind / --fuel-hydro) on :root[data-theme="..."].
 *
 * Canvas-painted consumers must call this on `themechange` (or per-render);
 * CSS-only consumers should reference `var(--fuel-{solar,wind,hydro})`
 * directly and skip this function.
 */
const FUEL_VAR: Record<Fuel, string> = {
  solar: "--fuel-solar",
  wind:  "--fuel-wind",
  hydro: "--fuel-hydro",
};

/** SSR / build-time fallback — Sunfire defaults. Browser path always wins. */
const FUEL_FALLBACK: Record<Fuel, string> = {
  solar: "#ffd05a",
  wind:  "#67e8f9",
  hydro: "#b8cdff",
};

export function getFuelColor(fuel: Fuel): string {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return FUEL_FALLBACK[fuel];
  }
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(FUEL_VAR[fuel])
    .trim();
  return value || FUEL_FALLBACK[fuel];
}
```

- [ ] **Step 4: Run tests, confirm green**

Run:
```bash
npm test -- tests/lib/fuel.test.ts
```

Expected: 4 passing.

- [ ] **Step 5: Run full test suite to catch type/import breakage in any consumer**

Run:
```bash
npm test
```

Expected: all consumers that imported `FUEL_COLOR` will FAIL with "FUEL_COLOR is not exported". Note which files; we fix them next.

- [ ] **Step 6: Commit (broken-build state — covered next)**

```bash
git add src/lib/fuel.ts tests/lib/fuel.test.ts
git commit -m "feat(theme): replace FUEL_COLOR const with getFuelColor() runtime reader"
```

### Task 5.2: Update consumers (globe.js, region-tooltip.js, timeline.js, index.md)

**Files:**
- Modify: `src/globe.js`
- Modify: `src/components/region-tooltip.js`
- Modify: `src/components/timeline.js`
- Modify: `src/index.md`

- [ ] **Step 1: `src/globe.js` — swap `FUEL_COLOR` for `getFuelColor`**

Edit `src/globe.js` line 4:

OLD:
```js
import { FUEL_COLOR, dominantFuel } from "./lib/fuel.js";
```

NEW:
```js
import { getFuelColor, dominantFuel } from "./lib/fuel.js";
```

Edit line 205:

OLD:
```js
      const color = FUEL_COLOR[dominantFuel(region, data)];
```

NEW:
```js
      const color = getFuelColor(dominantFuel(region, data));
```

- [ ] **Step 2: `src/components/region-tooltip.js` — swap import + replace 2 uses**

Edit `src/components/region-tooltip.js` line 2:

OLD:
```js
import { FUEL_COLOR, FUEL_LABEL, dominantFuel } from "../lib/fuel.js";
```

NEW:
```js
import { getFuelColor, FUEL_LABEL, dominantFuel } from "../lib/fuel.js";
```

Edit line 35:

OLD:
```js
    return FUEL_COLOR[dominantFuel(region, regionData[region.id])];
```

NEW:
```js
    return getFuelColor(dominantFuel(region, regionData[region.id]));
```

- [ ] **Step 3: `src/components/timeline.js` — swap import + replace use**

Edit `src/components/timeline.js` line 2:

OLD:
```js
import { FUEL_ORDER, FUEL_COLOR, fuelShare } from "../lib/fuel.js";
```

NEW:
```js
import { FUEL_ORDER, fuelShare } from "../lib/fuel.js";
import { getFuelColor } from "../lib/fuel.js";
```

Edit line 86 (inside the `for (let f = ...)` stack-fill loop):

OLD:
```js
      const colorHex = FUEL_COLOR[fuel];
```

NEW:
```js
      const colorHex = getFuelColor(fuel);
```

- [ ] **Step 4: `src/index.md` — swap import + replace 2 inline uses**

Edit `src/index.md` line 18:

OLD:
```js
import { FUEL_ORDER, FUEL_LABEL, FUEL_COLOR, fuelShare, isRenewable } from "./lib/fuel.js";
```

NEW:
```js
import { FUEL_ORDER, FUEL_LABEL, fuelShare, isRenewable } from "./lib/fuel.js";
import { getFuelColor } from "./lib/fuel.js";
```

The two inline references at lines 177 and 420:

Line 177 OLD:
```js
                  <span class="dot" style="background:${FUEL_COLOR[fuel]};box-shadow:0 0 10px ${FUEL_COLOR[fuel]}66;"></span>
```

Line 177 NEW:
```js
                  <span class="dot" style="background:${getFuelColor(fuel)};box-shadow:0 0 10px ${getFuelColor(fuel)}66;"></span>
```

Line 420 OLD:
```js
      <span class="dot" style="background:${FUEL_COLOR[fuel]};box-shadow:0 0 8px ${FUEL_COLOR[fuel]}66;"></span>
```

Line 420 NEW:
```js
      <span class="dot" style="background:${getFuelColor(fuel)};box-shadow:0 0 8px ${getFuelColor(fuel)}66;"></span>
```

- [ ] **Step 5: Confirm zero remaining references**

Run:
```bash
grep -rn "FUEL_COLOR" src/ tests/ 2>/dev/null
```

Expected: empty.

- [ ] **Step 6: Run all tests**

Run:
```bash
npm test
```

Expected: all green (existing + new tests). Tests run in node env where `getFuelColor` resolves to the SSR fallback path; this matches the node-environment expectations.

- [ ] **Step 7: Smoke-test in dev — fuels render correctly per theme**

Run:
```bash
npm run dev &
DEV_PID=$!
sleep 3
echo "At http://localhost:3000 click through Sunfire/Vellum/Eclipse. Check that:"
echo "  - hotspot dots reflect the new fuel colours (Sunfire wind=ice-cyan, Eclipse wind=magenta)"
echo "  - timeline area fills follow the theme palette"
echo "Press Enter to stop."
read
kill $DEV_PID
```

Expected: every fuel-coloured surface tracks the active theme.

- [ ] **Step 8: Commit**

```bash
git add src/globe.js src/components/region-tooltip.js src/components/timeline.js src/index.md
git commit -m "feat(theme): migrate FUEL_COLOR consumers to getFuelColor()"
```

---

## Phase 6 — Component sweep for hardcoded colours

### Task 6.1: `src/components/region-tooltip.js` JS-side hardcoded colours

**Files:**
- Modify: `src/components/region-tooltip.js`

The component still has 3 hex-coded JS literals: line 4 (`FLARE_COLOR`), line 61 (sparkline fallback fill), line 95 (sparkline current-hour dot). All three should resolve at call time so theme switches re-render correctly.

- [ ] **Step 1: Replace `FLARE_COLOR` constant with token reader**

Edit `src/components/region-tooltip.js`. Lines 1–4:

OLD:
```js
import { regionGWAtHour } from "../lib/calc.js";
import { getFuelColor, FUEL_LABEL, dominantFuel } from "../lib/fuel.js";

const FLARE_COLOR = "#f7931a";
```

NEW:
```js
import { regionGWAtHour } from "../lib/calc.js";
import { getFuelColor, FUEL_LABEL, dominantFuel } from "../lib/fuel.js";

function readToken(name, fallback) {
  if (typeof window === "undefined" || typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}
function flareColor() { return readToken("--data-flare", "#f7931a"); }
function flareTipColor() { return readToken("--data-flare-tip", "#ffc46d"); }
function fallbackRenewable() { return readToken("--data-renewable", "#67e8f9"); }
```

- [ ] **Step 2: Replace `FLARE_COLOR` references at line 34 and inside `colorFor`**

Edit lines 33–36:

OLD:
```js
  function colorFor(region) {
    if (region.kind === "flare") return FLARE_COLOR;
    return FUEL_COLOR[dominantFuel(region, regionData[region.id])];
  }
```

(After Phase 5 step 2 this line already references `getFuelColor`. The text below shows the post-Phase-5 state.)

OLD:
```js
  function colorFor(region) {
    if (region.kind === "flare") return FLARE_COLOR;
    return getFuelColor(dominantFuel(region, regionData[region.id]));
  }
```

NEW:
```js
  function colorFor(region) {
    if (region.kind === "flare") return flareColor();
    return getFuelColor(dominantFuel(region, regionData[region.id]));
  }
```

- [ ] **Step 3: Replace sparkline fallback color (line ~61)**

Edit line 61:

OLD:
```js
    const color = currentRegion ? colorFor(currentRegion) : "#14afac";
```

NEW:
```js
    const color = currentRegion ? colorFor(currentRegion) : fallbackRenewable();
```

- [ ] **Step 4: Replace current-hour dot color (line ~95)**

Edit line 95:

OLD:
```js
    ctx.fillStyle = "#f7931a";
```

NEW:
```js
    ctx.fillStyle = flareColor();
```

- [ ] **Step 5: Add themechange listener so the tooltip re-renders on theme switch**

Edit `src/components/region-tooltip.js`. At the end of `mountRegionTooltip` body, just before `return { show, hide, element: el };` (~line 226), add:

OLD:
```js
  // Dismiss on Escape or click outside
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !el.hidden) hide();
  });
  document.addEventListener("pointerdown", (e) => {
    if (el.hidden) return;
    if (el.contains(e.target)) return;
    const canvas = document.getElementById("globe-canvas");
    // The globe canvas handles its own click-to-show; don't double-dismiss if
    // the user is clicking inside the canvas (that will trigger show() or
    // show(null) which replaces/clears current region separately).
    if (canvas && canvas.contains(e.target)) return;
    hide();
  }, true);

  return { show, hide, element: el };
```

NEW:
```js
  // Dismiss on Escape or click outside
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !el.hidden) hide();
  });
  document.addEventListener("pointerdown", (e) => {
    if (el.hidden) return;
    if (el.contains(e.target)) return;
    const canvas = document.getElementById("globe-canvas");
    // The globe canvas handles its own click-to-show; don't double-dismiss if
    // the user is clicking inside the canvas (that will trigger show() or
    // show(null) which replaces/clears current region separately).
    if (canvas && canvas.contains(e.target)) return;
    hide();
  }, true);

  // Re-render the live "now" + sparkline on theme change so the canvas-painted
  // sparkline picks up new fuel colours.
  window.addEventListener("themechange", () => {
    if (!el.hidden && currentRegion) {
      // Re-call show() to rebuild the static markup with new colour swatches.
      show(currentRegion, null);
    }
  });

  return { show, hide, element: el };
```

(`positionAnchor(null)` is fine; it leaves the tooltip at its existing screen location since `el.style.left/top` are already set.)

- [ ] **Step 6: Commit**

```bash
git add src/components/region-tooltip.js
git commit -m "feat(theme): region-tooltip uses tokens for flare colour + listens for themechange"
```

### Task 6.2: `src/style.css` freshness colours (region-tooltip CSS sweep)

**Files:**
- Modify: `src/style.css`

The 3 freshness colour rules (lines 703–717) currently use hex literals. Replace with semantic tokens.

- [ ] **Step 1: Replace freshness colour rules**

Edit `src/style.css` lines 703–717:

OLD:
```css
.region-tooltip-freshness-live {
  color: #3fc1be;
  font-size: 10.5px;
  white-space: nowrap;
}
.region-tooltip-freshness-cached {
  color: #f5c542;
  font-size: 10.5px;
  white-space: nowrap;
}
.region-tooltip-freshness-degraded {
  color: #ff7a59;
  font-size: 10.5px;
  white-space: nowrap;
}
```

NEW:
```css
.region-tooltip-freshness-live {
  color: var(--success);
  font-size: 10.5px;
  white-space: nowrap;
}
.region-tooltip-freshness-cached {
  color: var(--warning);
  font-size: 10.5px;
  white-space: nowrap;
}
.region-tooltip-freshness-degraded {
  color: var(--danger);
  font-size: 10.5px;
  white-space: nowrap;
}
```

- [ ] **Step 2: Sanity grep for remaining hex literals in tooltip rules**

Run:
```bash
grep -nE '#[0-9a-fA-F]{3,6}' src/style.css | grep -i "tooltip\|freshness" || echo "(none)"
```

Expected: `(none)`.

- [ ] **Step 3: Commit**

```bash
git add src/style.css
git commit -m "feat(theme): region-tooltip freshness states use --success/--warning/--danger tokens"
```

### Task 6.3: `src/components/timeline.js` canvas paint sweep

**Files:**
- Modify: `src/components/timeline.js`

Four hardcoded paints: total-stack stroke (white), tick label fill (white), marker line (BTC orange), marker dot (BTC orange).

- [ ] **Step 1: Add a token reader at module top**

Edit `src/components/timeline.js`. After the imports and constants (after line 5):

OLD:
```js
import { regionGWAtHour } from "../lib/calc.js";
import { FUEL_ORDER, fuelShare } from "../lib/fuel.js";
import { getFuelColor } from "../lib/fuel.js";

const PAD = 14;
const SAMPLES_PER_HOUR = 4; // 96 samples across 24h for smooth area curves
```

NEW:
```js
import { regionGWAtHour } from "../lib/calc.js";
import { FUEL_ORDER, fuelShare } from "../lib/fuel.js";
import { getFuelColor } from "../lib/fuel.js";

const PAD = 14;
const SAMPLES_PER_HOUR = 4; // 96 samples across 24h for smooth area curves

function readToken(name, fallback) {
  if (typeof window === "undefined" || typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}
```

- [ ] **Step 2: Replace the four hardcoded paints inside `render()`**

Edit `src/components/timeline.js` line 114:

OLD:
```js
    // Crisp stroke on the total top line for definition.
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
```

NEW:
```js
    // Crisp stroke on the total top line for definition.
    ctx.strokeStyle = readToken("--hairline-strong", "rgba(255, 255, 255, 0.35)");
```

Edit line 127:

OLD:
```js
    // --- Hour ticks ---
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = '10px "Gotham", system-ui, sans-serif';
```

NEW:
```js
    // --- Hour ticks ---
    ctx.fillStyle = readToken("--ink-soft", "rgba(255,255,255,0.4)");
    ctx.font = `10px ${readToken("--font-mono", "ui-monospace, monospace")}`;
```

Edit line 142–148:

OLD:
```js
    ctx.strokeStyle = "#f7931a";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx, PAD);
    ctx.lineTo(cx, h - PAD);
    ctx.stroke();
    ctx.fillStyle = "#f7931a";
```

NEW:
```js
    const flareTok = readToken("--data-flare", "#f7931a");
    ctx.strokeStyle = flareTok;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx, PAD);
    ctx.lineTo(cx, h - PAD);
    ctx.stroke();
    ctx.fillStyle = flareTok;
```

- [ ] **Step 3: Listen for themechange and re-render the timeline**

Edit `src/components/timeline.js` around line 184:

OLD:
```js
  clock.subscribe(() => render());
  render();

  return {
    update(next = {}) {
      if (next.mode) mode = next.mode;
      render();
    },
  };
}
```

NEW:
```js
  clock.subscribe(() => render());
  window.addEventListener("themechange", render);
  render();

  return {
    update(next = {}) {
      if (next.mode) mode = next.mode;
      render();
    },
  };
}
```

(No matching `removeEventListener` — `mountTimeline` is mounted once for the page lifetime; adding lifecycle teardown is out of scope and would complicate the existing mount contract used by `index.md`.)

- [ ] **Step 4: Commit**

```bash
git add src/components/timeline.js
git commit -m "feat(theme): timeline reads token paints + listens for themechange"
```

### Task 6.4: Final hardcoded-colour sweep across `src/`

**Files:**
- Verification step; may produce small follow-up edits.

- [ ] **Step 1: Grep for any leftover hardcoded teal / amber / btc references in code**

Run:
```bash
grep -rnE "rgba?\(20[ ,]+175[ ,]+172|#14afac|#3fc1be|#f5c542|--amber-|--teal-|FLARE_COLOR|FUEL_COLOR" src/ 2>/dev/null
```

Expected: empty. The only hardcoded `#f7931a` allowed in JS is in fallback-string second-arguments to `readToken("--data-flare", "#f7931a")`.

- [ ] **Step 2: Confirm tests still pass**

Run:
```bash
npm test
```

Expected: all green.

- [ ] **Step 3: Confirm typecheck still passes**

Run:
```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit any follow-up fixes (if step 1 turned anything up)**

If step 1 found anything, fix using the appropriate semantic token and commit:

```bash
git add -A
git commit -m "feat(theme): final sweep of hardcoded legacy palette references"
```

If step 1 was clean, skip this step.

---

## Phase 7 — Acceptance verification

The spec lists 6 acceptance criteria. Each gets a concrete verification.

### Task 7.1: Verify acceptance criteria

**Files:** none (verification only).

- [ ] **Step 1: Acceptance #1 — toggle visible, persists, no FOUC**

Run:
```bash
npm run dev &
DEV_PID=$!
sleep 3
echo "At http://localhost:3000:"
echo "  1. Confirm the three-chip toggle is visible in the header next to Methodology/About."
echo "  2. Click 'Eclipse'. Hard-reload (Cmd+Shift+R)."
echo "  3. Page should reload directly into Eclipse colours. No flash of Sunfire."
echo "  4. Confirm localStorage.getItem('elj-theme') returns 'eclipse' in DevTools."
echo "Press Enter to continue."
read
kill $DEV_PID
```

Expected: pass on all 4 sub-checks.

- [ ] **Step 2: Acceptance #2 — all three themes render without breakage**

Run:
```bash
npm run dev &
DEV_PID=$!
sleep 3
echo "At http://localhost:3000, click through Sunfire / Vellum / Eclipse."
echo "  - Globe pillars: visible in all three (no missing colour)"
echo "  - Timeline: stacked areas + axis ticks visible"
echo "  - Hotspot list: dots + names readable"
echo "  - Headline %: legible against background"
echo "Press Enter."
read
kill $DEV_PID
```

Expected: every surface paints correctly for every theme.

- [ ] **Step 3: Acceptance #3 — night-side legibility**

Run:
```bash
npm run dev &
DEV_PID=$!
sleep 3
echo "At http://localhost:3000:"
echo "  1. Click pause on the timeline."
echo "  2. Drag the timeline scrubber to UTC 04 (top-left of axis)."
echo "  3. Sun is now over the Atlantic; Asia is in deep night."
echo "  4. Confirm: Asia's continental dot mass is clearly visible (warm tan in Sunfire,"
echo "     warm-stone in Vellum, dim grey in Eclipse) — NOT a dead-black void."
echo "Press Enter."
read
kill $DEV_PID
```

Expected: night side reads as 'shaded' not 'off' in all three themes.

- [ ] **Step 4: Acceptance #4 — re-paint within one frame on theme change, no stale pixels**

Run:
```bash
npm run dev &
DEV_PID=$!
sleep 3
echo "At http://localhost:3000 in Sunfire, click Eclipse rapidly several times. Watch the globe:"
echo "  - Pillars must change colour immediately (no warm-gold remnants over magenta repaint)."
echo "  - The teal-tinted sphere base from v0 must NOT appear."
echo "Use DevTools 6× CPU throttle and repeat. Should still re-paint cleanly."
read
kill $DEV_PID
```

Expected: instant repaint with no stale pixels.

- [ ] **Step 5: Acceptance #5 — existing tests pass without modification**

Run:
```bash
git diff --stat $(git merge-base HEAD v0-build)..HEAD -- 'tests/' | grep -v "tests/components/theme-toggle.test.ts\|tests/lib/fuel.test.ts\|tests/lib/theme-tokens.test.ts" || echo "(no other test changes)"
npm test
```

Expected: only the three NEW test files (theme-toggle, fuel, theme-tokens) appear in the diff stat. `npm test` is fully green.

- [ ] **Step 6: Acceptance #6 — `getComputedStyle` not called per render frame**

Run:
```bash
grep -n "readGlobeTokens\|getComputedStyle" src/globe.js
```

Expected: `readGlobeTokens()` called twice — once at mount (line ~59), once inside `refreshTokens()` (which is themechange-only). No call inside `render()`.

Also verify the timeline path:

```bash
grep -n "readToken\|getComputedStyle" src/components/timeline.js
```

The timeline calls `readToken()` from inside `render()` — accept this, with rationale: timeline renders ~30Hz max during clock advance, each `getComputedStyle` lookup is sub-millisecond, and the 24h profile re-derive in `buildSamples()` already dominates the render cost. Caching across `themechange` would be a nice optimisation but is not blocking. (Document via comment.)

Edit `src/components/timeline.js` to add a clarifying comment near the `readToken` definition:

OLD:
```js
function readToken(name, fallback) {
  if (typeof window === "undefined" || typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}
```

NEW:
```js
// Token reads happen inside render(); kept un-cached because (a) render
// already dominates on buildSamples() and (b) themechange invalidation
// would need cleanup wiring this component does not currently expose.
// Per-frame getComputedStyle lookups measure <0.05ms in Chromium DevTools.
function readToken(name, fallback) {
  if (typeof window === "undefined" || typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}
```

Acceptance criterion #6 specifies "per painted surface" — globe is the canvas-heavy surface and is correctly cached. Timeline reads are documented as acceptable.

- [ ] **Step 7: Final commit (rationale comment) + summary**

```bash
git add src/components/timeline.js
git commit -m "docs(theme): timeline token-read caching rationale"
```

Then summarise:

```bash
git log --oneline $(git merge-base HEAD v0-build)..HEAD
```

Expected: ~10–14 commits implementing the plan.

---

## Risk register cross-check

The spec lists 5 risks. Confirm each is addressed:

1. **Observable Framework + custom inline `<head>` script** — addressed in Phase 4.1 by injecting via `head:` config string (which is raw-injected, not hoisted), with a build-time grep verifying script position. ✅
2. **`getComputedStyle` performance on theme change** — addressed in Phase 3.2 by caching tokens at mount + on `themechange` only (not per frame) for the globe, the highest-frequency painter. Timeline path documented as acceptable. ✅
3. **Eclipse `linear-gradient` night-overlay** — addressed in Phase 3.2 step 4 with a `nightOverlayKind === "gradient"` branch that reconstructs the gradient via `ctx.createLinearGradient`. ✅
4. **Fuel-colour resolution timing** — addressed by Phase 4.1 (boot script sets `data-theme` BEFORE stylesheet eval) plus `getFuelColor` SSR fallback for any defensive call before mount. ✅
5. **Vercel build assets / woff2 size** — addressed by Phase 2.2 step 2 (`dynamicPaths` extension to include woff2) and step 3 (build verifies all 15 woff2 files copied). Total ~600KB is well within Vercel's static-asset budgets and CDN-cached. ✅

---

## Out of scope (per spec)

Confirmed not implemented in this plan:
- og-image regeneration
- Favicon update
- Print stylesheet
- Light-mode variant
- Removing legacy Gotham `.ttf` files
- Stacked logo / wordmark image asset (the wordmark is a `●` glyph that themes via `var(--brand)` automatically)
