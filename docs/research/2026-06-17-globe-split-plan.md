# Globe split — refactor plan (`src/globe.js`)

**Date:** 2026-06-17
**Status:** PLAN / scoping — not started. Captures the safe sequencing for decomposing the 747-line `mountGlobe` closure (its inner `render()` is ~390 lines). STATUS.md flagged this as wanting "separate brainstorming"; this is it.
**Hard constraint:** the rendered canvas output must not change. Every step is either a pure-helper lift (unit-testable, zero call-site behaviour change) or a mechanical extract-function preserving identical execution order and the same reads/writes of closure state.
**Risk context:** two globe-crash hotfixes shipped this week (#224/#225); globe.js has **no tests**; the only integration check is a full `observable build` (~132 live loaders). So safe slices ship first; the risky draw split waits behind a regression net.

## Structure (key seams in `render()`, 198–512)

| Seam | Lines | Risk | Why |
|---|---|---|---|
| S1 sphere base fill | 226–229 | LOW | pure draw from `ctx, path, token` |
| S2 day radial gradient | 231–247 | LOW | pure, guarded by `if (sunScreen)` |
| S3 night overlay (+CSS linear-gradient branch) | 249–269 | LOW | pure-ish; recomputes w/h from canvas |
| S4 land dots | 271–283 | LOW–MED | pure but hot loop; per-dot `fillRect` geometry must not regress |
| S5 graticule / borders | 285–298 | LOW | pure draw |
| S6 pillars + birth animation | 300–508 | **HIGH** | ~208 lines; reads lots of `state`; **mutates `pillarBirthTimes` Map across the loop** + prunes via `visibleThisFrame` |

Densely-shared closure state (the constraint): the `state` bag (rotation mutated in place), `tokens` (reassigned on `themechange` — must be passed by value at call time), `pillarBirthTimes` (cross-frame, mutated mid-draw), and the pointer/gesture + rAF-loop state (left untouched — no clean seam).

## Pure helpers — safe wins (extract to `src/lib/globe-geo.ts`, unit-test now)

- `wrapLongitude` (745–747) — truly pure.
- `easeOutCubic` (120–122) — truly pure.
- `generateDotGrid()` — the arithmetic grid inside `precomputeLandDots` (27–33); leave the `d3.geoContains` filter + module cache in globe.js.
- `nearestPillarUnit(...)` — the pure geometry core of `hitTestRegion` (144–163); keep the rect/projection shell in globe.js.

These touch no closure state except via arguments, so they lift with byte-identical bodies and get direct vitest coverage (template: `tests/pillar-layout.test.ts`). Convention confirmed: author as `.ts`, import via `./lib/globe-geo.js`.

## Regression net (required before any draw-layer split)

A headless render harness (template: `tests/theme-toggle.test.ts`, which already does DOM-in-vitest via jsdom):
- a **recording fake `CanvasRenderingContext2D`** (Proxy logging every method call + property set),
- stub `getBoundingClientRect`/`devicePixelRatio`/`matchMedia`/`getComputedStyle` (token defaults from `theme-tokens.ts`), frozen `utcHour`/Date and a tiny fixed regions fixture,
- capture the **golden call-log** from the current `render()`, then assert byte-identical after each extraction.

This is the canvas analogue of a pixel snapshot, deterministic and CI-friendly (real d3 projection runs in Node). It must be committed (capturing the pre-refactor golden) before S1–S6 move.

## Sequenced steps (lowest → highest risk)

1. **Extract `wrapLongitude` + `easeOutCubic`** → `globe-geo.ts` + `tests/globe-geo.test.ts` (pinned values). No infra cost. *(ships this week)*
2. **Extract `generateDotGrid`** from `precomputeLandDots`; unit-test grid count/endpoints.
3. **Extract `nearestPillarUnit`** geometry core from `hitTestRegion`; unit-test with a fake projection (offset handling, hemisphere cull, threshold boundary, single-vs-array return).
4. **Build the headless render harness**; commit the golden call-log. *(test-only, no globe.js change)*
5. **Extract pure draw layers** S1, S2, S3, S5, then S4 — one per commit, re-validate the golden each time. Optionally relocate to `globe-layers.ts`.
6. **Extract the pillar layer S6** — last, smallest slices: (a) per-unit GW + visibility compute; (b) the draw, passing `pillarBirthTimes` as an explicit mutable arg; (c) leave the cross-frame birth bookkeeping in `render()`. Validate each against the golden; finish with a preview screenshot + full build.

**Out of scope (leave entangled):** the pointer/pinch/wheel state machine and the rAF/visibility loop — dense shared mutable state, not covered by the harness, no clean low-risk seam. Separate, higher-risk project for later.

## Recommendation

Steps 1–3 are safe to ship immediately (pure helpers, unit-tested, near-zero risk) and are a good autonomous slice. Steps 4–6 should be a dedicated, human-reviewed session — that's where behaviour-preservation actually has to be proven.
