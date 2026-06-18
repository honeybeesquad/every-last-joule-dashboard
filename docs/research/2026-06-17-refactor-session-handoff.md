# Refactor session — hand-off (2026-06-17)

Picks up cleanly in a new session. **Read this + `STATUS.md` + `git log main -15` + `gh pr list` first** (live PR states drift from the snapshot below).

This session ran the "faster / lighter / simpler" refactor from the survey ([2026-06-17-refactor-opportunities.md](2026-06-17-refactor-opportunities.md)) and surfaced one real bug along the way.

## PR ledger (states as of session end — re-check with `gh pr list`)

| PR | What | State at hand-off |
|---|---|---|
| [#230](https://github.com/honeybeesquad/every-last-joule-dashboard/pull/230) | drop unused `react-dom` + `@types/react-dom` | **MERGED** to main |
| [#233](https://github.com/honeybeesquad/every-last-joule-dashboard/pull/233) | drop `@vercel/analytics` + `react` + `@types/react` | OPEN, green/CLEAN — **ready to merge** (Vercel build passed → analytics-via-script-tag validated) |
| [#234](https://github.com/honeybeesquad/every-last-joule-dashboard/pull/234) | extract `finalizeRegionData` + **mitigate embed crash** (non-fatal integrity check) | OPEN, `verify` green, **confirm Vercel preview** (touches `index.md`) |
| [#235](https://github.com/honeybeesquad/every-last-joule-dashboard/pull/235) | globe pure helpers → `globe-geo.ts` (globe-split Step 1/6) | OPEN, **confirm Vercel preview** (touches `globe.js`) |
| [#231](https://github.com/honeybeesquad/every-last-joule-dashboard/pull/231) | survey doc | OPEN, green |
| (this) | globe-split plan + this hand-off | docs PR |
| [#223](https://github.com/honeybeesquad/every-last-joule-dashboard/pull/223) | per-plant AEMO/Ontario (someone else's draft) | DRAFT — **bounced** with a [review comment](https://github.com/honeybeesquad/every-last-joule-dashboard/pull/223) (loader-naming build break + fix-list). Not ours to fix; left for the author. |

**Merge order suggestion:** #233 and #231 are clean now. Confirm #234's and #235's previews render, then merge. #234 before the embed fix below (it stops the crash).

## 🔴 NEXT PRIORITY — the embed-drift bug (was survey item #3 "assembly dedup")

What looked like a tidy dedup turned out to be a real bug. `src/embed/globe.md` (the da-ri.org paper-globe iframe) has **silently drifted**: its `regionData` assembly is **missing ~44 canonical renewable regions** added by #209 (WECC BAs), #211 (Italy zones), #214 (German TSO zones), #216 (Mexico), #217 (Estonia/Korea), #221 (Japan splits) — none propagated to embed. It also carries 5 dead pre-split keys (`germany-wind/solar`, `japan-hokkaido`, `japan-tohoku`, `south-korea`) and doesn't even load ~10 of the loaders index uses.

**Likely a live crash:** on `main`, embed still calls `assertCanonicalRegionData` *fatally*, and missing 44 regions makes it throw → "stuck loading". **Verify the live embed** (everylastjoule.com embed / the da-ri.org iframe) — it may currently be broken. #234 mitigates this (makes it non-fatal → renders with gaps); merging #234 is the fast fix.

**The full fix (FEASIBLE-WITH-CARE):**
1. Create `src/lib/build-region-data.ts` exporting `buildRegionData(loaders): Record<string, RegionData>` — lift `src/index.md`'s assembly **verbatim** (index is the canonical/complete one). Use a single object param (`{ercot, caiso, …}`), not 130 positional args.
2. Add the ~10 missing loaders to `embed/globe.md`'s `Promise.all` (`soco, pacw, pace, psco, azps, srp, ipco, tepc, wacm, newZealandHydro`) with `../data/…` FileAttachment paths — verify they resolve from `src/embed/`.
3. Both pages collapse to `const regionData = buildRegionData({…}); finalizeRegionData(regionData, REGIONS);`. The 5 dead keys vanish. Keep embed's `REGIONS.filter(isRenewable)` at the `mountGlobe` call (that's the right place for renewables scoping).
4. **This changes a published figure** (embed gains regions) — confirm via the PR's Vercel preview before merge. Index path is behaviour-preserving; embed path is an intended improvement.
- Verify: `Object.keys(buildRegionData(...)).sort()` equals index's current 196-key set (proves index byte-identical); embed preview shows the previously-missing pillars + no more `[uncertainty] late-binding tier` console warnings.

## 🟡 Globe split — remaining steps

Plan: [2026-06-17-globe-split-plan.md](2026-06-17-globe-split-plan.md). Step 1 shipped (#235).
- **Steps 2–3** (safe, autonomously shippable next): extract `generateDotGrid` (from `precomputeLandDots`) and the `nearestPillarUnit` geometry core (from `hitTestRegion`) into `globe-geo.ts`, unit-tested. Same low-risk pattern as Step 1.
- **Steps 4–6** (dedicated, human-reviewed session): build the headless render harness (recording fake canvas ctx, golden call-log) FIRST, then extract draw layers S1–S5, then the HIGH-risk pillar layer S6 (mutates a cross-frame birth-animation Map). Do not attempt S5–S6 without the harness.

## Other survey items (status)

- **#1/#2 lighter** — done (#230 merged, #233 ready).
- **#3 loader manifest (FileAttachment loop)** — INFEASIBLE; Observable requires literal `FileAttachment` args. The feasible part became #234 (finalize dedup) + the embed bug above.
- **#5 China/India loader dedup** — low value: already ~37 lines each, already share `buildTypical*`, and they fetch (network-verified) → high risk for little gain. Skip unless a concrete smell appears.
- **#6 globe perf / #7 test-collection** — deferred; measure first / low value.

## Housekeeping notes

- Branches opened this session: `chore/drop-unused-react-dom` (merged, can delete remote), `chore/drop-vercel-analytics-react` (#233), `fix/region-render-guard` (the working branch at session start — already merged as #225), `refactor/region-data-finalize` (#234), `refactor/globe-geo-helpers` (#235), `docs/refactor-opportunities` (#231), `docs/refactor-session-handoff` (this).
- `data/snapshots/last-good/india-odisha.json` is an untracked file present since session start — **not from this work**; left untouched.
- Memory updated: `project-world-expansion-honesty-audit` gained the 2026-06-18 coverage-for-emergence refinement (real-feed zeros are wanted via `ZERO_ALLOWLIST`; gate on feed-reality not magnitude).
