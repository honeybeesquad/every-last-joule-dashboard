# Every Last Joule - light and dark redesign: implementation spec

> **STATUS: ACTIVE.** PR 1 (theme plumbing) is on branch `feat/light-dark-theme-plumbing`, in review. PRs 2-5 have not started. Keep this file current as each PR lands; archive it with a `STATUS: SHIPPED` banner in PR 5.
>
> This is the handoff's SPEC.md (from `Claude outputs/elj-light-dark-handoff/`, untracked and never committed), copied in as the active plan on 2026-09-23. Paths like `mocks/`, `tokens/`, `reference/` and `screenshots/` are relative to that handoff folder, not to the repo. Edits since the copy: the decisions table in section 0 records the answers, section 7 records D6's answer, section 10 records PR status, and "PR 1 as built" below records where the build departs from, or adds to, the text.

## PR 1 as built (2026-09-23)

What PR 1 does beyond, or differently from, the sections below. Each item is in the PR description too.

1. **Sunfire stays, for the paper figure only.** Section 4.1 says `tokens/themes.css` replaces the Sunfire and Deep Current blocks. `src/embed/globe.md` pins `data-theme="sunfire"` and reads that block for its fuel and globe tokens, and it must look exactly as before (section 0). So the Sunfire block stays, unchanged, commented as embed-only. Deep Current is gone. The boot script pins `sunfire` on `/embed/` paths, so the figure never paints a mode first. PR 5 can move those tokens under `#embed-root` and drop the name.
2. **Following the OS lives in the boot script, not the toggle.** Section 4.3 puts "follow live `prefers-color-scheme` changes until the visitor picks" in `theme-toggle.js`. The doc pages have no toggle, so the listener is in the boot script (`src/lib/theme-boot.ts`), which runs on every page. It dispatches `themechange`, and the toggle re-syncs on that event.
3. **One new token, `--brand-text`.** Ink in light, `--brand` in dark. The brand colour is 3.2:1 on paper (section 9: "never small text"), so every rule that set small text in `--brand` (eyebrows, links, active chips, the doc pages' eyebrow) now reads `--brand-text`. Light links also get an underline.
4. **Observable Framework's own variables are mapped per mode.** The config's Framework theme is `dark`, so its `--theme-foreground` / `--theme-background` would stay dark on paper. Both mode blocks set them from the site tokens.
5. **The header mark is inline and token-driven, but stays where it is.** The generator emits a third block (`brand-mark-still` markers in `src/index.md`) and the sidebar lockup uses it instead of `<img src="/brand/mark-still.svg">`. Moving it into `.app-header` is a layout change, so it goes with the header restructure in PR 2. The lead pillars draw at opacity 1, as in the mocks (the old mark used 0.95).
6. **The wordmark takes the mode's face everywhere now** (header and loader share one lockup rule): Newsreader 500 with italic 400 "Joule" in light, Geist 600 upright in dark, "Joule" in ink. Sizes are unchanged until the layout PRs.
7. **The globe renderer is unchanged.** In light, the G1 renderer takes the light tokens: a paper sphere, ink land dots and fuel-coloured pillars. It is legible, not the engraved globe; that is PR 2. The selected-region ring now reads `--ink` (was `#7cb8ff`).
8. **The timeline** reads `--ink` for the playhead (amber was 2.0:1 on paper), `--ink-soft` for hour labels, and `--font-mono` for its font (it still named Gotham).
9. **Tests added:** `theme-boot`, `style-colour-literals` (a colour literal may appear only as a token definition or in a two-entry allowlist: the no-JS fallback), `theme-contrast` (the section 9 pairs, computed from the tokens), plus rewrites of `theme-toggle`, `brand-mark` and `theme-tokens`.


Light mode is **Almanac** (an engraved atlas on paper). Dark mode is **Horizon** (the planet as a horizon, pillars as beams of light). Switching mode swaps the layout as well as the palette. This spec covers `src/index.md` (the dashboard) in full, and the shared chrome (header, tokens, fonts, mark) on every other page.

Measured against the repo at `7f9c8a14` (main, 2026-09-23). Line numbers below are from that commit.

Visual truth, in order: `mocks/*.html` (exact sizes, colours, spacing), then `screenshots/`, then this document. Where the mocks and this document disagree about **behaviour or data**, this document wins. Where they disagree about **looks**, the mocks win.

---

## 0. Decided, and still open

### Decided in design review (Simon, 2026-09-23)

1. Light = Almanac, dark = Horizon. The mode switch swaps the layout, not only colours.
2. Display faces: **Newsreader** in light, **Geist** (600) in dark. Body is Geist and labels are Geist Mono in both modes. This replaces Schibsted Grotesk, IBM Plex Mono and Inter on the dashboard.
3. Fuel hues are the same families in both modes: solar orange, wind blue, hydro teal.
4. The mark and its animation stay. Its colours change per mode (section 7).
5. The pillars stay: needles in light, beams of light in dark. Length still scales with the square root of GW.

### Open - confirm with Simon before the PR that needs it

Answers recorded 2026-09-23 for the four PR 1 needs. D4 and D5 are still open.

| # | Question | Recommendation | Needed by |
|---|---|---|---|
| D1 | First-visit mode when nothing is stored | Follow `prefers-color-scheme` | PR 1. **Answered: follow the OS**, as recommended |
| D2 | Stored `elj-theme` values `sunfire` / `deepcurrent` | Map both to `dark`. Both old themes were dark, so returning visitors keep a dark site | PR 1. **Answered: map both to dark**, as recommended |
| D3 | This supersedes the 2026-09-20 "Brand face site-wide - Schibsted Grotesk" entry and brings back an italic serif "Joule" (light only). Does the page loader's lockup follow the mode too? | Yes. The loader uses the mode's wordmark and colours (the boot script sets `data-theme` before the loader paints) | PR 1. **Answered: yes**, as recommended |
| D4 | Speed chips: the mocks show 1×, 4×, 8× and Now. `controls.js` has 0.5×, 1×, 2×, 4×, 8× and Now, default 0.5× | Use the mocks' three plus Now, default 1×. It is a behaviour change, so it needs a yes | PR 2 |
| D5 | Quality encoding on the globe changes shape (section 6.1). The buckets and opacities in `region-quality.ts` do not change | Accept; update `#globe-legend` copy | PR 2 |
| D6 | The published files in `src/brand/` (still, loop, two avatars) | Leave them on the current colours. The site's own marks become token-driven (section 7) | PR 1. **Answered: regenerate them in the new dark (Horizon) palette**, not the recommendation. See section 7 |

### Not changing

- Data, loaders, `regions.ts`, tiers, `src/data/*`. No tier moves. `npm run ci:gates` must pass without touching a golden file.
- `src/embed/globe.md` (the DARI paper figure). STATUS excludes it on purpose: its look is part of a published artefact. It keeps Fraunces and its own styling.
- Page structure of Regions, History, Methodology, Paper, About and `/region/<id>`. They get the new header and tokens only, and must be legible in both modes (section 9).
- The live copy. The mocks paraphrase `#lead-copy`. Keep the live text and its caveats. **The phone mocks drop "Lower bound: what operators publish." Do not.** CLAUDE.md rule 3: never delete an honesty caveat.
- Every number in the mocks is a design snapshot (06:56 UTC, 30-day average, 444 regions). The live site says 459. Every figure on the page comes from data.

---

## 1. Files in this handoff

| Path | What it is | Use |
|---|---|---|
| `mocks/light-desktop.html`, `light-phone.html`, `dark-desktop.html`, `dark-phone.html` | The approved boards as static HTML at 1440×900 and 390×844 | Read exact values from the inline styles |
| `mocks/type-specimen.html` | The display-face comparison Simon chose from | Context only |
| `screenshots/*.png` | The same boards as images, plus reference-harness captures | Visual diffing |
| `tokens/themes.css` | Light and dark token blocks, repo token names | Replace the sunfire / deepcurrent blocks |
| `tokens/font-face.css` | `@font-face` rules with `/fonts/` paths | Paste into `style.css` |
| `tokens/tokens.json` | The same tokens plus renderer constants, machine-readable | Tests, and if you prefer constants from JSON |
| `fonts/` | Four variable woff2 files, OFL texts, `SOURCES-entry.md` | Copy to `src/fonts/` |
| `reference/` | Working Canvas 2D renderers for both globes, both timelines, and a harness | Port into `src/globe.js` and `src/components/timeline.js`. See `reference/README.md` |

---

## 2. Breakpoints

| Name | Width | Light | Dark |
|---|---|---|---|
| Desktop | ≥ 1100px | Three columns: hero, globe, rail. Timeline band below | Full-bleed horizon, hero top left, glass dock at the bottom |
| Tablet | 641-1099px | Two columns: hero and globe. Rail and timeline full width below | Horizon behind; the dock splits into two stacked cards |
| Phone | ≤ 640px | Single column. Static globe with "Explore the globe" | Horizon band in the lower half. Bottom sheet |

The mocks draw desktop at 1440×900 and phone at 390×844. Tablet is not drawn: build it from the rules here and check it at 768 and 1024.

The STATUS entries of 2026-09-23 are the bar for phones: at 320, 375 and 390, `scrollWidth` must equal `clientWidth` on every page in both modes. The controls rows that overflowed before (speed chips, zoom row, header right) must wrap.

---

## 3. One DOM, two layouts

Keep **one** DOM in `src/index.md` and switch layout with CSS on `:root[data-theme]`. Do not render two trees and hide one: that duplicates IDs and makes `aria-live` regions announce twice.

Keep every existing ID. Scripts and tests read them: `#pct-readout`, `#lead-copy`, `#region-count`, `#hashrate-readout`, `#gw-readout`, `#supportable-readout`, `#globe-canvas`, `#globe-legend`, `#globe-placeholder`, `#hotspots-title`, `#hotspot-list`, `#rail-note`, `#timeline-canvas`, `#timeline-controls`, `#mode-toggle`, `#units-toggle`, `#theme-toggle-mount`, `#caption-copy`, `#refreshed-at`, `#page-loader`.

Structural changes from today's markup (`index.md` lines 77-190):

- The mark and wordmark move from `.app-brand` (inside `.app-body`, put there by #1058) into `.app-header`, left, in both modes.
- The version tag becomes the `v1.4.0 · DOI` pill in the nav. It keeps its link to the Zenodo record.
- The stats need a long and a short label (light "Curtailed this hour", dark "Curtailed now"). Put both in the DOM, show one per mode, and mark the short one `aria-hidden="true"` so the accessible name never changes.
- The hotspot list renders ten `<li>` in both modes. Each `<li>` carries rank, needle swatch, name, `est.` tag, bar and value. CSS shows the parts each mode uses. Dark shows the first five.

### 3.1 Light desktop (mock: `light-desktop.html`)

```
page padding-inline: 56px
┌ header 76px, bottom rule --hairline ───────────────────────────────────┐
│ mark 30 + wordmark      Regions History Methodology Paper About  pill ☀☾│
├ hero 396px ─────┬ globe (1fr) ─────────────────────┬ 34 ┬ rail 234px ──┤
│ top 32px below   │ square; R = 0.43 × min(col w,     │    │ top 28px below │
│ the header rule  │ row h); selected card floats here │    │ the header rule│
├ timeline band: 1px --ink top rule, 152px ──────────────────────────────┤
│ fuel labels 180 │ small multiples (flex) │ controls 224                  │
└──────────────────────────────────────────────────────────────────────────┘
```

- Grid: `grid-template-columns: 396px minmax(0, 1fr) 234px`, a 34px gap before the rail, rows `76px minmax(0, 1fr) 152px`, `min-height: 100svh`. The footer (`.app-footer`) follows below the fold.
- At 1440×900 the globe centre is (784, 404) and R ≈ 287.
- Hero: eyebrow Mono 12px uppercase 0.08em. The % is 156px, 22px below, pulled left 6px (optical). Lead 18/1.45, 22px below. Stats 28px below: three rows, each `padding: 11px 0 10px`, 1px top rule, label Geist 14 left, figure right. Caption 18px below, 12.5/1.5, starting with *Fig. 1* in Newsreader italic 15px. Its text is the `#caption-copy` content.
- Rail: "Largest now" (h2) with `UTC 06:56` in Mono 11 on the right. Ten rows, then "N more curtailing" with an "All regions" link, then the legend (a two-column grid, 26px below).
- Timeline band: label "By fuel · 30-day avg" Mono 11 at the top left; hour ticks 00/06/12/18/24 in Mono 11 above the chart; fuel label column 180px (dot, name, value in Mono 13, rows 26px tall with 8px gaps); chart from x = 200 inside the band, 880px at 1440; controls column 224px at the right, three rows 6px apart: play (34px ink circle) + speeds + Now; the time-window control; the units control.

### 3.2 Dark desktop (mock: `dark-desktop.html`)

```
┌ canvas: fixed, inset 0, z-index 0 (stars, atmosphere, horizon, beams) ─┐
│ header 76px, padding-inline 48px, no rule                              │
│ hero at (48, 128), width 600                                           │
│   radial scrim behind it: 980×760 box at (-200, -120),                 │
│   closest-side, rgba(5,7,11,0.82) to transparent                       │
│                                                                        │
│ ┌ dock: left/right/bottom 24px, height 196, radius 20 ───────────────┐ │
│ │ timeline + controls (1fr)               │ largest now (420px)      │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

- The first viewport is a stage: `height: 100svh; min-height: 720px`. The canvas is fixed to it and the dock sits at the bottom of the stage, not the page. The footer follows the stage.
- Hero: eyebrow Mono 11 uppercase 0.08em in `--brand`, with a 7px `--brand` dot glowing 10px, text "06:56 UTC · Hashrate this waste could cover" (the time is live). The % is 184px, 20px below, pulled left 8px. Lead 18/1.5 in `--ink-muted`, `max-width: 470px`, 24px below. Stats 32px below in one row: three cells, `padding: 0 22px`, a 1px `--hairline` left border on the second and third, label Mono 11 uppercase `--ink-muted`, figure Geist 500 30px -0.02em, unit Mono 11 `--ink-muted`.
- Dock: `background: var(--surface-panel); backdrop-filter: blur(18px); border: 1px solid var(--hairline)`; grid `minmax(0, 1fr) 420px`.
  - Left cell, `padding: 18px 24px`: a header row ("Global curtailment · 24 h · 30-day average" on the left, the fuel legend with glowing 8px dots on the right, both Mono 11 uppercase); the ribbon 620×80, 18px below; hour labels Mono 10 `--ink-muted`, 6px below. Controls are absolutely placed `right: 24px; top: 58px`, right-aligned, 8px apart: play (44px `--brand` circle, glow `0 0 22px rgba(255,181,71,0.4)`) + speeds; the time-window control; the units control (labels "GW" and "% gen" here).
  - Right cell, `padding: 18px 24px`, 1px `--hairline` left border: "Largest now" with "All N" in `--brand`; five rows (`grid-template-columns: minmax(0, 1fr) 110px 52px`, 12px gap, 25px tall): name Geist 14, a 3px bar (track `rgba(160,200,255,0.12)`, fill in the fuel colour with a 10px glow, width GW / max × 110, at least 4px), value Mono 12 right-aligned; footnote "Brighter beam = higher confidence", Mono 10 uppercase `--ink-muted`.
- Segmented controls in dark: 34px tall, 4px padding, 2px gap, `--hairline` border, pill. Items 26px tall, `padding: 0 11px`, Mono 10.5 uppercase. Active item: `--brand-subtle` fill, `--brand` text.

### 3.3 Light phone (mock: `light-phone.html`)

- Header 64px, `margin: 0 16px 0 20px`, bottom rule. Mark 26 + wordmark 22px. Right: the mode button (44px circle, `--hairline` border, moon icon) and the menu button (44px). The nav moves into the menu.
- Hero, `padding: 22px 20px 0`: eyebrow Mono 11 with the time ("Hashrate this waste could cover · 06:56 UTC"); % at 118px; lead 16/1.45, full copy including the lower-bound sentence.
- Figure 390×372, 34px below: the globe is drawn 420px square at (-15, -12), bleeding past both edges (`overflow: hidden` on the figure). It is **static**: no touch handlers, so a vertical swipe scrolls the page. "Explore the globe" is a 44px ink pill at `right: 20px; bottom: 6px` that opens the explorer (section 6.4).
- Stats: two columns under a 1px `--ink` rule, figures in Newsreader 30 with Mono 12 units, labels 12.5. The network hashrate is left out on phones, as in the mock.
- "Largest now" (h2, 23px) and the list (`grid-template-columns: 22px 26px minmax(0, 1fr) auto`, rows `padding: 10px 0`, names 15px, values Mono 14 with " GW"). The mock shows four rows above the fold. Render all ten.
- Below the fold (not drawn; build it like this): "N more curtailing · All regions", the legend, the timeline band full width (fuel labels above the chart, not beside it), then the controls in wrapping rows (play + speeds + Now; the time-window control full width; the units control full width), then the footer.

### 3.4 Dark phone (mock: `dark-phone.html`)

- A one-screen stage (`100svh`). The horizon is drawn into a band from y = 314 to the bottom (390×530 at 844 tall): R = 650, limb top 235px into the band, `lat0 = -38`, beam scale 0.12, width scale 0.75, dot scale 0.8. The band is static until the explorer opens.
- Header 64px, `padding: 0 16px 0 20px`, no rule. Mark 26 + wordmark Geist 600 17px. Mode button (sun icon) and menu.
- Hero, `padding: 16px 20px 0`: eyebrow Mono 10 `--brand` with a 6px dot, "06:56 UTC · Hashrate it could cover"; % at 116px; lead 15/1.5 `--ink-muted`, full copy.
- "Explore the globe": a glass pill centred at y = 632 (`--surface-panel` at 0.7, blur 10, `--hairline` border).
- Bottom sheet: fixed `left/right/bottom: 8px`, 132px collapsed, radius 20, `rgba(6,9,14,0.82)` with blur 16, a 36×4 handle. Collapsed: two stats (label Mono 10 uppercase, figure Geist 500 28) and a row naming the top region ("● Sichuan leads · 6.8 GW", both live). Dragging the handle up or tapping it expands the sheet to 70% of the viewport: ribbon, controls and the top ten (not drawn; use the dock's styles). It is a `dialog`-like region: focus moves in when it expands, Esc collapses it.

### 3.5 Switching mode

- Globe state carries across: hour, play state, speed, selection, follow-the-sun, and camera longitude. Latitude is per mode (light keeps its own; dark is fixed).
- On `themechange`: re-read tokens (as `theme-tokens.ts` does now), swap the renderer, rebuild the dark caches (backdrop, sprites, lit territory) or drop them in light.
- Use `document.startViewTransition` for a 200ms cross-fade where it exists and `prefers-reduced-motion` is not `reduce`. Otherwise switch instantly.

---

## 4. Theme plumbing

### 4.1 Tokens

`tokens/themes.css` replaces `style.css` lines 144-268 (the two theme blocks and the Sunfire fallback). It uses the repo's token names, so every existing rule keeps resolving. New tokens are marked `NEW`. The rules that read them:

- `--surface-panel`: the dark dock and bottom sheet (with `backdrop-filter`), light sticky bars.
- `--fuel-*-tip`: beam cores and tip glows in dark.
- `--globe-ink-rgb`, `--globe-paper`, `--globe-atmosphere-rgb`, `--globe-land-rgb`: the two globe renderers. Add them to `readGlobeTokens` in `src/lib/theme-tokens.ts` with fallbacks, like the existing ones.
- `--mark-*`: the generated loader mark and the inline header mark (section 7).
- `--display-tracking`, `--display-leading`, `--fs-hero`: the hero %.

Two changes to existing rules that the tokens need:

- `.display-xl`, `.display-lg` and `.display` (lines 302-315) hard-code `--fw-black` / `--fw-bold`. Point them at `--display-weight-strong` / `--display-weight-base`, or the light hero renders Newsreader at 800.
- `html, body` already paint `var(--surface-bg-3)`. Keep that; it is the page colour in both blocks.

### 4.2 Hard-coded colours

Both old themes were dark, so `style.css` assumes a dark ground in many places: at `7f9c8a14` it has **70** `rgba(255,255,255,…)` literals and **153** hex literals (e.g. line 326, `.app-shell p.lead { color: rgba(255,255,255,0.72); }`, and again at 1653 and 1672). `src/globe.js` and `src/components/timeline.js` also paint white. Every one becomes a token or is shown to be theme-neutral. Add a test that fails on new white literals in `style.css`, with an allowlist for the ones that are right in both modes.

### 4.3 Boot script and toggle

Replace the inline script in `observablehq.config.ts` `head:` (line 89):

```js
(function () {
  var d = document.documentElement, t = null;
  try { t = localStorage.getItem("elj-theme"); } catch (e) {}
  if (t === "sunfire" || t === "deepcurrent") t = "dark";            // D2
  if (t !== "light" && t !== "dark") {                                 // D1
    t = window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  d.setAttribute("data-theme", t);
}());
```

`src/components/theme-toggle.js`:

- `VALID_THEMES = ["light", "dark"]`. Keep the radiogroup, `aria-checked`, the roving tabindex, arrow keys, the `themechange` event and `localStorage["elj-theme"]`.
- Desktop look: a 34px pill with a 1px border (`--hairline-strong` in light, `--hairline` in dark) and 3px padding, holding two 40×28 buttons with sun and moon icons (16px, 1.4px stroke; SVG in the mocks). The active button is filled with `--ink` and its icon drawn in `--surface-bg-3`. Accessible names "Light mode" and "Dark mode".
- Phone look: one 44px round button showing the mode you would switch **to** (moon in light, sun in dark), `aria-label="Switch to dark mode"` and so on. Same component, a `compact` option.
- When nothing is stored, follow live changes to `prefers-color-scheme` without writing to storage. Once the visitor picks, stop following.

### 4.4 Fonts

Copy the four files from `fonts/` into `src/fonts/`. Paste `tokens/font-face.css` into `style.css`. Add the `SOURCES.md` rows from `fonts/SOURCES-entry.md`. `config.dynamicPaths` already globs `src/fonts`.

Do not delete Inter, IBM Plex, Schibsted Grotesk or Fraunces in the redesign PRs. Fraunces is still used by `embed/globe.md`; the rest can go in a clean-up PR after a grep.

---

## 5. Type

| Role | Light | Dark |
|---|---|---|
| Hero % | Newsreader 400, 156px (phone 118), line-height 0.9, -0.04em. The `%` is italic at -0.02em | Geist 600, 184px (phone 116), 0.9, -0.06em |
| Eyebrow | Geist Mono 12 (phone 11), uppercase, 0.08em | Geist Mono 11 (phone 10), uppercase, 0.08em, `--brand`, glowing dot |
| Lead | Geist 18/1.45 (phone 16), `--ink` | Geist 18/1.5 (phone 15), `--ink-muted` |
| Stat figure | Newsreader 400, 30px, -0.01em; unit Mono 12 | Geist 500, 30px (phone 28), -0.02em; unit Mono 11 `--ink-muted` |
| Stat label | Geist 14 | Mono 11 uppercase `--ink-muted` |
| Section title | Newsreader 500, 25px (phone 23) | Mono 11 uppercase |
| List row | name Geist 13.5 (phone 15), rank Mono 11, value Mono 13 (phone 14), `est.` Newsreader italic 14 | name Geist 14, value Mono 12 |
| Caption | 12.5/1.5; *Fig. 1* Newsreader italic 15 | n/a |
| Wordmark | Newsreader 500, 26px (phone 22), -0.015em; "Joule" italic 400 | Geist 600, 18px (phone 17), -0.02em, upright |
| Nav | Geist 14; pill Mono 12 | same |
| Controls | Geist 500 13 | Mono 10.5 uppercase |

Use `font-variant-numeric: tabular-nums` on every figure that changes while the timeline plays, so digits do not jitter. Newsreader's optical size is automatic (`font-optical-sizing: auto`); do not set `opsz` by hand.

---

## 6. The globes

### 6.1 Shared rules

- **One canvas**, `#globe-canvas`; the renderer is chosen by mode. Reference code: `reference/engraved-globe.js` (light) and `reference/horizon-globe.js` (dark). Port them into `src/globe.js` (or two modules it calls). Keep what `globe.js` already does well: the rasterised land mask and dot field (`globe-geo.ts`), lit territory (`globe-surface.ts`), `visibilitychange` pausing, zoom.
- **Regions are already one fuel each** (STATUS: one bar per fuel per region, never stacked; `pillar-layout.ts`). Draw one needle or beam per region record, coloured with `getRegionFuelColor()` from `fuel.ts` as now. No hard-coded fuel hex (CLAUDE.md).
- **Length** scales with √GW, as on the live site. Constants per renderer are in `tokens/tokens.json` → `renderer_constants`.
- **Quality**: keep `qualityBucket()`, `qualityOpacity()` and `dotStyleFor()` from `src/lib/region-quality.ts`. Only the drawing changes:

| Bucket | Light needle | Dark beam |
|---|---|---|
| measured | solid line, solid head | full brightness (opacity 1) |
| anchored | solid line, hollow head | opacity 0.8 |
| estimated | dashed line `[2sk, 2sk]`, solid head | opacity 0.62 and a dashed core `[4, 3]` |
| degraded (stale feed) | dashed `--quality-warning` ring around the head | dashed `--quality-warning` ring at the base |

  The ring is dashed so it reads by shape as well as colour: in light, `--quality-warning` (#B45309) is too close to solar orange to carry the meaning alone. The hotspot list shows the same state in text (`est.`, and "stale" for degraded), which is the non-colour equivalent (WCAG 1.4.1).

- **Sun**: `reference/geo.js` `subsolar()` gives declination from the date and longitude from `(12 - UTC hour) × 15`, the same rule `solar-mask.ts` `isSolarNight()` uses. It is more accurate than the sinusoid in `globe.js` line 356; either is acceptable, but the drawn terminator and the data mask must use the same longitude rule, or a solar needle can stand on the night side at dawn and dusk. Do not add the equation of time unless `solar-mask.ts` changes in the same PR.
- **Follow the sun** (default on): light `lon0 = sun lon + 22°`, `lat0 = 24°`; dark `lon0 = sun lon + 20°`, `lat0 = -36°`. Dragging turns it off; "Now" turns it back on. With reduced motion, there is no auto-rotation: the camera moves only when the hour changes.
- **Labels**: none at rest (STATUS rule). One label only, for the selected region. It tracks its needle or beam tip in **both axes** at a fixed offset along the outward direction, and flips side near the viewport edge. STATUS records why: the last on-globe callouts pinned x to a gutter, so they looked stuck when the globe turned.
- **Hover** keeps `region-tooltip.js`, restyled: light is a paper card with a 1px `--ink` border and no shadow, name in Newsreader 500 20px; dark is glass (`--surface-panel`, blur 18, `--hairline`, radius 12).
- **Accessibility**: the canvas keeps `role="img"`. Update its `aria-label` when the hour changes (debounced to one update per second while playing) with the total and the top three regions. The hotspot list is the accessible equivalent of the globe.

### 6.2 Light: the engraved globe

Vector only, no per-pixel work. Built back to front (details in the file header):

1. Sea: parallels every 1.5° as a line screen. Each short segment's width is a fraction ("tone") of the local on-screen spacing between parallels, so lines thicken toward the limb and on the night side. Segments are bucketed to quarter-pixel widths and stroked once per bucket.
2. Night cross-hatch: meridians on the night side only, same method.
3. Land knock-out: land polygons filled with `--globe-paper` erase the sea lines. Coastline keyline on top.
4. Land stipple: the existing dot field; dot radius carries the shade.
5. Limb keyline.
6. Needles: screen-radial (they point away from the globe centre), each with a `--globe-paper` halo so it reads over the stipple, smallest first.
7. Selected: an 8.5sk ink ring around the head, and the label card: 196px wide, `--surface-raised`, 1px `--ink` border, `padding: 10px 12px 11px`; "SELECTED" and the fuel name (in the fuel colour) in Mono 10.5 uppercase; region name Newsreader 500 25px; "6.8 GW now · Estimated" Geist 13. A 1px ink leader runs from the head (+5, -6) up to (+34, -60) and across to the card. The card's top sits 104px above the head.

Cost, headless Chromium, 1440×900 at dpr 2, on a 2-core cloud machine without a GPU: about **16 ms** a frame at full quality and **10 ms** in `fast` mode (coarser screen and every other stipple dot). Phones are roughly 3-4× slower. So:

- Draw on change (hour tick, drag, resize, theme, selection, data), not on every animation frame. The site had to rescue its main thread once already (#1054).
- Pass `fast: true` while dragging and while the timeline plays on a phone.
- The sea and hatch layers depend only on camera and sun. Cache them to an offscreen canvas and redraw them when either moves more than 0.25°. Needles go on top every draw.
- On phones outside the explorer, draw once per hour change.

### 6.3 Dark: the horizon

A large orthographic globe whose centre sits below the viewport, so only a band near the top limb shows. Regions near that limb have beams almost parallel to the screen, so they stand up like light.

- Geometry at desktop: R = 0.94 × max(viewport width, 900); the limb's top point at 50% of the viewport height; centre x at 57% of the width. Phone values are in 3.4.
- Backdrop (stars, atmosphere, body gradient, rim) goes into an offscreen canvas, rebuilt only on resize or theme change, and blitted each frame.
- Land dots every 0.42°, radius 0.55 + 0.65√z, brightness from day/night and distance to the limb, batched into alpha buckets.
- Lit territory: land dots near a curtailing region take its fuel colour. Use `globe-surface.ts` (it already dithers multi-fuel regions and recomputes per 15 minutes). Make its patch radius a parameter: it is `1.5 + 3.4√GW` degrees today, and the dark mock used `0.5 + 1.6√GW` at this camera. Compare against `mocks/images/horizon-dark.jpg`.
- Beams: height `0.004 + 0.1√GW` in units of R, width `1.1 + 1.2√GW` px, additive blending. Three strokes (a wide faint glow, a sheath, a bright core in the tip colour) plus a glow sprite at the ground and a smaller one at the tip. Beams from regions just beyond the horizon are drawn from the point where they clear the limb (solved analytically in the reference: `k0 = 1 / |xy|`).
- Interaction: drag rotates longitude only (latitude stays fixed so the horizon stays put). Tap or click a beam tip to select it. Selected in dark (not drawn in the mocks): the beam draws at full opacity whatever its bucket, a 1px `--ink` ring sits at the tip, and a glass label card (same content as light, Geist 500 20px for the name) tracks the tip.

Cost at 1440×900, dpr 2: about **8 ms** a frame; at 390×844, about **5 ms**.

### 6.4 Explorer (phones, both modes)

The phone globe is static so that scrolling works. "Explore the globe" opens a full-screen explorer:

- `position: fixed; inset: 0`, above the header. Lock body scroll.
- The globe fills it and takes touch: drag to rotate, tap to select, optional pinch to zoom.
- A 44px close button at the top right. A compact timeline scrubber and the play button along the bottom. The selected region shows in a bottom card, not a floating label.
- `history.pushState` on open, so Android back and Esc close it. Focus goes to the close button and returns to the trigger.

---

## 7. The mark

Geometry, timing and the decorative pillar hash stay exactly as `scripts/lib/brand-mark.ts` defines them (44 pillars, the first 26% the "lead", 6.6s cycle). Only the palette changes, and it becomes tokens:

| Token | Light | Dark | Today (hard-coded in the generator) |
|---|---|---|---|
| `--mark-disc` | `#E4570E` | `#FFB547` | `GOLD` #ffd05a |
| `--mark-lead` | `#16150F` | `#F2F5F9` | `CYAN` #67e8f9 at 0.95 |
| `--mark-rest` / `--mark-rest-opacity` | `#16150F` / 0.22 | `#F2F5F9` / 0.22 | `GOLD_DIM` #e6a020 at 0.55 |
| `--mark-tick` | `#16150F` | `#FFFFFF` | `CYAN_TIP` / `GOLD_TIP` |
| `--mark-glow` | transparent | `rgba(255,181,71,0.28)` | gold halo |

Where the mark lives today, and what changes:

- **Loader** (`#page-loader`): since #1054 it is generated HTML and CSS between the `brand-mark:begin` / `brand-mark:end` markers in `src/index.md` and `src/style.css`, not an SVG (SMIL in an `<img>` froze on the main thread). The generated CSS hard-codes `#ffd05a`, `#67e8f9` and `#cffafe`. Change the generator to emit `var(--mark-disc)`, `var(--mark-lead)`, `var(--mark-rest)`, `var(--mark-rest-opacity)`, `var(--mark-tick)` and `var(--mark-glow)` instead, re-run `npm run brand:assets`, and the loader follows the mode with no extra assets. The boot script sets `data-theme` before the loader paints. `tests/brand-mark.test.ts` re-renders from the generator, so its drift check covers the change; add a case asserting no hex colour remains in the generated block.
- **Header** (`img.app-mark` → `/brand/mark-still.svg`, placed in the sidebar by #1058): an SVG in an `<img>` cannot read CSS variables. Emit the still mark inline instead (a third generated block, same markers pattern) with fills from the same variables, and move it into the header. 30px on desktop, 26px on phones, 12px (phone 10px) from the wordmark.
- **`src/brand/*.svg`** (the still, the loop and the two avatars): **regenerated in the dark (Horizon) palette** (D6, answered 2026-09-23): amber disc `#FFB547`, lead `#F2F5F9` at full opacity, rest `#F2F5F9` at 0.22, ticks `#FFFFFF`, and on the avatars a `#05070B` ground with an amber glow. They are static files, so the generator holds these as literals (`MARK_SVG_PALETTE`), and `tests/brand-mark.test.ts` pins each one to the dark block's `--mark-*` token. The transparent `mark-still.svg` and `mark-loop.svg` now assume a dark ground. If nothing on the site references `mark-still.svg` after the header change, keep it for anyone linking to it; do not delete published files in this work.
- Loader wordmark: the mode's wordmark (D3): Newsreader 500 with italic "Joule" in light, Geist 600 in dark.

---

## 8. Motion and performance

- No animation loop while idle. Draw on change (6.2). Pause on `visibilitychange` (already done) and when the globe is off screen (`IntersectionObserver`).
- Budgets: desktop ≤ 16 ms a frame while dragging. Phone ≤ 33 ms a frame (30 fps) while playing, measured in Chrome DevTools with 4× CPU throttling at 390×844.
- `prefers-reduced-motion: reduce`: no auto-rotation, no autoplay, still mark in the loader and header, no view transition.
- Device pixel ratio capped at 2 for both renderers.

---

## 9. Accessibility and contrast

Measured WCAG ratios (text needs 4.5:1, graphics 3:1):

| Pair | Ratio | Use |
|---|---|---|
| `--ink` #16150F on paper #F1EEE6 | 15.8 | all light text |
| `--ink-soft` (0.62) on paper | 4.9 | disabled and tertiary only |
| `--brand` / solar #E4570E on paper | 3.2 | graphics and large text only, never small text |
| wind #1D4ED8 on paper | 5.8 | |
| hydro #0A8A76 on paper | 3.7 | graphics only |
| `--quality-warning` (light #B45309) on paper | 4.3 | stale ring (the base #f7931a is 2.0 on paper) |
| `--ink` #F2F5F9 on #05070B | 18.4 | |
| `--ink-muted` #C3CEDB on #05070B | 12.6 | |
| amber #FFB547 on #05070B | 11.5 | eyebrow, links |
| `--ink-muted` on the dock over a mid-blue glow | 10.5 | estimated: the dock at 0.74 over #3A5A80. Check against real beams |

- Focus rings: 2px solid `--ink`, offset 2px, in both modes. Never remove outlines.
- Targets: 44px on phones (mode, menu, explore, play, close).
- Every page must be legible in light. The doc pages, History charts (`history-charts.ts`) and region pages were only ever built for dark grounds; check each in both modes at 1280 and 375.

---

## 10. Suggested PRs

Each PR goes into `main` (never push to it), runs `npm run typecheck && npm test && npm run ci:gates`, updates `STATUS.md` in the same commit, and attaches screenshots at 1440×900 and 390×844 in both modes next to the matching mock. Describe the diff, not the plan (CLAUDE.md rule 1).

1. **Theme plumbing.** Fonts, `themes.css`, boot script, two-state toggle, token reads in `theme-tokens.ts`, mark tokens in the generator (loader and inline header mark), the hard-coded colour audit, loader in both modes. Layout unchanged, but every page is legible in both modes. Needs D1, D2, D3, D6. **Status: built on `feat/light-dark-theme-plumbing`, in review (see "PR 1 as built" at the top).**
2. **Light desktop.** Almanac grid, engraved globe, small-multiples timeline, rail, legend, selected label. Needs D4, D5.
3. **Dark desktop.** Horizon stage, horizon globe, ribbon, glass dock.
4. **Tablet and phone.** Both modes, the explorer, the dark bottom sheet, wrapping control rows, overflow checks.
5. **Clean-up.** Remove the sunfire / deepcurrent names and unused faces (after a grep), archive the plan with a `STATUS: SHIPPED` banner.

---

## 11. Acceptance

- [ ] Both modes at 1440×900 match `mocks/light-desktop.html` and `mocks/dark-desktop.html` in layout, type and colour, with live data in place of the snapshot.
- [ ] Both modes at 390×844 match the phone mocks above the fold; below the fold follows 3.3 and 3.4.
- [ ] Switching mode swaps layout and palette, keeps hour, selection, play state and camera longitude, and fires `themechange` once.
- [ ] First visit follows the system setting; a stored choice wins; `sunfire` / `deepcurrent` become `dark`.
- [ ] No flash of the wrong mode on load (boot script runs before `style.css`).
- [ ] `scrollWidth === clientWidth` at 320, 375 and 390 on every page (the five doc pages plus all `/region/<id>` pages), both modes.
- [ ] Quality encoding as in 6.1, in both modes, and the legend says so.
- [ ] One label at most on the globe, and it tracks its region in both axes while the globe turns.
- [ ] Frame budgets in section 8 hold; no animation loop runs while idle.
- [ ] Reduced motion honoured everywhere in section 8.
- [ ] Contrast pairs in section 9 hold; no new white literals in `style.css` outside the allowlist.
- [ ] The generated mark blocks use only `--mark-*` variables (tested); the loader and header show the mode's mark and wordmark.
- [ ] `embed/globe.md` looks exactly as before.
- [ ] `ci:gates` passes with no golden file touched; `STATUS.md` updated per PR.
