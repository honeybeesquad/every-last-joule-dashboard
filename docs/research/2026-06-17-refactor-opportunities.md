# Refactor opportunities — faster, lighter, simpler

**Date:** 2026-06-17
**Status:** EXPLORATION ONLY — no code changed. This is a survey of candidate refactors with measurements, effort/risk/payoff ratings, and downsides. Nothing here is approved work.
**Scope of request:** "Refactor the code to be faster, lighter and simpler if possible. Explore the potential improvements, and downsides."

---

## TL;DR

The codebase is healthy and heavily gated. There is no single big win; there is a set of small, mostly-independent ones with very different risk profiles. The honest ranking:

| # | Opportunity | Axis | Effort | Risk | Payoff | Verdict |
|---|-------------|------|--------|------|--------|---------|
| 1 | Drop unused `react-dom` (+`@types/react-dom`) | Lighter | XS | **Low** | 4.4 MB install, smaller supply-chain surface | **Do first** |
| 2 | Drop `@vercel/analytics` + `react` + types (if analytics confirmed script-tag-only) | Lighter | S | Low–Med | removes the last React from the tree | Do, after a build+prod check |
| 3 | Extract the 136-loader wiring into a typed `loaders.ts` manifest | Simpler | M | Med | dedupes `index.md` **and** `embed/globe.md` (122 dupes), unblocks a deferred E2E test | High-value, behavior-preserving |
| 4 | Split `mountGlobe`/`render()` in `globe.js` (~390-line function) | Simpler | L | **High (today)** | biggest maintainability gain | Defer — globe is fragile this week |
| 5 | Collapse 35 near-identical China/India loaders into a generator | Simpler/Lighter | M | Med | ~35 files → data table; less drift surface | Worth it; touches gated data |
| 6 | Globe render-loop perf pass | Faster | M–L | High | unproven gain | Measure before touching |
| 7 | Test-suite collection overhead (30 s collect vs 14 s run) | Faster | S | Low | dev-loop nicety only | Low priority |

**Recommended path if/when work is greenlit:** 1 → 2 → 3 → (5) and explicitly *defer* 4 and 6 until the globe has stabilised and a visual-regression harness exists.

---

## Context & constraints

- **Stack:** Observable Framework static-site generator; TypeScript + D3 + topojson-client; vitest. Deployed on Vercel, **auto-deploys from `main`** to everylastjoule.com.
- **Shape:** ~132 data loaders in `src/data/*.json.ts` (run at build time, fetch live grid-operator data with snapshot fallback via `src/lib/resilient.ts::withFallback`), 440 regions registered in `src/lib/regions.ts`, rendered by a canvas globe in `src/globe.js`.
- **Gates (CI + pre-commit):** `ci:tier-coherence`, `ci:source-provenance-coherence`, `ci:tally-golden`, `ci:magnitude-golden`, `ci:docs-drift`, `ci:bad-conversions-stub`, plus 955 vitest tests and `tsc`. Any change touching regions/loaders risks golden-file churn across these.
- **Timing hazard:** two globe-crash hotfixes shipped **today** ([#224](https://github.com/honeybeesquad/every-last-joule-dashboard/pull/224) integrity-check-nonfatal, [#225](https://github.com/honeybeesquad/every-last-joule-dashboard/pull/225) `regionGWAtHour` guard). The render path is actively fragile.
- **In-flight work:** several open/draft branches and worktrees (`fix/japan-area-window-hardening` #222 open, `feat/expansion-per-plant-splits` #223 draft, `codex/remove-flare-gas`, `codex/dynamic-loader-registry`). The `codex/dynamic-loader-registry` worktree has **no commits ahead of `main`** (a breadcrumb, not live divergence) — but its name implies someone intended a loader-registry refactor, which overlaps directly with opportunity #3. **Confirm with the owner before starting #3.**

## Methodology

All numbers below are measured, not estimated:
- LOC / file sizes: `wc`, `find`, `du`.
- Dependency graph: `npm ls`, `du node_modules/<pkg>`.
- Usage: `grep` for import sites across `src/` (excluding the framework's `.observablehq` cache).
- Tests: `npm test` wall-clock.
- Built payload: `du` over `dist/`.
- **Not run:** a full `observable build`. It clears the cache (`prebuild`) and fires ~132 live requests at real grid-operator APIs; firing that volume of outbound traffic was not justified for an exploration. Build-time claims below are therefore flagged as "needs a profiled build."

---

## Findings

### 🟢 Lighter

**1 & 2 — Unused React tree.** `package.json` declares `react`, `react-dom`, `@types/react`, `@types/react-dom`. Findings:
- **Zero** `import` sites for react/react-dom/JSX anywhere in `src/` (no `.tsx`/`.jsx` files; no react in any `.md` code fence). The only matches are inside `node_modules/@observablehq/framework/dist` — the framework's *resolver list* of libraries it can serve on demand, not an actual dependency.
- `npm ls`: `react-dom` is **root-only** — nothing depends on it. `react` is *also* pulled by `@vercel/analytics` (deduped).
- `@vercel/analytics` itself has **zero import sites**: analytics is injected by a raw `<script src="/_vercel/insights/script.js">` tag in `observablehq.config.ts`, not via the package's `inject()`/`<Analytics/>` API.

Implication:
- **`react-dom` (4.4 MB) + `@types/react-dom` are unambiguously removable** — nothing imports or transitively needs them.
- **`@vercel/analytics` + `react` + `@types/react`** are removable *if* the script-tag injection is the only analytics path (it appears to be). Verification: remove, `observable build`, deploy a preview, confirm `/_vercel/insights/script.js` still loads and events register.
- Weight context: `node_modules` is 133 MB total; react-dom is 4.4 MB of it. The real prize is supply-chain/maintenance surface and honesty of the dependency list, not disk.

**Browser payload** is already lean: `dist/` is 5.7 MB; the largest shipped JSON are `statics.json` (116 KB), `countries-110m.json` (108 KB), `entsoe.json` (60 KB). No urgent lever here. (`countries-110m` could be simplified further with `topojson` quantization if map fidelity allows, but the gain is ~tens of KB — not worth the fidelity risk.)

### 🟡 Simpler

**3 — Loader-wiring manifest.** `src/index.md` hand-lists **136** `trackFile(FileAttachment("data/X.json").json(), "Label")` calls in one `Promise.all`. `src/embed/globe.md` independently re-lists **122** of them. That's two parallel hand-maintained lists that drift apart (index has 136, embed 122). STATUS.md already flags extracting this into a `loaders.ts` manifest, and notes it unblocks a deferred end-to-end loader-output integrity test. A single exported `LOADER_MANIFEST: {file, label}[]` consumed by both pages removes the duplication and makes the E2E test possible. Behavior-preserving (same files fetched), but it touches the dashboard's data entry point, so it needs the full test + a preview smoke-check. **Overlaps with the `codex/dynamic-loader-registry` intent — coordinate first.**

**4 — `mountGlobe` / `render()` split.** `src/globe.js` is 747 lines; `mountGlobe` (line 43) holds nearly all of it, and the inner `render()` (lines 198–591) is a **~390-line function** that interleaves: projection setup, sphere + atmosphere radial gradient, night-overlay (including re-implementing CSS `linear-gradient()` on canvas because canvas can't consume it as a fillStyle), land-dot field, graticule, and pillar units with birth animation — with pointer/drag/wheel/zoom handlers and the rAF loop below it. Clear single-responsibility violations; the natural seams are `drawSphere`, `drawNight`, `drawDots`, `drawGraticule`, `drawPillars`, plus an `interaction` module and a `loop` module. **Highest maintainability payoff, highest risk right now:** two crash hotfixes landed today, and there is no visual-regression harness to prove a pure-refactor preserves the exact rendered output. STATUS.md itself says this deserves "separate brainstorming." Defer until (a) the globe stabilises and (b) a pixel/snapshot regression net exists.

**5 — Near-identical loaders.** `src/data/` has 132 `.json.ts` loaders; **22 are `china-*` provinces and 13 are `india-*` states** — 35 files following near-identical per-region shapes (anchor + typical-profile + tier). These could collapse into a single generator driven by a small data table (per-region: id, anchor TWh, coords, fuel split), cutting ~35 files to one module + one table. Reduces drift surface and is partly a "lighter" win (less code). But it touches gated data and the per-region validation tests/docs, so golden churn is real — sequence it carefully behind the no-code-churn cosmetic sweep STATUS.md already has pending.

**Other:** `region-tooltip.js` (428 lines) is large but cohesive; low priority. `regions.ts` (611 lines / 157 KB, longest line 730 chars) is a dense registry — big but appropriately a data file; not a refactor target.

### 🔴 Faster

**6 — Globe render loop.** The real per-frame cost is `render()`. It rebuilds the projection and redraws every layer each frame. Plausible wins (cache the projection when the view is static, pre-rasterise the land-dot field, skip off-globe pillars earlier) — but these are *entangled with #4* and unproven without profiling. **Measure first** (Chrome perf trace of a drag/spin) before claiming anything.

**7 — Build & test time.**
- **Tests:** 955 tests / 180 files / **13.8 s** wall. Healthy. The notable figure is *collection* (30.3 s of transform/import vs 13.8 s of actual test execution) — 180 small files each paying tsx-transform startup. Consolidating per-region tests into table-driven suites would cut collection, but this is a dev-loop nicety, not a user-facing win. Low priority.
- **Build:** dominated by ~132 network-bound loaders, not CPU. Can't be safely sped up without risking data freshness. Needs a profiled build to confirm where the time actually goes; not a promising lever.

---

## Cross-cutting downsides & risks

1. **Production blast radius.** `main` auto-deploys. Every merged change is live immediately. A "pure refactor" that subtly changes globe output or loader behavior ships to users before anyone notices.
2. **No behavior-preservation net for the globe.** The highest-value simplification (#4/#6) is precisely the one with no automated way to prove the render is byte-for-byte unchanged. Refactoring it on faith, the same week it crashed twice, is the worst risk/reward in the set.
3. **Golden-file gates amplify small data/loader edits.** #3 and #5 can trip `tally-golden`, `magnitude-golden`, `docs-drift`, `tier-coherence`. Each needs the 5-file tier checklist + `--update` re-baseline (which is the review trail), so the *churn* cost is higher than the code change suggests.
4. **In-flight collision.** Loader-registry refactor (#3) overlaps a named-but-empty worktree intent; the flare/per-plant/Japan branches are touching loaders and regions concurrently. Refactors that move files will conflict with that work. Coordinate and sequence; don't refactor under someone else's open PR.
5. **Framework constraints.** Observable Framework `.md` pages are reactive notebooks, not free-form modules — what can be extracted to plain `.ts` and what must stay an inline cell is constrained. The loader manifest works because it's pure data; logic-heavy extractions may not move as cleanly.
6. **"Refactor" is unbounded.** The request spans three axes over a 100+ file codebase. Without a scoped target, effort sprawls. This doc exists to bound it.

## Recommended sequencing (when greenlit)

1. **#1 first** — drop `react-dom` + `@types/react-dom`. One commit, one build to verify, trivially reversible. Proves the "lighter" claim with zero risk.
2. **#2** — remove `@vercel/analytics` + `react` + `@types/react` after a preview deploy confirms analytics still fires from the script tag.
3. **#3** — loader manifest, *after* confirming no one is mid-flight on `codex/dynamic-loader-registry`. Ship behind full tests + preview smoke-check.
4. **#5** — China/India loader generator, sequenced behind the pending cosmetic count sweep to share the golden re-baseline.
5. **Defer #4 and #6** until the globe has a quiet week and a visual-regression harness exists. Revisit as their own brainstorming, as STATUS.md already prescribes.

## Open questions / not verified

- Does removing `@vercel/analytics` break anything subtle (it's possible something I didn't grep loads it indirectly)? Needs the build+preview check.
- Actual build-time breakdown — unmeasured (deliberately didn't fire 132 live requests).
- Globe render cost — asserted from code reading, not a profiler trace.
- Whether `countries-110m.json` can be quantized without visible map degradation — untested.

## Appendix — raw measurements

```
globe.js              747 lines; mountGlobe @43; render() lines 198–591 (~390)
index.md              843 lines; 136 FileAttachment loaders
embed/globe.md        607 lines; 122 FileAttachment loaders; 8 imports
regions.ts            611 lines / 156,995 bytes / longest line 730 chars
region-tooltip.js     428 lines
src/data/*.json.ts    132 loaders (22 china-*, 13 india-*)
tests                 955 tests / 180 files / 13.8s wall (collect 30.3s, run 13.8s)
dist/                 5.7 MB; statics 116K, countries-110m 108K, entsoe 60K
node_modules          133 MB; react 368K, react-dom 4.4M, @types/react 464K, @types/react-dom 60K
react import sites    0 in src/ (only @observablehq/framework resolver list)
@vercel/analytics     0 import sites; injected via raw <script> in observablehq.config.ts
CI gates              tier-coherence, source-provenance-coherence, tally-golden,
                      magnitude-golden, docs-drift, bad-conversions-stub
```
