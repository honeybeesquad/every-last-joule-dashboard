> **STATUS: SHIPPED / ARCHIVED.** The theme system is already live. This file remains only as historical planning context.

# Theme System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple the dashboard from Stacked's brand teal by shipping three runtime-switchable themes (Sunfire / Vellum / Eclipse) selected via an app-header toggle, persisted to `localStorage`, painted on a CSS-variable foundation, plus a globe night-side legibility fix.

**Architecture:** Single CSS file owns three `:root[data-theme="<name>"]` token blocks. JavaScript surfaces (only `globe.js` paints to canvas) read tokens via `getComputedStyle(documentElement)` once at mount and on `themechange` CustomEvent — never per frame. A no-FOUC inline `<head>` script reads `localStorage.elj-theme` and sets the data attribute before first paint. `FUEL_COLOR` (a frozen literal map) becomes `getFuelColor(fuel)`, a runtime token reader. Fonts are self-hosted woff2 in `src/fonts/`.

**Tech Stack:** Observable Framework markdown + vanilla JS components, CSS custom properties, vitest (`environment: "node"` by default; jsdom opted in per-file), `localStorage`, `CustomEvent("themechange")`. No new runtime dependencies. `jsdom` added as devDependency for the two new DOM-touching test files.

**Spec:** [`docs/superpowers/specs/2026-04-27-theme-system-design.md`](../specs/2026-04-27-theme-system-design.md). Acceptance criteria from §"Acceptance criteria" are verified by Tasks 14 and 15.

**Branch:** `feat/theme-system-spec` (already created off `v0-build@4f8e1b1`, with one commit `cd2109f` containing the spec).

---

## File structure

### Files to create

| Path | Purpose |
|---|---|
| `src/components/theme-toggle.js` | Three-chip radiogroup component; sets `data-theme`, writes localStorage, dispatches `themechange`. |
| `src/lib/theme-tokens.ts` | Pure helpers: `parseHexToRGB(hex) → "r,g,b"`, `readGlobeTokens(documentElement) → GlobeTokens`. Imported by `globe.js` (via the `.js` extension) and tested in `tests/theme-tokens.test.ts`. |
| `tests/theme-tokens.test.ts` | Unit tests for `parseHexToRGB` and the SSR-fallback branch of `getFuelColor`. |
| `tests/theme-toggle.test.ts` | jsdom unit tests for the toggle component (initial state, click, keyboard, localStorage, custom event). |
| `tests/fuel-color.test.ts` | jsdom unit tests for `getFuelColor` (returns trimmed token; falls back to Sunfire defaults under SSR). |
| `src/fonts/Fraunces-Regular.woff2`<br>`src/fonts/Fraunces-SemiBold.woff2`<br>`src/fonts/Fraunces-ExtraBold.woff2` | Sunfire display serif. |
| `src/fonts/Inter-Regular.woff2`<br>`src/fonts/Inter-Medium.woff2`<br>`src/fonts/Inter-Bold.woff2` | Sunfire body sans. |
| `src/fonts/Spectral-Regular.woff2`<br>`src/fonts/Spectral-Medium.woff2`<br>`src/fonts/Spectral-Bold.woff2` | Vellum editorial serif. |
| `src/fonts/FrankRuhlLibre-Bold.woff2`<br>`src/fonts/FrankRuhlLibre-Black.woff2` | Eclipse display serif. |
| `src/fonts/IBMPlexSans-Regular.woff2`<br>`src/fonts/IBMPlexSans-Medium.woff2`<br>`src/fonts/IBMPlexSans-Bold.woff2` | Eclipse body sans. |
| `src/fonts/IBMPlexMono-Medium.woff2` | All themes — toggle chip labels and freshness badges. |
| `src/fonts/SOURCES.md` | Provenance of each woff2 (URL, license, version) so the font set is reproducible. |

### Files to modify

| Path | Change |
|---|---|
| `src/style.css` | Add 14 new `@font-face` declarations next to existing Gotham block. Move existing `:root` token contents into `:root[data-theme="sunfire"]`. Add `[data-theme="vellum"]` and `[data-theme="eclipse"]` blocks with full token sets from spec §"CSS variable structure". Remove `--teal-*` and `--slate-*` palette scales. Replace direct `var(--teal-500)` / `rgba(20,175,172,…)` / `rgba(255,255,255,0.06)` references in chrome rules with semantic tokens (`--brand`, `--hairline`, `--ink`, `--surface-bg-*`). Replace literal background gradient on `html, body` and `#page-loader` with token-driven gradient. Add `.theme-toggle` rules from spec §"Theme toggle component". |
| `src/globe.js` | Replace 8 hardcoded colour literals (lines 137, 149–151, 160, 172, 181, 187) with values from a cached `tokens` object populated via `readGlobeTokens(document.documentElement)`. Subscribe to `window.themechange` to refresh `tokens` and re-render. Apply night-side legibility fix per spec §"Night-side legibility fix": brightness floor `0.05` → `0.30`, dual-color dots transitioning at `sunlit > 0.3`, replace black night overlay. Handle Eclipse's `linear-gradient` night-overlay token by detecting the `linear-gradient(...)` form and synthesizing a `ctx.createLinearGradient()` instead of using the rgba string directly. |
| `src/components/region-tooltip.js` | Replace `FUEL_COLOR` import with `getFuelColor`; replace the literal `FLARE_COLOR = "#f7931a"` with `getFuelColor("flare")` (extending the function to accept `"flare"`); replace the `currentRegion ? colorFor(currentRegion) : "#14afac"` fallback with `getFuelColor("wind")`; replace the orange dot literal `"#f7931a"` with `getFuelColor("flare")`. |
| `src/components/timeline.js` | Replace `FUEL_COLOR[fuel]` with `getFuelColor(fuel)`. Replace the white-stroke literal `"rgba(255, 255, 255, 0.35)"` with `getComputedStyle(document.documentElement).getPropertyValue("--hairline-strong").trim()`. Replace the orange marker literals `"#f7931a"` (×2) with `getFuelColor("flare")`. Subscribe to `themechange` to invalidate cached colour values and re-render. |
| `src/lib/fuel.ts` | Replace exported `FUEL_COLOR` with exported `getFuelColor(fuel: Fuel \| "flare"): string`. SSR/test fallback returns Sunfire hex values. Browser path reads `--fuel-{solar,wind,hydro}` (and `--data-flare` for `"flare"`) from `documentElement` via `getComputedStyle`. |
| `src/index.md` | Add inline `<script>` boot block at the very top of the file (before any code fence) that sets `data-theme` from localStorage. Add `<div id="theme-toggle-mount"></div>` inside the existing `.app-header` cluster. Mount the toggle with `mountThemeToggle(document.getElementById("theme-toggle-mount"))`. Replace the `FUEL_COLOR` import with `getFuelColor`. Replace the two inline-style `${FUEL_COLOR[fuel]}` usages with `${getFuelColor(fuel)}`. |
| `package.json` | Add `jsdom` to `devDependencies` (used by jsdom-environment vitest tests). |
| `vitest.config.ts` | No structural change — keep `environment: "node"` as the default. (Per-file `// @vitest-environment jsdom` directive opts the three new tests into jsdom.) |

### Files explicitly NOT changing

- All `src/data/*.json.ts` loaders.
- All `src/lib/*.ts` except `fuel.ts` and the new `theme-tokens.ts`.
- `src/methodology.md`, `src/about.md`.
- All existing tests under `tests/` (theme system is presentation-only; existing tests must continue to pass without modification).
- `observablehq.config.ts`.
- Existing Gotham `.ttf` files in `src/fonts/` stay in place (cleanup is a separate PR).

---

## Tasks

### Task 1: Add jsdom devDependency

**Files:**
- Modify: `package.json`

**Why first:** Tasks 8, 11, and 13 write jsdom-environment tests. Installing the dependency now lets every later TDD task run cleanly.

- [ ] **Step 1: Add jsdom to package.json**

In `package.json`, locate the `devDependencies` block and add a `jsdom` entry.

```json
"jsdom": "^24.1.0",
```

Place it alphabetically (after the `@types/*` entries, before `tsx` if present).

- [ ] **Step 2: Install**

Run: `npm install`
Expected: `package-lock.json` updated; `node_modules/jsdom` exists; no errors.

- [ ] **Step 3: Run existing tests to confirm no regression**

Run: `npm test`
Expected: PASS — all existing test files (calc, profile, regions, resilient, split-region, typical-profiles, uncertainty) green.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add jsdom devDependency for theme-system tests"
```

---

### Task 2: Source and commit font woff2 files + provenance doc

**Files:**
- Create: `src/fonts/Fraunces-Regular.woff2`, `Fraunces-SemiBold.woff2`, `Fraunces-ExtraBold.woff2`
- Create: `src/fonts/Inter-Regular.woff2`, `Inter-Medium.woff2`, `Inter-Bold.woff2`
- Create: `src/fonts/Spectral-Regular.woff2`, `Spectral-Medium.woff2`, `Spectral-Bold.woff2`
- Create: `src/fonts/FrankRuhlLibre-Bold.woff2`, `FrankRuhlLibre-Black.woff2`
- Create: `src/fonts/IBMPlexSans-Regular.woff2`, `IBMPlexSans-Medium.woff2`, `IBMPlexSans-Bold.woff2`
- Create: `src/fonts/IBMPlexMono-Medium.woff2`
- Create: `src/fonts/SOURCES.md`

**Why early:** Phase 3 (`@font-face` declarations in style.css) cannot land without the files present.

- [ ] **Step 1: Fetch fonts from Google Fonts static API into `src/fonts/`**

All listed families are SIL Open Font License. Run from repo root:

```bash
mkdir -p src/fonts

# Fraunces — Sunfire display
curl -sL -o src/fonts/Fraunces-Regular.woff2 \
  "https://fonts.gstatic.com/s/fraunces/v32/6NUu8FuOMOLdSDRH9rtNmyBO_RVB.woff2"
curl -sL -o src/fonts/Fraunces-SemiBold.woff2 \
  "https://fonts.gstatic.com/s/fraunces/v32/6NUu8FuOMOLdSDRH9rtNmyBO_VVB.woff2"
curl -sL -o src/fonts/Fraunces-ExtraBold.woff2 \
  "https://fonts.gstatic.com/s/fraunces/v32/6NUu8FuOMOLdSDRH9rtNmyBO_aFC.woff2"

# Inter — Sunfire body
curl -sL -o src/fonts/Inter-Regular.woff2 \
  "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50ojIa1ZL7.woff2"
curl -sL -o src/fonts/Inter-Medium.woff2 \
  "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50ojIa1ZL7.woff2"
curl -sL -o src/fonts/Inter-Bold.woff2 \
  "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50ojIa1ZL7.woff2"

# Spectral — Vellum
curl -sL -o src/fonts/Spectral-Regular.woff2 \
  "https://fonts.gstatic.com/s/spectral/v15/rnCr-xNNww_2s0amA9M8qgT8.woff2"
curl -sL -o src/fonts/Spectral-Medium.woff2 \
  "https://fonts.gstatic.com/s/spectral/v15/rnCs-xNNww_2s0amA-M-mHnOSOuk.woff2"
curl -sL -o src/fonts/Spectral-Bold.woff2 \
  "https://fonts.gstatic.com/s/spectral/v15/rnCs-xNNww_2s0amA-M-pHbMSOuk.woff2"

# Frank Ruhl Libre — Eclipse display
curl -sL -o src/fonts/FrankRuhlLibre-Bold.woff2 \
  "https://fonts.gstatic.com/s/frankruhllibre/v22/j8_y6-LBzv2bIBrmwzwhSV1NrJ4XzVwZ.woff2"
curl -sL -o src/fonts/FrankRuhlLibre-Black.woff2 \
  "https://fonts.gstatic.com/s/frankruhllibre/v22/j8_z6-LBzv2bIBrmwzwhSV1NrJ4XzVwZ.woff2"

# IBM Plex Sans — Eclipse body
curl -sL -o src/fonts/IBMPlexSans-Regular.woff2 \
  "https://fonts.gstatic.com/s/ibmplexsans/v19/zYXgKVElMYYaJe8bpLHnCwDKtdbUFI5NadY.woff2"
curl -sL -o src/fonts/IBMPlexSans-Medium.woff2 \
  "https://fonts.gstatic.com/s/ibmplexsans/v19/zYX9KVElMYYaJe8bpLHnCwDKjQ76L9TIuOJG.woff2"
curl -sL -o src/fonts/IBMPlexSans-Bold.woff2 \
  "https://fonts.gstatic.com/s/ibmplexsans/v19/zYX9KVElMYYaJe8bpLHnCwDKjW76L9TIuOJG.woff2"

# IBM Plex Mono — all themes (toggle chips, badges)
curl -sL -o src/fonts/IBMPlexMono-Medium.woff2 \
  "https://fonts.gstatic.com/s/ibmplexmono/v19/-F6qfjptAgt5VM-kVkqdyU8n5ig.woff2"
```

If a `gstatic.com` URL has rotated to a new hash, replace the URL with the matching one from `https://fonts.googleapis.com/css2?family=<Family>:wght@<weight>&display=swap` (visit the URL, copy the woff2 src). The hashes only matter for fetching — `@font-face` declarations in Task 3 reference our local file paths.

- [ ] **Step 2: Verify files exist and are non-trivial in size**

Run: `ls -lh src/fonts/*.woff2 | grep -v Gotham`
Expected: 15 woff2 files, each between 20 KB and 80 KB. Total ~600 KB.

If any file is < 5 KB it is likely an HTML error page; re-fetch via the fallback CSS-API method above.

- [ ] **Step 3: Write `src/fonts/SOURCES.md`**

```markdown
# Font sources

All fonts in `src/fonts/*.woff2` (excluding the Gotham `.ttf` set, which has a separate licence) are SIL Open Font License (OFL) v1.1.

| Family | Weights | Source |
|---|---|---|
| Fraunces | 400, 600, 800 | Google Fonts (https://fonts.google.com/specimen/Fraunces) |
| Inter | 400, 500, 700 | Google Fonts (https://fonts.google.com/specimen/Inter) |
| Spectral | 400, 500, 700 | Google Fonts (https://fonts.google.com/specimen/Spectral) |
| Frank Ruhl Libre | 700, 900 | Google Fonts (https://fonts.google.com/specimen/Frank+Ruhl+Libre) |
| IBM Plex Sans | 400, 500, 700 | Google Fonts (https://fonts.google.com/specimen/IBM+Plex+Sans) |
| IBM Plex Mono | 500 | Google Fonts (https://fonts.google.com/specimen/IBM+Plex+Mono) |

Fetched 2026-04-27. To refresh: re-run the curl block in `docs/superpowers/plans/2026-04-27-theme-system.md` Task 2 Step 1.

License text: SIL Open Font License v1.1 — https://scripts.sil.org/OFL.

The existing Gotham `.ttf` files (Stacked brand) are NOT covered by OFL and are governed by the parent project's licence; they remain in place during this PR but are no longer referenced once the theme system lands.
```

- [ ] **Step 4: Commit**

```bash
git add src/fonts/*.woff2 src/fonts/SOURCES.md
git commit -m "feat(theme): add self-hosted woff2 fonts for Sunfire/Vellum/Eclipse themes"
```

---

### Task 3: Add `@font-face` declarations to style.css

**Files:**
- Modify: `src/style.css` (lines 6–22 area; add new block immediately after the Gotham `@font-face` block)

- [ ] **Step 1: Append 15 new `@font-face` declarations**

Open `src/style.css`. After line 22 (the last Gotham `@font-face`), and before line 24 (`:root`), insert:

```css
/* ---------- Theme system fonts (woff2, self-hosted, OFL) ---------- */
@font-face { font-family: "Fraunces";        src: url("/fonts/Fraunces-Regular.woff2")     format("woff2"); font-weight: 400; font-style: normal; font-display: swap; }
@font-face { font-family: "Fraunces";        src: url("/fonts/Fraunces-SemiBold.woff2")    format("woff2"); font-weight: 600; font-style: normal; font-display: swap; }
@font-face { font-family: "Fraunces";        src: url("/fonts/Fraunces-ExtraBold.woff2")   format("woff2"); font-weight: 800; font-style: normal; font-display: swap; }

@font-face { font-family: "Inter";           src: url("/fonts/Inter-Regular.woff2")        format("woff2"); font-weight: 400; font-style: normal; font-display: swap; }
@font-face { font-family: "Inter";           src: url("/fonts/Inter-Medium.woff2")         format("woff2"); font-weight: 500; font-style: normal; font-display: swap; }
@font-face { font-family: "Inter";           src: url("/fonts/Inter-Bold.woff2")           format("woff2"); font-weight: 700; font-style: normal; font-display: swap; }

@font-face { font-family: "Spectral";        src: url("/fonts/Spectral-Regular.woff2")     format("woff2"); font-weight: 400; font-style: normal; font-display: swap; }
@font-face { font-family: "Spectral";        src: url("/fonts/Spectral-Medium.woff2")      format("woff2"); font-weight: 500; font-style: normal; font-display: swap; }
@font-face { font-family: "Spectral";        src: url("/fonts/Spectral-Bold.woff2")        format("woff2"); font-weight: 700; font-style: normal; font-display: swap; }

@font-face { font-family: "Frank Ruhl Libre";src: url("/fonts/FrankRuhlLibre-Bold.woff2")  format("woff2"); font-weight: 700; font-style: normal; font-display: swap; }
@font-face { font-family: "Frank Ruhl Libre";src: url("/fonts/FrankRuhlLibre-Black.woff2") format("woff2"); font-weight: 900; font-style: normal; font-display: swap; }

@font-face { font-family: "IBM Plex Sans";   src: url("/fonts/IBMPlexSans-Regular.woff2")  format("woff2"); font-weight: 400; font-style: normal; font-display: swap; }
@font-face { font-family: "IBM Plex Sans";   src: url("/fonts/IBMPlexSans-Medium.woff2")   format("woff2"); font-weight: 500; font-style: normal; font-display: swap; }
@font-face { font-family: "IBM Plex Sans";   src: url("/fonts/IBMPlexSans-Bold.woff2")     format("woff2"); font-weight: 700; font-style: normal; font-display: swap; }

@font-face { font-family: "IBM Plex Mono";   src: url("/fonts/IBMPlexMono-Medium.woff2")   format("woff2"); font-weight: 500; font-style: normal; font-display: swap; }
```

- [ ] **Step 2: Run dev preview and confirm no console errors about missing fonts**

Run: `npm run dev` (in a separate terminal; runs Observable preview at `http://localhost:3000`)
In the browser DevTools Network tab, confirm 15 new woff2 requests resolve `200 OK`. No fonts are referenced yet (that happens in Task 4) so they may show as "not used", which is fine.

- [ ] **Step 3: Commit**

```bash
git add src/style.css
git commit -m "feat(theme): register self-hosted woff2 @font-face declarations"
```

---

### Task 4: Refactor `:root` into three `[data-theme="…"]` blocks

**Files:**
- Modify: `src/style.css` (lines 24–230 area, the entire current `:root` block plus the `html, body` background rule)

This is the largest single edit in the plan. Read the existing `:root` carefully before editing — there are body-text utility classes (`.display-xl`, `.eyebrow`, etc.) defined later in the file that consume the type/spacing tokens; those tokens stay structurally identical and theme-invariant, only the colour and font tokens move into the per-theme blocks.

- [ ] **Step 1: Replace the existing `:root { … }` block**

Open `src/style.css`. The block currently runs from `line 24` (`:root {`) to its closing brace around `line 230`. Replace its **colour and font** sections (the `BRAND COLORS`, `SEMANTIC TOKENS`, `States`, `Bitcoin accent`, and `TYPOGRAPHY` sections) with one shared `:root` (structural tokens only) plus three theme-scoped blocks. The `SPACING`, `RADII`, and any other geometric tokens stay in the shared `:root`. The full replacement:

```css
/* =========================================================================
   THEME SYSTEM — three data-theme blocks. Sunfire is the default.
   Tokens shared across themes (spacing, radii, type scale) live in :root.
   Per-theme tokens (colour, fonts, weight/letter-spacing baselines) live in
   :root[data-theme="<name>"] blocks below.
   ========================================================================= */

:root {
  /* ============ TYPE SCALE (theme-invariant) ============ */
  --fs-display-xl: clamp(56px, 8vw, 112px);
  --fs-display-lg: clamp(44px, 6vw, 80px);
  --fs-display:    clamp(36px, 4.5vw, 60px);
  --fs-h1:         44px;
  --fs-h2:         32px;
  --fs-h3:         24px;
  --fs-h4:         20px;
  --fs-body-lg:    18px;
  --fs-body:       16px;
  --fs-body-sm:    14px;
  --fs-caption:    12px;
  --fs-micro:      11px;

  --lh-tight: 1.02;
  --lh-display: 1.05;
  --lh-heading: 1.15;
  --lh-body: 1.55;
  --lh-ui: 1.3;

  --ls-tight: -0.02em;
  --ls-display: -0.015em;
  --ls-normal: 0;
  --ls-caps: 0.12em;

  /* ============ SPACING ============ */
  --space-0: 0;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-20: 80px;

  /* ============ FONT WEIGHTS (semantic, mapped per theme) ============ */
  --fw-thin: 100;
  --fw-xlight: 200;
  --fw-light: 300;
  --fw-book: 400;
  --fw-medium: 500;
  --fw-bold: 700;
  --fw-black: 800;
  --fw-ultra: 900;
}

:root[data-theme="sunfire"] {
  /* brand identity */
  --brand:               #ffd05a;
  --brand-strong:        #e6a020;
  --brand-subtle:        rgba(255, 208, 90, 0.10);
  --brand-on:            #150e08;

  /* surfaces */
  --surface-bg-1:        #2d1f0e;
  --surface-bg-2:        #1a1207;
  --surface-bg-3:        #0a0703;
  --surface-raised:      #1f160a;
  --hairline:            rgba(255, 248, 224, 0.08);
  --hairline-strong:     rgba(255, 248, 224, 0.16);

  /* foreground */
  --ink:                 #fff8e0;
  --ink-muted:           rgba(255, 248, 224, 0.65);
  --ink-soft:            rgba(255, 248, 224, 0.40);

  /* data semantics */
  --data-renewable:      #67e8f9;
  --data-renewable-tip:  #cffafe;
  --data-flare:          #f7931a;
  --data-flare-tip:      #ffc46d;

  /* fuel breakouts */
  --fuel-solar:          #ffd05a;
  --fuel-wind:           #67e8f9;
  --fuel-hydro:          #b8cdff;

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
  --info:                var(--data-renewable);

  /* type */
  --font-display:        "Fraunces", Georgia, "Times New Roman", serif;
  --font-body:           "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  --font-mono:           "IBM Plex Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --font-sans:           var(--font-body);   /* alias: legacy rules read --font-sans */
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
}

/* Backwards-compatibility aliases for any chrome rule that still references the
   removed Stacked palette tokens. Any rule using these will compile against the
   active theme's brand/ink. Remove once we have grepped the file clean. */
:root {
  --teal-500:  var(--brand);
  --teal-600:  var(--brand-strong);
  --slate-800: var(--surface-bg-1);
  --white:     var(--ink);
  --btc-orange: var(--data-flare);
  /* `--surface` / `--border` were used in light-on-light contexts that no
     longer exist; map them to dark equivalents so any straggler rule
     doesn't render white-on-white. */
  --surface:           var(--surface-raised);
  --surface-raised-bg: var(--surface-raised);
  --surface-sunken:    var(--surface-bg-2);
  --border:            var(--hairline);
  --border-strong:     var(--hairline-strong);
  --fg-on-dark:        var(--ink);
  --fg-on-dark-muted:  var(--ink-muted);
}
```

Aliases handle the long tail of consumers; the next task starts removing them.

- [ ] **Step 2: Replace literal background gradients with token gradients**

Find these blocks in `src/style.css`:

- `#page-loader` rule, line ~244, the `background: radial-gradient(...)` line.
- `html, body` rule, line ~319, the `background: radial-gradient(...)` line.

In **both** rules, replace the literal radial-gradient with:

```css
  background: radial-gradient(ellipse at 30% 40%, var(--surface-bg-1) 0%, var(--surface-bg-2) 60%, var(--surface-bg-3) 100%);
```

In `html, body` also change:

```css
  color: var(--white);
```

to

```css
  color: var(--ink);
```

The `--white` alias still works, but `--ink` is the canonical theme-aware token.

- [ ] **Step 3: Set the default theme on `<html>` for any context where the boot script can't run**

Just below the `:root[data-theme="eclipse"] { … }` block (i.e. before `#page-loader`), add:

```css
/* Fallback: if no boot script runs (SSR-rendered intermediate, e.g. Observable's
   initial document before our inline <head> script), default to Sunfire so the
   page is never unstyled. */
:root:not([data-theme]) {
  /* duplicate the Sunfire token block by reference */
  color-scheme: dark;
}
:root:not([data-theme]),
html:not([data-theme]) body {
  /* paint at least the page chrome */
  background: radial-gradient(ellipse at 30% 40%, #2d1f0e 0%, #1a1207 60%, #0a0703 100%);
  color: #fff8e0;
}
```

This is a defensive belt-and-braces guard. Once the boot script lands in Task 7, this rule effectively never matches.

- [ ] **Step 4: Run dev preview**

Run: `npm run dev`
Open `http://localhost:3000` in a browser.
Manually set the theme via DevTools console: `document.documentElement.setAttribute("data-theme", "sunfire")` then `"vellum"` then `"eclipse"`.
Expected:
- Sunfire: warm gold/cream chrome on dark brown background.
- Vellum: parchment cream on graphite background.
- Eclipse: pure white on near-black background.
- No layout shift between themes; only colours and fonts change.

- [ ] **Step 5: Commit**

```bash
git add src/style.css
git commit -m "feat(theme): refactor :root tokens into Sunfire/Vellum/Eclipse blocks"
```

---

### Task 5: Replace direct `--teal-*` and rgba literals in chrome rules

**Files:**
- Modify: `src/style.css` (chrome rules — `.app-mark`, `.app-wordmark`, `.app-tag`, `.app-methodology`, `.app-nav`, `.loader-topbar-fill`, `.loader-center-mark`, `:focus-visible`, `.app-shell`, `.app-header`, `.app-body`)

The aliases from Task 4 keep these rules working, but they all reference colours that should be theme-aware semantic tokens. This task makes them speak the new vocabulary.

- [ ] **Step 1: Edit each chrome rule**

In `src/style.css`, find and replace as follows. (Use `Grep` first to verify each pattern still exists at the expected location; line numbers below are from the v0-build state and may have drifted by ~5 lines after Task 4.)

Around line 280 — `.loader-topbar-fill`, `linear-gradient(...)` value:

```css
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--brand) 40%,
    rgba(255, 255, 255, 0) 60%,
    transparent 100%
  );
```

Around line 295 — `.loader-center-mark`:

```css
  color: var(--brand);
```

Around line 348 — `:focus-visible`:

```css
  outline: 2px solid var(--brand);
```

Around line 391 — `.app-header`:

```css
  border-bottom: 1px solid var(--hairline);
```

Around line 401 — `.app-mark`:

```css
  color: var(--brand);
```

Around line 408 — `.app-wordmark`:

```css
  color: var(--ink);
```

Around line 417 — `.app-tag`:

```css
  color: var(--ink-muted);
  border-left: 1px solid var(--hairline-strong);
```

Around line 425 — `.app-methodology`:

```css
  color: var(--ink-muted);
  border: 1px solid var(--hairline-strong);
```

Around line 433 — `.app-methodology:hover`:

```css
.app-methodology:hover {
  background: var(--brand-subtle);
  color: var(--ink);
  border-color: var(--brand);
}
```

Around line 446 — `.app-nav a`:

```css
  color: var(--ink-muted);
```

Around line 455 — `.app-nav a:hover, .app-nav a[aria-current="page"]`:

```css
.app-nav a:hover,
.app-nav a[aria-current="page"] {
  background: var(--brand-subtle);
  color: var(--ink);
  border-color: var(--brand);
}
```

Around line 383 — `.app-shell`:

```css
  color: var(--ink);
```

- [ ] **Step 2: Search for remaining `var(--teal` / `var(--slate` / `rgba(20, *175, *172` references**

Run: `grep -n "var(--teal\|var(--slate\|20, *175, *172\|14afac\|14, 175, 172" src/style.css`
Expected output: empty, OR matches only inside the `Backwards-compatibility aliases` block from Task 4.
If any other rule still references the old palette directly, replace it with the appropriate semantic token (`--brand`, `--ink`, `--surface-bg-1`, `--hairline`, etc.) before proceeding.

- [ ] **Step 3: Once clean, remove the backwards-compat alias block**

Edit `src/style.css` and delete the entire `Backwards-compatibility aliases` block added in Task 4 Step 1 (the one beginning `/* Backwards-compatibility aliases ... */`).

If `grep` in Step 2 still shows non-alias matches, leave the block in place and add a TODO inline; that's a sign one rule was missed.

- [ ] **Step 4: Confirm fonts kick in**

In `src/style.css`, find rules that read `var(--font-sans)` or `font-family: "Gotham", …`. Search:

Run: `grep -n "font-family.*Gotham\|var(--font-sans\|var(--font-body\|var(--font-display)" src/style.css`

For every rule that reads `font-family: "Gotham", …` directly (i.e. hardcodes Gotham instead of going through `var(--font-sans)`), replace with `font-family: var(--font-body);` (or `var(--font-display)` for headlines/eyebrows). Display tokens go on:
- `.display-xl`, `.display-lg`, `.display-md` — `var(--font-display)`
- Everything else — `var(--font-body)`

If a rule already reads `var(--font-sans)`, it now resolves to `var(--font-body)` via the per-theme alias and needs no edit.

- [ ] **Step 5: Visual smoke test**

Run: `npm run dev`. Toggle theme via DevTools console (as in Task 4 Step 4). Confirm:
- Sunfire: serif "EVERY LAST JOULE" wordmark in Fraunces, sans body in Inter.
- Vellum: serif throughout (Spectral).
- Eclipse: heavy serif headline (Frank Ruhl Libre), Plex Sans body.
No FOUT (flash of unstyled text) — `font-display: swap` already declared in Task 3.

- [ ] **Step 6: Commit**

```bash
git add src/style.css
git commit -m "feat(theme): switch chrome rules from --teal-*/--slate-* to semantic tokens"
```

---

### Task 6: Build `theme-tokens.ts` helpers + tests

**Files:**
- Create: `src/lib/theme-tokens.ts`
- Create: `tests/theme-tokens.test.ts`

This task ships before `globe.js` token reads (Task 9) and before `getFuelColor` (Task 10) so both consumers depend on a tested helper, not raw `getComputedStyle` calls scattered across two files.

- [ ] **Step 1: Write the failing test**

Create `tests/theme-tokens.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseHexToRGB } from "../src/lib/theme-tokens";

describe("parseHexToRGB", () => {
  it("converts a 6-char hex with leading # to a comma-separated rgb tuple", () => {
    expect(parseHexToRGB("#ffd05a")).toBe("255,208,90");
  });

  it("converts a 6-char hex without leading # to a comma-separated rgb tuple", () => {
    expect(parseHexToRGB("fafafa")).toBe("250,250,250");
  });

  it("trims whitespace", () => {
    expect(parseHexToRGB("  #67e8f9  ")).toBe("103,232,249");
  });

  it("returns null for invalid input", () => {
    expect(parseHexToRGB("not-a-hex")).toBeNull();
    expect(parseHexToRGB("")).toBeNull();
    expect(parseHexToRGB("#abc")).toBeNull();      // 3-char form not supported
    expect(parseHexToRGB("#12345678")).toBeNull(); // 8-char form not supported
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- theme-tokens`
Expected: FAIL — `Cannot find module '../src/lib/theme-tokens'`.

- [ ] **Step 3: Implement minimal helper**

Create `src/lib/theme-tokens.ts`:

```ts
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
  };
}

/** True if the night-overlay token is a CSS gradient descriptor (Eclipse). */
export function isLinearGradientToken(value: string): boolean {
  return /^linear-gradient\s*\(/i.test(value.trim());
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- theme-tokens`
Expected: PASS — all 4 cases green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/theme-tokens.ts tests/theme-tokens.test.ts
git commit -m "feat(theme): add theme-tokens helpers (parseHexToRGB, readGlobeTokens)"
```

---

### Task 7: No-FOUC inline boot script in `src/index.md`

**Files:**
- Modify: `src/index.md` (top of file, before line 1's `# Every Last Joule` heading)

Observable Framework will pass HTML written before any code fence directly to the rendered page head/body. The boot script must be the first executable JS the browser sees so the `data-theme` attribute is set before any stylesheet evaluates.

- [ ] **Step 1: Insert the inline boot script**

Open `src/index.md`. The current file starts:

```markdown
# Every Last Joule

<div id="page-loader" role="status" aria-label="Loading dashboard data">
```

Insert this block at the absolute top of the file (above `# Every Last Joule`):

```html
<script>
  (function () {
    try {
      var t = localStorage.getItem("elj-theme");
      if (t !== "sunfire" && t !== "vellum" && t !== "eclipse") t = "sunfire";
      document.documentElement.setAttribute("data-theme", t);
    } catch (e) {
      document.documentElement.setAttribute("data-theme", "sunfire");
    }
  })();
</script>
```

The `try/catch` covers private-browsing localStorage rejection and `localStorage` being absent in the SSR pipeline.

- [ ] **Step 2: Build and inspect built HTML**

Run: `npm run build`
Expected: build completes without warnings about "untrusted HTML" or hoisted scripts.
Then:

Run: `head -20 dist/index.html`
Expected: the inline `<script>` block appears in the rendered HTML somewhere within the first 20 lines, BEFORE any `<link rel="stylesheet">` tag. If Observable Framework hoisted the script below stylesheets, switch to inserting the block via an Observable Framework `head` config option (see `observablehq.config.ts`); but the markdown-front-matter approach is the documented path and should work.

- [ ] **Step 3: Visual smoke test in dev**

Run: `npm run dev`. Open `http://localhost:3000`. With DevTools open:
1. Application tab → Local Storage → `localhost:3000`. Set `elj-theme = vellum`. Hard reload.
2. Expected: page paints in Vellum theme on first frame. No flash of Sunfire.
3. Set `elj-theme = nonsense`. Hard reload.
4. Expected: page paints in Sunfire (the fallback). DevTools shows `<html data-theme="sunfire">`.

- [ ] **Step 4: Commit**

```bash
git add src/index.md
git commit -m "feat(theme): no-FOUC inline boot script reads localStorage.elj-theme"
```

---

### Task 8: ThemeToggle component (test-first)

**Files:**
- Create: `tests/theme-toggle.test.ts`
- Create: `src/components/theme-toggle.js`

- [ ] **Step 1: Write the failing test**

Create `tests/theme-toggle.test.ts`:

```ts
// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mountThemeToggle } from "../src/components/theme-toggle.js";

function setUp() {
  document.documentElement.setAttribute("data-theme", "sunfire");
  localStorage.clear();
  const host = document.createElement("div");
  document.body.appendChild(host);
  return host;
}

describe("mountThemeToggle", () => {
  let host: HTMLElement;
  let cleanup: () => void;

  beforeEach(() => { host = setUp(); });
  afterEach(() => {
    cleanup?.();
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("renders three chips with sunfire active", () => {
    cleanup = mountThemeToggle(host);
    const buttons = host.querySelectorAll("button[data-theme]");
    expect(buttons.length).toBe(3);
    expect(buttons[0].getAttribute("data-theme")).toBe("sunfire");
    expect(buttons[0].getAttribute("aria-checked")).toBe("true");
    expect(buttons[1].getAttribute("aria-checked")).toBe("false");
    expect(buttons[2].getAttribute("aria-checked")).toBe("false");
  });

  it("reads the current theme from documentElement on mount", () => {
    document.documentElement.setAttribute("data-theme", "eclipse");
    cleanup = mountThemeToggle(host);
    const eclipseBtn = host.querySelector('button[data-theme="eclipse"]')!;
    expect(eclipseBtn.getAttribute("aria-checked")).toBe("true");
  });

  it("clicking a chip updates documentElement, localStorage, aria, and dispatches themechange", () => {
    cleanup = mountThemeToggle(host);
    const events: string[] = [];
    window.addEventListener("themechange", (e) => {
      events.push((e as CustomEvent).detail.theme);
    });

    const vellumBtn = host.querySelector('button[data-theme="vellum"]') as HTMLButtonElement;
    vellumBtn.click();

    expect(document.documentElement.getAttribute("data-theme")).toBe("vellum");
    expect(localStorage.getItem("elj-theme")).toBe("vellum");
    expect(vellumBtn.getAttribute("aria-checked")).toBe("true");
    expect(host.querySelector('button[data-theme="sunfire"]')!.getAttribute("aria-checked")).toBe("false");
    expect(events).toEqual(["vellum"]);
  });

  it("clicking the already-active chip is a no-op (no extra events)", () => {
    cleanup = mountThemeToggle(host);
    const events: string[] = [];
    window.addEventListener("themechange", (e) => events.push((e as CustomEvent).detail.theme));
    const sunfireBtn = host.querySelector('button[data-theme="sunfire"]') as HTMLButtonElement;
    sunfireBtn.click();
    expect(events).toEqual([]);
  });

  it("ArrowRight cycles to next chip and activates it", () => {
    cleanup = mountThemeToggle(host);
    const sunfireBtn = host.querySelector('button[data-theme="sunfire"]') as HTMLButtonElement;
    sunfireBtn.focus();
    sunfireBtn.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("vellum");
  });

  it("ArrowLeft from sunfire wraps around to eclipse", () => {
    cleanup = mountThemeToggle(host);
    const sunfireBtn = host.querySelector('button[data-theme="sunfire"]') as HTMLButtonElement;
    sunfireBtn.focus();
    sunfireBtn.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("eclipse");
  });

  it("returns a cleanup function that removes the rendered DOM", () => {
    cleanup = mountThemeToggle(host);
    expect(host.querySelector(".theme-toggle")).not.toBeNull();
    cleanup();
    expect(host.querySelector(".theme-toggle")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- theme-toggle`
Expected: FAIL — `Cannot find module '../src/components/theme-toggle.js'`.

- [ ] **Step 3: Implement the component**

Create `src/components/theme-toggle.js`:

```js
/**
 * Three-chip radiogroup that switches the active theme.
 *
 * Side-effects on activation:
 *   1. Sets document.documentElement.dataset.theme.
 *   2. Persists to localStorage["elj-theme"].
 *   3. Dispatches a `themechange` CustomEvent on `window` with
 *      `{ detail: { theme } }`.
 *
 * Initial active chip is read from <html data-theme="..."> (set by the
 * inline no-FOUC boot script in src/index.md).
 *
 * Returns a cleanup function that removes the rendered DOM.
 */
const VALID_THEMES = ["sunfire", "vellum", "eclipse"];

const DEFAULT_LABELS = {
  sunfire: "Sunfire",
  vellum:  "Vellum",
  eclipse: "Eclipse",
};

export function mountThemeToggle(host, opts = {}) {
  if (!host || !(host instanceof Element)) {
    throw new TypeError("mountThemeToggle: host must be an Element");
  }
  const themes = opts.themes ?? VALID_THEMES;
  const labels = { ...DEFAULT_LABELS, ...(opts.labels ?? {}) };

  const root = document.createElement("div");
  root.className = "theme-toggle";
  root.setAttribute("role", "radiogroup");
  root.setAttribute("aria-label", "Visual theme");

  const buttons = themes.map((theme) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("role", "radio");
    btn.setAttribute("data-theme", theme);
    btn.textContent = labels[theme] ?? theme;
    return btn;
  });

  for (const btn of buttons) root.appendChild(btn);

  function currentTheme() {
    const t = document.documentElement.getAttribute("data-theme");
    return themes.includes(t) ? t : themes[0];
  }

  function syncAria() {
    const active = currentTheme();
    for (const btn of buttons) {
      btn.setAttribute("aria-checked", btn.dataset.theme === active ? "true" : "false");
      btn.tabIndex = btn.dataset.theme === active ? 0 : -1;
    }
  }

  function activate(theme) {
    if (!themes.includes(theme)) return;
    if (theme === currentTheme()) return; // no-op
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("elj-theme", theme); } catch (_) { /* private mode */ }
    syncAria();
    window.dispatchEvent(new CustomEvent("themechange", { detail: { theme } }));
  }

  function onClick(e) {
    const btn = e.target.closest("button[data-theme]");
    if (!btn) return;
    activate(btn.dataset.theme);
  }

  function onKeydown(e) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== " " && e.key !== "Enter") return;
    e.preventDefault();
    const cur = currentTheme();
    const idx = themes.indexOf(cur);
    let next = cur;
    if (e.key === "ArrowRight") next = themes[(idx + 1) % themes.length];
    else if (e.key === "ArrowLeft") next = themes[(idx - 1 + themes.length) % themes.length];
    // Space/Enter activate the focused chip — no movement.
    activate(next);
    const target = root.querySelector(`button[data-theme="${currentTheme()}"]`);
    target?.focus();
  }

  root.addEventListener("click", onClick);
  root.addEventListener("keydown", onKeydown);

  syncAria();
  host.appendChild(root);

  return function cleanup() {
    root.removeEventListener("click", onClick);
    root.removeEventListener("keydown", onKeydown);
    if (root.parentNode === host) host.removeChild(root);
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- theme-toggle`
Expected: PASS — all 7 cases green.

- [ ] **Step 5: Commit**

```bash
git add src/components/theme-toggle.js tests/theme-toggle.test.ts
git commit -m "feat(theme): three-chip ThemeToggle component with keyboard support"
```

---

### Task 9: Mount ThemeToggle in `src/index.md` and add CSS

**Files:**
- Modify: `src/index.md` (app-header section + JS imports)
- Modify: `src/style.css` (append `.theme-toggle` rules from spec)

- [ ] **Step 1: Add `theme-toggle-mount` to the header markup**

In `src/index.md`, the app-header is constructed in a single template literal assigned to `document.getElementById("app-root").innerHTML` starting around line 122. The current header looks like:

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

Replace the `<nav class="app-nav">…</nav>` block with a wrapping right-cluster that holds both the toggle and the nav:

```html
      <div class="app-header-right">
        <div id="theme-toggle-mount"></div>
        <nav class="app-nav" aria-label="Primary">
          <a href="./methodology">Methodology</a>
          <a href="./about">About</a>
        </nav>
      </div>
```

Add the matching layout rule to `src/style.css` immediately under the `.app-header` rule:

```css
.app-header-right {
  display: inline-flex;
  align-items: center;
  gap: 14px;
}
```

- [ ] **Step 2: Import the component and mount it**

Near the top of the JS section in `src/index.md` (around line 13, alongside `import { mountModeToggle } …`), add:

```js
import { mountThemeToggle } from "./components/theme-toggle.js";
```

The existing `mountModeToggle` call lives at line 445 (`mountModeToggle(document.getElementById("mode-toggle"), …)`). Immediately after that statement, add:

```js
const themeToggleHost = document.getElementById("theme-toggle-mount");
if (themeToggleHost) mountThemeToggle(themeToggleHost);
```

The `if` guard makes the line resilient if a future edit removes the mount div.

- [ ] **Step 3: Append `.theme-toggle` CSS rules to `src/style.css`**

Open `src/style.css` and append at the end of the file (or near the other `.app-*` rules):

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

@media (max-width: 640px) {
  .theme-toggle button { padding: 5px 9px; }
}
```

- [ ] **Step 4: Visual smoke test**

Run: `npm run dev`. Open `http://localhost:3000`.
Expected:
- Three-chip toggle visible in the header (right cluster, immediately left of the Methodology / About nav), Sunfire active.
- Click "Vellum" → page repaints in Vellum within ~140ms (the CSS transition).
- Hard reload → page paints directly in Vellum (boot script reads localStorage).
- Click "Eclipse" → page repaints in Eclipse.
- ArrowLeft / ArrowRight on focused chip cycles themes.

The globe will still be painted in stale Sunfire colours — that's expected; Task 12 wires it to `themechange`.

- [ ] **Step 5: Commit**

```bash
git add src/index.md src/style.css
git commit -m "feat(theme): mount ThemeToggle in app header and style its chips"
```

---

### Task 10: `getFuelColor()` runtime resolution + tests

**Files:**
- Modify: `src/lib/fuel.ts` (replace `FUEL_COLOR` export with `getFuelColor` function)
- Create: `tests/fuel-color.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/fuel-color.test.ts`:

```ts
// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from "vitest";
import { getFuelColor } from "../src/lib/fuel";

beforeEach(() => {
  document.documentElement.setAttribute("data-theme", "sunfire");
  // Inject the Sunfire fuel tokens onto the documentElement so
  // getComputedStyle returns deterministic values without loading the
  // full stylesheet.
  document.documentElement.style.setProperty("--fuel-solar", "#ffd05a");
  document.documentElement.style.setProperty("--fuel-wind",  "#67e8f9");
  document.documentElement.style.setProperty("--fuel-hydro", "#b8cdff");
  document.documentElement.style.setProperty("--data-flare", "#f7931a");
});

describe("getFuelColor", () => {
  it("returns the --fuel-solar token under sunfire", () => {
    expect(getFuelColor("solar")).toBe("#ffd05a");
  });

  it("returns the --fuel-wind token under sunfire", () => {
    expect(getFuelColor("wind")).toBe("#67e8f9");
  });

  it("returns the --fuel-hydro token under sunfire", () => {
    expect(getFuelColor("hydro")).toBe("#b8cdff");
  });

  it("returns the --data-flare token for the 'flare' bucket (locked across themes)", () => {
    expect(getFuelColor("flare")).toBe("#f7931a");
  });

  it("trims whitespace returned by getComputedStyle", () => {
    document.documentElement.style.setProperty("--fuel-solar", "  #abcdef  ");
    expect(getFuelColor("solar")).toBe("#abcdef");
  });

  it("returns Sunfire defaults when the token is missing on the documentElement", () => {
    document.documentElement.style.removeProperty("--fuel-solar");
    // Stylesheet not loaded in this test harness, so getComputedStyle
    // returns "" → getFuelColor falls back to the Sunfire default.
    expect(getFuelColor("solar")).toBe("#ffd05a");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- fuel-color`
Expected: FAIL — `getFuelColor is not a function` or `Cannot find module`.

- [ ] **Step 3: Edit `src/lib/fuel.ts`**

Replace lines 18–27 (the `FUEL_COLOR` block) with:

```ts
/**
 * Per-fuel colour tokens. Themed at runtime via CSS custom properties so
 * that switching themes (Sunfire / Vellum / Eclipse) re-colours every
 * canvas-painted surface. Flare colour is locked across themes (BTC orange,
 * a data-meaning convention).
 */
const FUEL_VAR: Record<Fuel | "flare", string> = {
  solar: "--fuel-solar",
  wind:  "--fuel-wind",
  hydro: "--fuel-hydro",
  flare: "--data-flare",
};

const FUEL_DEFAULT: Record<Fuel | "flare", string> = {
  solar: "#ffd05a", // Sunfire default — used in SSR / non-DOM contexts only.
  wind:  "#67e8f9",
  hydro: "#b8cdff",
  flare: "#f7931a",
};

export function getFuelColor(fuel: Fuel | "flare"): string {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return FUEL_DEFAULT[fuel];
  }
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(FUEL_VAR[fuel])
    .trim();
  return raw || FUEL_DEFAULT[fuel];
}
```

Remove the `FUEL_COLOR` export entirely. Remove the JSDoc that references "teal palette" — the old comment block is now misleading.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- fuel-color`
Expected: PASS — all 6 cases green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/fuel.ts tests/fuel-color.test.ts
git commit -m "feat(theme): replace FUEL_COLOR const with getFuelColor() runtime reader"
```

---

### Task 11: Migrate `FUEL_COLOR` consumers (globe.js, region-tooltip.js, timeline.js, index.md)

**Files:**
- Modify: `src/globe.js` (line 4 import + line 205 use site)
- Modify: `src/components/region-tooltip.js` (lines 2, 4, 35, 61, 95)
- Modify: `src/components/timeline.js` (lines 2, 86, 114, 142, 148)
- Modify: `src/index.md` (line 18 import + lines 177, 420)

This task is mechanical — `npm test` after each file confirms nothing broke.

- [ ] **Step 1: Update `src/globe.js`**

Line 4 currently:

```js
import { FUEL_COLOR, dominantFuel } from "./lib/fuel.js";
```

Replace with:

```js
import { getFuelColor, dominantFuel } from "./lib/fuel.js";
```

Line 205 currently:

```js
      const color = FUEL_COLOR[dominantFuel(region, data)];
```

Replace with:

```js
      const color = getFuelColor(dominantFuel(region, data));
```

- [ ] **Step 2: Update `src/components/region-tooltip.js`**

Line 2 currently:

```js
import { FUEL_COLOR, FUEL_LABEL, dominantFuel } from "../lib/fuel.js";
```

Replace with:

```js
import { getFuelColor, FUEL_LABEL, dominantFuel } from "../lib/fuel.js";
```

Line 4 currently:

```js
const FLARE_COLOR = "#f7931a";
```

Delete it (no replacement). Update line 35 (`colorFor`):

```js
  function colorFor(region) {
    if (region.kind === "flare") return getFuelColor("flare");
    return getFuelColor(dominantFuel(region, regionData[region.id]));
  }
```

Update line 61 (`drawSparkline` fallback colour):

```js
    const color = currentRegion ? colorFor(currentRegion) : getFuelColor("wind");
```

Update line 95 (current-hour dot fill — currently `"#f7931a"`):

```js
    ctx.fillStyle = getFuelColor("flare");
```

- [ ] **Step 3: Update `src/components/timeline.js`**

Line 2 currently:

```js
import { FUEL_ORDER, FUEL_COLOR, fuelShare } from "../lib/fuel.js";
```

Replace with:

```js
import { FUEL_ORDER, fuelShare } from "../lib/fuel.js";
import { getFuelColor } from "../lib/fuel.js";
```

(Two imports kept separate so that if a later edit needs more from `fuel.js` the diff stays clean. Equivalent to combining them — pick one form.)

Line 86 currently:

```js
      const colorHex = FUEL_COLOR[fuel];
```

Replace with:

```js
      const colorHex = getFuelColor(fuel);
```

Line 114 (the white-stroke literal):

```js
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
```

Replace with:

```js
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--hairline-strong").trim() || "rgba(255,255,255,0.16)";
```

Line 142 (`#f7931a` for the marker stroke):

```js
    ctx.strokeStyle = "#f7931a";
```

Replace with:

```js
    ctx.strokeStyle = getFuelColor("flare");
```

Line 148 (`#f7931a` for the marker fill):

```js
    ctx.fillStyle = "#f7931a";
```

Replace with:

```js
    ctx.fillStyle = getFuelColor("flare");
```

- [ ] **Step 4: Update `src/index.md`**

Line 18 currently:

```js
import { FUEL_ORDER, FUEL_LABEL, FUEL_COLOR, fuelShare, isRenewable } from "./lib/fuel.js";
```

Replace with:

```js
import { FUEL_ORDER, FUEL_LABEL, getFuelColor, fuelShare, isRenewable } from "./lib/fuel.js";
```

Line 177 currently (search exact pattern with `Grep` first, line numbers shift as the file evolves):

```js
                  <span class="dot" style="background:${FUEL_COLOR[fuel]};box-shadow:0 0 10px ${FUEL_COLOR[fuel]}66;"></span>
```

Replace with:

```js
                  <span class="dot" style="background:${getFuelColor(fuel)};box-shadow:0 0 10px ${getFuelColor(fuel)}66;"></span>
```

Line 420 currently:

```js
      <span class="dot" style="background:${FUEL_COLOR[fuel]};box-shadow:0 0 8px ${FUEL_COLOR[fuel]}66;"></span>
```

Replace with:

```js
      <span class="dot" style="background:${getFuelColor(fuel)};box-shadow:0 0 8px ${getFuelColor(fuel)}66;"></span>
```

- [ ] **Step 5: Verify nothing references `FUEL_COLOR` anywhere**

Run: `grep -rn "FUEL_COLOR" src/ tests/ 2>/dev/null`
Expected: empty.
If anything remains, replace it the same way (function call instead of array index).

- [ ] **Step 6: Run all tests**

Run: `npm test`
Expected: PASS — all existing tests + new theme-tokens / theme-toggle / fuel-color tests, all green.

- [ ] **Step 7: Run the typechecker**

Run: `npm run typecheck`
Expected: PASS — no errors. (TS allows the `Fuel | "flare"` widening in `getFuelColor` because callers are JS, and the existing `Fuel` type doesn't include flare.)

- [ ] **Step 8: Commit**

```bash
git add src/globe.js src/components/region-tooltip.js src/components/timeline.js src/index.md
git commit -m "feat(theme): migrate FUEL_COLOR consumers to getFuelColor() runtime calls"
```

---

### Task 12: Globe.js token reads + night-side legibility fix

**Files:**
- Modify: `src/globe.js` (lines 137, 149–151, 160, 172, 181, 187 and the `mountGlobe` function shell)

This is the most involved JS change. The strategy: read all globe tokens once at mount and cache them; subscribe to `themechange` to refresh + re-render; replace each hardcoded literal with a token reference.

- [ ] **Step 1: Add `theme-tokens` import**

In `src/globe.js`, line 4 area, after the existing imports:

```js
import { readGlobeTokens, isLinearGradientToken } from "./lib/theme-tokens.js";
```

(The `.ts` file resolves through Observable's typescript-aware loader.)

- [ ] **Step 2: Add token cache + themechange subscription inside `mountGlobe`**

In `mountGlobe(canvas, initial)`, after the `state` object is created (around line 58, immediately before `function hitTestRegion`), insert:

```js
  let tokens = readGlobeTokens(document.documentElement);

  function refreshTokens() {
    tokens = readGlobeTokens(document.documentElement);
    // Force a redraw so the next paint uses the new colours immediately.
    render();
  }

  window.addEventListener("themechange", refreshTokens);
```

In the `destroy()` method at the bottom (around line 392), add the matching cleanup:

```js
    destroy() {
      stopLoop();
      window.removeEventListener("themechange", refreshTokens);
      document.removeEventListener("visibilitychange", onVisibility);
      resizeObserver.disconnect();
    }
```

- [ ] **Step 3: Replace sphere fill (line 137)**

Currently:

```js
    ctx.fillStyle = "#0a1114";
```

Replace with:

```js
    ctx.fillStyle = tokens.spherebaseHex;
```

- [ ] **Step 4: Replace day-side gradient (lines 149–151)**

Currently:

```js
      gradient.addColorStop(0, "rgba(90, 150, 160, 0.75)");
      gradient.addColorStop(0.45, "rgba(40, 80, 90, 0.35)");
      gradient.addColorStop(1, "rgba(0,0,0,0)");
```

Replace with:

```js
      gradient.addColorStop(0,    tokens.dayGradient1);
      gradient.addColorStop(0.45, tokens.dayGradient2);
      gradient.addColorStop(1,    tokens.dayGradient3);
```

- [ ] **Step 5: Replace night overlay (line 160)**

Replace these three lines:

```js
    ctx.beginPath();
    path(d3.geoCircle().center([antiSolarLng, -sunLat]).radius(90)());
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fill();
```

with:

```js
    ctx.beginPath();
    path(d3.geoCircle().center([antiSolarLng, -sunLat]).radius(90)());
    if (isLinearGradientToken(tokens.nightOverlay)) {
      // Eclipse uses a CSS linear-gradient(135deg, …) which canvas
      // can't consume as a fillStyle string; reproduce it as a canvas
      // gradient spanning the bounding box of the screen.
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const cosA = Math.cos((135 * Math.PI) / 180);
      const sinA = Math.sin((135 * Math.PI) / 180);
      const x0 = w / 2 - (w * cosA) / 2;
      const y0 = h / 2 - (h * sinA) / 2;
      const x1 = w / 2 + (w * cosA) / 2;
      const y1 = h / 2 + (h * sinA) / 2;
      const grad = ctx.createLinearGradient(x0, y0, x1, y1);
      grad.addColorStop(0, "rgba(40,30,20,0.30)");
      grad.addColorStop(1, "rgba(15,10,5,0.55)");
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = tokens.nightOverlay;
    }
    ctx.fill();
```

The Eclipse colour stops are hardcoded here because `tokens.nightOverlay` returns the entire `linear-gradient(...)` string and parsing CSS gradients robustly is out of scope. If the spec ever changes Eclipse's gradient stops, both the CSS variable in `style.css` AND these two `addColorStop` lines must be edited together. Add a comment:

```js
      // NB: stops here must mirror --night-overlay in :root[data-theme="eclipse"]
      // (in src/style.css). If you change one, change both.
```

- [ ] **Step 6: Replace country-dot brightness + colour (line 171–172)**

Currently:

```js
      const brightness = 0.05 + fade * 0.12 + Math.pow(sunlit, 0.7) * 0.85;
      ctx.fillStyle = `rgba(20, 175, 172, ${brightness})`;
```

Replace with (the night-side legibility fix from spec §"Night-side legibility fix"):

```js
      const brightness = 0.30 + fade * 0.10 + Math.pow(sunlit, 0.7) * 0.60;
      const dotRGB = sunlit > 0.3 ? tokens.dotDayRGB : tokens.dotNightRGB;
      ctx.fillStyle = `rgba(${dotRGB}, ${brightness})`;
```

- [ ] **Step 7: Replace country-border stroke (line 181)**

Currently:

```js
    ctx.strokeStyle = "rgba(20, 175, 172, 0.22)";
```

Replace with:

```js
    ctx.strokeStyle = tokens.border;
```

(`--globe-border` already bakes in alpha 0.30–0.35 per theme; that's the spec's "raised from 0.22 to 0.35" change.)

- [ ] **Step 8: Replace globe outline stroke (line 187)**

Currently:

```js
    ctx.strokeStyle = "rgba(20, 175, 172, 0.25)";
```

Replace with:

```js
    ctx.strokeStyle = tokens.border;
```

- [ ] **Step 9: Verify no hardcoded teal / black-overlay literals remain**

Run: `grep -n "rgba(20, *175, *172\|rgba(0, *0, *0, *0\\.55\|0a1114\|14afac" src/globe.js`
Expected: empty.

- [ ] **Step 10: Visual smoke test**

Run: `npm run dev`. Open `http://localhost:3000`.

- Sunfire (default): scrub timeline to UTC 04. Expected: country dots in the night hemisphere are clearly visible (warm-tan dots, brightness ≥ 0.30). Borders show as warm gold. Day-side gradient is warm cream/gold.
- Switch to Vellum via toggle. Expected: globe instantly repaints — dots become parchment-cream, borders go neutral, day-side gradient softens to off-white. No teal pixels remain.
- Switch to Eclipse. Expected: globe repaints in monochrome; night side has a slightly purple/warm gradient (not pure black); dots transition from white (day) to grey (night).
- Open DevTools → Performance. Click rapidly between themes 5×. Expected: no console errors; no perceived stutter; render() is called once per `themechange` (verify by adding a temporary `console.log` if uncertain — remove before commit).

- [ ] **Step 11: Commit**

```bash
git add src/globe.js
git commit -m "feat(theme): globe.js reads tokens via readGlobeTokens + night-side legibility fix"
```

---

### Task 13: Timeline subscribes to `themechange`

**Files:**
- Modify: `src/components/timeline.js` (the `mountTimeline` function shell)

`getFuelColor()` is now called per-render (Task 11 Step 3) so theme switches automatically pick up new fuel colours on the next paint. But the timeline's render is only triggered on clock tick — if the clock is paused when the user changes theme, the timeline keeps showing stale colours. Subscribe to `themechange` and force a render.

- [ ] **Step 1: Add subscription**

In `src/components/timeline.js`, near the bottom of `mountTimeline` (just before the `return { update, … }` block, around line 184), add:

```js
  function onThemeChange() { render(); }
  window.addEventListener("themechange", onThemeChange);
```

Then change the returned object to expose a `destroy()` cleanup:

```js
  return {
    update(next = {}) {
      if (next.mode) mode = next.mode;
      render();
    },
    destroy() {
      window.removeEventListener("themechange", onThemeChange);
    },
  };
```

If the existing call site in `src/index.md` doesn't currently consume a `destroy()` method, that's fine — the no-op return becomes a leak only if the timeline is ever unmounted, which it isn't in this app. The cleanup is forward-compatible plumbing.

- [ ] **Step 2: Apply the same pattern to `region-tooltip.js`**

Open `src/components/region-tooltip.js`. Near the bottom of `mountRegionTooltip`, just before `return { show, hide, element: el };` (around line 226), add:

```js
  function onThemeChange() {
    if (!el.hidden) updateLive();   // re-paints the sparkline with new fuel colour
  }
  window.addEventListener("themechange", onThemeChange);
```

The existing return object already exposes `show` / `hide`; no destroy plumbing needed here either.

- [ ] **Step 3: Smoke test**

Run: `npm run dev`. Pause playback (click pause). Switch theme. Expected: the timeline area-stack repaints with the new theme's fuel colours within ~50ms. Click a region on the globe, then switch theme — tooltip sparkline repaints in the new fuel colour.

- [ ] **Step 4: Commit**

```bash
git add src/components/timeline.js src/components/region-tooltip.js
git commit -m "feat(theme): timeline + region-tooltip listen for themechange and re-render"
```

---

### Task 14: Acceptance verification — all three themes render cleanly

**Files:** none modified — verification only.

Manual playback through each acceptance criterion from spec §"Acceptance criteria". This task does not produce a commit unless an issue is found and fixed in a sub-step.

- [ ] **Criterion 1: Toggle visible, persisted, no FOUC.**

Open `http://localhost:3000` in an incognito window (so localStorage starts clean).
Expected: page paints in Sunfire on first frame. Three-chip toggle visible in header.
Click "Eclipse". Reload. Expected: page paints in Eclipse on first frame (no flash of Sunfire).
Open DevTools → Application → Local Storage. Expected: `elj-theme: "eclipse"`.
Set localStorage value to `"garbage"` via DevTools, hard reload. Expected: paint in Sunfire (fallback), DevTools shows `<html data-theme="sunfire">`.

- [ ] **Criterion 2: All three themes render without breakage.**

For each theme: scroll through the entire page (top → footer). Confirm:
- Headline `% curtailed` reads in theme display font, no missing glyphs.
- Hotspot list renders in body font, dot colour matches theme's fuel colours.
- Globe pillars are coloured by `getFuelColor()` — should be ice cyan (Sunfire), ink blue (Vellum), magenta (Eclipse) for wind/solar; flare regions are off-globe so don't appear.
- Timeline area stack shows three coloured layers + crisp top stroke (now using `--hairline-strong`).
- Methodology link, ModeToggle, ThemeToggle all readable with sufficient contrast.

If any of the three themes shows a layout break or unreadable text, file a follow-up issue (don't fix in this task — the spec says "render without visual breakage", and small contrast/spacing tweaks are out of scope; only break-the-page issues block).

- [ ] **Criterion 3: Night-side globe legibility.**

Pause playback. Scrub timeline to UTC 04 (Atlantic + Europe in night, Asia just rising). For each theme:
- Sunfire: country dots in Europe should be clearly visible as warm-tan dots. North America dots should be a brighter cream (sunlit). Difference is obvious.
- Vellum: same effect with parchment-cream / muted-tan dots.
- Eclipse: dots transition from white (sunlit) to neutral grey (night). The night-side overlay has a slight warm tint, not pure black.

Compare side-by-side with v0-build at the same UTC hour (open the deployed v0 in a separate tab, or `git stash` and run dev) — the v0 night side should show country dots as nearly invisible. v0.5 should have visibly populated night hemisphere.

- [ ] **Criterion 4: Theme switch repaints globe within one frame.**

DevTools → Performance → Record. Click "Vellum". Stop recording.
Expected: the `themechange` event fires; `refreshTokens` runs (calls `render`); next animation frame paints the globe in Vellum tokens. Total time from click to next paint should be < 50ms on a modern desktop.
Inspect the canvas at any frame ≥ 1 frame after the click. There should be NO surviving rgba(20,175,172) pixels (the v0 teal). If any remain, an unsubscribed render path is keeping stale colour.

- [ ] **Criterion 5: Existing tests pass.**

Run: `npm test`
Expected: PASS — all 7 existing test files plus 3 new test files (theme-tokens, theme-toggle, fuel-color), 100% green.

Run: `npm run typecheck`
Expected: PASS — no TS errors. The `Fuel | "flare"` widening in `getFuelColor` is the only new type surface; consumer call sites pass strings that satisfy the union.

- [ ] **Criterion 6: `getComputedStyle` called at most once per `themechange` per surface.**

This is enforced by code structure (Task 12 caches in `tokens` outside the `render()` function; Task 13 subscribes once per surface), not by a test. Verify by inspection:

Run: `grep -n "getComputedStyle" src/globe.js src/components/timeline.js src/components/region-tooltip.js`
Expected:
- `globe.js`: exactly zero direct calls (it goes through `readGlobeTokens`).
- `timeline.js`: one direct call in `render()` (acceptable — timeline calls `render` on each clock tick, which is ~60Hz only when the clock is playing; the cost is one CSS-var read per frame, comparable to the canvas paint itself; if profiler shows this as hot, hoist into a cached `tokens` object the way globe does).
- `region-tooltip.js`: zero direct calls.

If `globe.js` has any direct `getComputedStyle` call, that's a regression — fix it.

- [ ] **Step (only if a fix was needed):** Commit the fix:

```bash
git add <fixed-file>
git commit -m "fix(theme): <one-line description of the issue and resolution>"
```

---

### Task 15: Final code review and PR readiness

**Files:** none modified — final checks only.

- [ ] **Step 1: Confirm working tree is clean and on the branch**

Run: `git status && git branch --show-current`
Expected: `working tree clean`, branch `feat/theme-system-spec`.

- [ ] **Step 2: Check the commit graph reads sensibly**

Run: `git log --oneline v0-build..HEAD`
Expected: ~14 commits, each one a coherent chunk:
1. spec doc (`cd2109f`)
2. chore: add jsdom devDependency
3. feat(theme): self-hosted woff2 fonts
4. feat(theme): @font-face declarations
5. feat(theme): :root token refactor into 3 blocks
6. feat(theme): switch chrome rules to semantic tokens
7. feat(theme): theme-tokens helpers
8. feat(theme): no-FOUC inline boot script
9. feat(theme): ThemeToggle component
10. feat(theme): mount ThemeToggle in app header
11. feat(theme): getFuelColor() runtime reader
12. feat(theme): migrate FUEL_COLOR consumers
13. feat(theme): globe.js token reads + legibility fix
14. feat(theme): timeline + tooltip listen for themechange
(Fix commits from Task 14 are additive.)

If the order is muddled or commits are too granular, `git rebase -i v0-build` to clean up — but only if every test still passes after the rebase. Do NOT amend commits that have already been pushed (none have at this point, but check `git log @{u}..` before rebasing).

- [ ] **Step 3: Run the full validation gauntlet**

Run: `npm test && npm run typecheck && npm run build`
Expected: all three exit `0`. The build command runs the Observable Framework production build; confirm no warnings about missing fonts or stylesheet errors.

- [ ] **Step 4: Self-check the spec acceptance list one more time**

Open `docs/superpowers/specs/2026-04-27-theme-system-design.md` and read §"Acceptance criteria". For each bullet, point to where in this branch the criterion is satisfied:
- Toggle in header, persists, no FOUC → Tasks 7, 8, 9.
- Three themes render → Task 4 + Task 14 Criterion 2.
- Night-side legibility → Task 12 Steps 6–7 + Task 14 Criterion 3.
- Theme switch within one frame → Task 12 Step 2 (`refreshTokens` calls `render` synchronously) + Task 14 Criterion 4.
- Existing tests pass → Task 14 Criterion 5.
- `getComputedStyle` discipline → Task 12 Step 2 (caches at mount) + Task 14 Criterion 6.

If any criterion has no clean home in the branch, that's a gap — file a follow-up task before opening the PR.

- [ ] **Step 5: Push the branch and open a draft PR**

Only after explicit user approval ("push the branch" or equivalent). Ask first.

When approved:

```bash
git push -u origin feat/theme-system-spec
gh pr create --draft --title "feat: theme system (Sunfire / Vellum / Eclipse) + globe night-side legibility" --body "$(cat <<'EOF'
## Summary
- Decouples Every Last Joule's visual identity from Stacked's brand teal.
- Three runtime-switchable themes: **Sunfire** (default), **Vellum**, **Eclipse**.
- Three-chip toggle in the app header, persisted to `localStorage.elj-theme`, no-FOUC inline boot script.
- CSS-variable architecture: 3 × `:root[data-theme="..."]` blocks; future colour/font tweaks are one-edit changes.
- Globe night-side legibility fix: dot brightness floor 0.05 → 0.30, dual day/night dot colours, warm-tinted overlay (Eclipse uses a synthesized canvas linear-gradient).
- 15 new self-hosted woff2 fonts under SIL OFL (~600 KB).
- `FUEL_COLOR` const → `getFuelColor()` runtime reader so canvas-painted surfaces re-colour on theme switch.

Spec: [`docs/superpowers/specs/2026-04-27-theme-system-design.md`](docs/superpowers/specs/2026-04-27-theme-system-design.md)
Plan: [`docs/superpowers/plans/2026-04-27-theme-system.md`](docs/superpowers/plans/2026-04-27-theme-system.md)

## Test plan
- [ ] `npm test` — all unit tests green (incl. 3 new theme-system test files).
- [ ] `npm run typecheck` — clean.
- [ ] `npm run build` — clean Observable build.
- [ ] Manual: load preview, cycle Sunfire → Vellum → Eclipse via the toggle. Confirm no layout shift, no FOUC, fonts swap correctly.
- [ ] Manual: scrub timeline to UTC 04, confirm night-side hemisphere is legibly populated in all three themes.
- [ ] Manual: incognito window — confirm Sunfire is the default. Set localStorage `elj-theme=eclipse`, hard reload — confirm no flash.
- [ ] Manual: keyboard navigation on the toggle — ArrowLeft/Right cycles, focus-visible outline shows.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 6: Final commit if any nit-fixes happened during review**

If Task 14 or any of the above steps revealed last-mile fixes, ensure they each have a clear `fix(theme): …` commit and that the branch ends in a green state.

---

## Self-review (controller-side, after writing this plan)

Spec coverage check:

| Spec section | Plan task(s) |
|---|---|
| §Architecture / CSS variable structure | Task 4 |
| §No-FOUC inline script | Task 7 |
| §Theme change event contract | Task 8 (dispatch) + Task 12, 13 (consume) |
| §File-by-file change list | Tasks 4, 5, 9, 10, 11, 12, 13 (one-to-one with the table) |
| §Night-side legibility fix → country dots | Task 12 Step 6 |
| §Night-side legibility fix → borders | Task 12 Steps 7–8 |
| §Night-side legibility fix → night overlay | Task 12 Step 5 (incl. Eclipse gradient handling) |
| §Night-side legibility fix → day-side gradient | Task 12 Step 4 |
| §Theme toggle component (markup, CSS, behaviour) | Tasks 8, 9 |
| §Fuel colour migration | Tasks 10, 11 |
| §Font hosting and weights (15 woff2, ~600 KB, OFL) | Tasks 2, 3 |
| §Open question resolved (`prefers-color-scheme` ignored) | Implicit in CSS — no `@media (prefers-color-scheme)` rules added anywhere |
| §Out of scope (og-image, favicon, print, light-mode, Gotham removal) | Honoured — no task touches these |
| §Risks #1 (Observable head-script ordering) | Task 7 Step 2 (built-HTML inspection) |
| §Risks #2 (`getComputedStyle` caching) | Task 12 Step 2 (cache at mount, refresh on themechange only) + Task 14 Criterion 6 |
| §Risks #3 (Eclipse linear-gradient on canvas) | Task 12 Step 5 (`isLinearGradientToken` branch + synthesized canvas gradient) |
| §Risks #4 (fuel-colour resolution timing) | Task 7 (boot script first) + Task 10 (SSR fallback) |
| §Risks #5 (Vercel build with ~600 KB fonts) | Task 15 Step 3 (`npm run build` runs the same pipeline Vercel uses) |
| §Acceptance criteria 1–6 | Task 14, criterion-by-criterion |

No gaps identified.

Placeholder scan: searched the plan for "TBD", "TODO", "appropriate", "handle edge cases", "similar to", "fill in", "add as needed". One intentional reference remains: Task 14 says "file a follow-up issue (don't fix in this task)" — that is direction, not placeholder content.

Type consistency: `getFuelColor` accepts `Fuel | "flare"`; consumers in Task 11 pass `dominantFuel(...)` (returns `Fuel`) or string literals `"flare"` / `"wind"` — all valid. `mountThemeToggle` returns `() => void` (cleanup); test in Task 8 calls `cleanup()` — consistent. `readGlobeTokens` returns `GlobeTokens`; `globe.js` reads `tokens.dotDayRGB` etc. — names match across `theme-tokens.ts` and `globe.js`.
