# STATUS — single source of truth for "where is the project right now"

**Last verified against git:** 2026-06-07
**Active branch:** `main` (Vercel production branch; auto-deploys to everylastjoule.com)
**Maintained by:** humans + AI sessions. **Update protocol:** any session that ships work to `main`, or notices STATUS is wrong, must update this file in the same commit. Stale STATUS is worse than no STATUS.

> **For AI sessions:** read this file before drafting plans, brainstorming, or creating worktrees. Plans in `~/.claude/plans/` and `docs/superpowers/plans/` may be SHIPPED — check this file before treating any plan as live work.

---

## What's shipped on `main`

**Coverage — full world:**
- 385 regions across 195 countries (every UN member + Taiwan + Palestine)
- **Tally golden as of 2026-06-06: T1a=148, T1b=9, T1c=1, T2=6, T2-flare=8, T3=213 (total 385).** Counted directly from `src/lib/regions.ts` (tier field: live=148, live-domestic-anchored=9, live-neighbour-anchored=1, anchored=14 [8 flare + 6 flat], estimated=213). Locked by `tests/regions.test.ts`. Drift since the 2026-05-11 golden (T1a=149/T3=211/total=384): new-zealand-hydro added 2026-05-24 (T1a +1, total 384→385); serbia-solar + north-macedonia-solar reverted live→estimated 2026-06-06 (T1a −2, T3 +2). See PR #119.
- Live at **everylastjoule.com** — Vercel auto-deploys from `main`
- Dashboard banner: **"Wasted Energy Database · v1.3.2"** (pulled live from Zenodo version metadata; v1.3.2 minted 2026-06-07, version DOI `10.5281/zenodo.20570864`)

**Tier taxonomy (refactored in PR #88, 2026-05-10):**
- `kind` (content type): wind, solar, hydro, mixed, geo, flare — orthogonal to tier
- `tier` (data quality): live, live-domestic-anchored, live-neighbour-anchored, anchored, estimated
- `sourceProvenance` (source status): verified, official-lead, modelled-fallback
- Legacy static/flare tier labels are retired. `tier` now carries only data quality (`estimated` / `anchored`), while `kind: "flare"` carries the energy-source signal.

**Discipline layer (sprint shipped 2026-05-08, PRs #69-#75):**
- **PR #69** — `sourceProvenance` enum field + CI gate scaffolding (`feat/source-status-enum`)
- **PR #70** — bad-conversions methodology checklist + baseline-metric CI stub (`feat/bad-conversions-checklist`)
- **PR #71** — CEA monthly executive summary formally rejected as a curtailment source (`docs/cea-monthly-rejection`)
- **PR #72** — provenance sweep across all 384 regions; CI gate flipped to enforce (`feat/source-provenance-sweep`)
- **PR #73** — Colombia promoted to verified via Britta XM relay (`feat/colombia-relay-refresh`)
- **PR #74** — India SLDC egress audit: 3/6 SLDCs open to any IP, 3/6 geoblocked (`docs/india-sldc-egress-audit`)
- **PR #75** — cleared two pre-existing tier-coherence failures; `ci:gates` fully green (`fix/tier-coherence-colombia-turkey`)

**Nav + pricing-layer cleanup (shipped 2026-05-09, commit e9d86a7):**
- Paper link added to dashboard nav (was missing despite page existing since PR #83)
- Deprecated price-toggle UI hidden from dashboard; pricing data layer (`price.ts`, `fx.ts`) retained briefly for future use → **layer fully deleted in PR #87 (2026-05-10)**

**Audit-fixes sprint (shipped 2026-05-10, PRs #84-#88):**
- **PR #84** — loader-wiring blockers: Belgium/Peru/SA/WA-SWIS spread fixes; runtime `assertCanonicalRegionData` now invoked at page load (catches Belgium-shape bug class loudly); strengthened integrity check verifies 24-elem profile, not just key presence; dead `ercot-native` fetch removed.
- **PR #85** — 9 Japan regional loaders wired into the dashboard (chubu, chugoku, hokkaido, hokuriku, kansai, okinawa, shikoku, tepco, tohoku — previously declared `tier: "live"` but never fetched).
- **PR #86** — pillar-base-inside-country sweep test for all 384 regions (351 pass, 32 skipped for 110m-omitted islands, 2 `it.todo` for known-bug coords).
- **PR #87** — dead code purge: build-time price/fx data layer fully removed; orphan loaders (`japan.json.ts`, `india-{north,south,west}.json.ts`), unit-toggle.js, caiso-oasis fixture, dead unit-toggle CSS rules; cosmetic sweep — region-count drift fixed across README / observablehq.config / dataset/README / about.md / tests/regions.test.ts.
- **PR #88** — tier-taxonomy refactor (described in section above) + India SLDC scaffolding (`readStateSldcCurtailment` helper + CSV ingestion path on 6 India state loaders, opportunistic, no-op until SLDC CSVs land); `build_region_docs.py` regex fixed to tolerate `sourceProvenance` field; 387 validation docs regenerated, 7 cited docs (alberta-wind + 6 India SLDC) hand-preserved.

**Launch-prep sprint (shipped 2026-05-12, three commits on `main`):**
- **`fix(ui)`** — defined missing `--amber-500` CSS token so the active mode toggle button renders with its intended border and foreground colour (committee review UI-1).
- **`fix(loaders)`** — silent-zero guards for ENTSO-E (`fetchEntsoeZone` throws if every technology returns zero points) and AEMO (`parseAemoDispatchCsv` throws on missing `I,DISPATCH,UNIT_SOLUTION,` header; `run()` throws if 30 days of NEMWEB CSVs produce zero curtailment across all states). Snapshot validator gains a non-zero invariant for T1a/T1b/T1c regions with a seeded `KNOWN_ZERO_LIVE_ALLOWLIST` for 16 currently-known-legitimate zeros (committee review DATA-1, DATA-2, DATA-3).
- **`fix(hokkaido)`** — removed the dead `juyo_01` parse path (column[3] is all-renewables MW, not solar 万kW; the previous decode over-counted 10× and mis-attributed mixed fuel to solar). Loader now always returns `buildTypicalSolarRegion` against the OCCTO FY2024 anchor with a sourceNote that names the actual upstream column (committee review DATA-4).

**Audit follow-up sprint (shipped 2026-05-10, PRs #89-#92):**
- **PR #89** — corrected coordinates for `guinea` (was in Atlantic ~50km west of Guinea-Bissau, looked like a copy-paste from the adjacent row) and `guatemala-siepac` (was inside Honduras east of Tegucigalpa). Pillar test grew from 351 active + 2 todo → 353 active passing.
- **PR #90** — Japan upstream investigation: `chubu` (denki-yoho.chuden.jp dead, migrated site has no solar CSV), `tepco` (filename rename `juyo-d-j.csv` → `juyo-d1-j.csv` but new file is demand-only; viable monthly CSV exists at `eria_jukyu_YYYYMM_03.csv` with direct `太陽光出力制御量` column — non-trivial loader rewrite for future), `hokkaido` (loader was parsing all-renewables MW as solar 万kW = 10× overcount + wrong fuel attribution). All three downgraded `tier: "live"` → `"estimated"`. Tally-golden updated. Future work documented in loader JSDocs.
- **PR #91** — pillar-polygon override mechanism. Added `tests/fixtures/region-polygon-overrides.geo.json` mapping region.id → custom GeoJSON polygon. Used for `japan-okinawa`, `jeju`, `vanuatu` whose islands are excluded from countries-110m.json. Test sweep grew from 353 → 356 active passing. No regions remain in the archipelago skip-list.
- **PR #92** — `build_region_docs.py` manual-block markers. `<!-- BEGIN MANUAL --> ... <!-- END MANUAL -->` blocks survive regeneration via section-heading anchoring. 19 new tests. Demonstrated on `india-rajasthan.md` (bad-conversion citation block survives byte-identical across regen). Wraps follow-ups: 6 other cited docs not yet wrapped.

**Visual system + theme system + brand:** as previously shipped (Sunfire + Deepcurrent themes, sun-aligned terminator + pillars, scrubbable timeline, mode toggle, tooltips, mobile perf, self-hosted fonts, theme-tokens runtime reader, no-FOUC boot script, themechange repaints). Defaults to 0.5× playback.

**Paper + DOI:**
- Paper drafts ready at `docs/paper/01-06-*.md`
- v1.3.2 dataset metadata points at version DOI `10.5281/zenodo.20570864` (minted 2026-06-07) and always-latest concept DOI `10.5281/zenodo.19835411`. (v1.3.1 version DOI was `10.5281/zenodo.20136284`.)

**Brazil ONS curtailment fix (shipped 2026-05-17, commit eabf8e5):**
- `val_geracaolimitada` was being summed as the curtailment amount; it is the generation *cap* (what ONS allowed the plant to generate). Correct formula is `max(0, val_geracaoreferencia − val_geracaolimitada)`. Rows with empty `val_geracaolimitada` are unconstrained and now skipped.
- Effect: states with many fully-curtailed events (Maranhão, Ceará) were undercounted; states with large partial caps (Piauí 5×, RN/BA/PB/PE ~2×) were overcounted. Snapshot regenerated from live ONS data.
- Audited all other loaders: no other loader has this class of bug (AEMO uses `unconstrained−cleared`; EirGrid/Chile/Colombia use direct curtailment columns; all others use calibrated `generation × rate`).

**Loader-resilience sprint (shipped 2026-06-06, PR #119):**
Diagnosed from persistent Vercel build-log errors (all builds since ~2026-05-13 silently falling back to stale snapshots).
- **Norway NO5 hydro** — `fetchHydroSeries()` now queries both B11 (Water Reservoir) and B12 (Run-of-river) and merges. ENTSO-E reclassified NO5 Bergen/West reservoir hydro from B12; the B12-only query had returned zero for ~6 weeks. NO5 live again.
- **NYISO solar all-zeros** — EIA's NYIS SUN feed returns rows but all-zero values (upstream data-gap, ~24 days). `buildEiaIsoRegionPerFuel.run()` now detects this and keeps wind fresh while synthesising solar from the wind profile × fallbackSplit (`synthesizeSolarFromWind`), instead of degrading both fuels to a stale snapshot.
- **`sourceStatus` accuracy** — `stampLive()` (resilient.ts) now preserves `cached`/`degraded` status set by per-zone internal fallbacks; ENTSO-E + Norway per-zone catch blocks stamp staleness-aware status. Stale sub-regions no longer masquerade as `live`.
- **serbia-solar + north-macedonia-solar reverted live→estimated** — ENTSO-E A75 B16 feed ceased ~2026-05-13. Root cause is structural, not transient: EMS Serbia and MEPSO North Macedonia are non-EU **Energy Community** TSOs; EU Reg 543/2013 does not bind them (EnC Secretariat IR 2023 flagged NMK transparency "well below required levels", 543/2013 not transposed). Both removed from `entsoe.json.ts` ZONES; re-anchored to IRENA RCS 2025 in `statics.json.ts` (Serbia 0.007 TWh/yr; NMK 0.02 TWh/yr — flagged underestimate given NMK 833 MW→1.2 GW growth). `regions.ts` tier→estimated, provenance→modelled-fallback. Validation docs rewritten. (serbia-wind / north-macedonia-wind stay live — B19 reporting is compliant.)

**Paper v1.3.2 numbers refresh (shipped 2026-06-06, PR #109):**
- Every numeric claim in `src/paper.md` + `docs/dari/paper.html` re-derived against current snapshots after the Brazil ONS formula fix (eabf8e5). Six claims drifted >5%: total verified waste 338.8→**293.7 TWh**, T1 curtailed renewables 184.5→**138.9 TWh** (−25%, Brazil-driven), wasted/Bitcoin 171%→**149%**, curtailed-alone/Bitcoin 93.4%→**70%**, foregone revenue $16.2B→**$14.3B**, priced regions 186→**118 verified**.
- §3 reframed (editorial Option B): leads with flare-dominant verified total (293.7 TWh = 149% of Bitcoin); 53% flare / 47% curtailed renewables. Bitcoin denominator kept at WooCharts 197.6 per paper's stated anchor.
- **Version skew resolved (2026-06-07):** v1.3.2 minted to Zenodo (version DOI `10.5281/zenodo.20570864`) via PR #121 + GitHub release `v1.3.2`. All metadata (`package.json`, `CITATION.cff`, `.zenodo.json`, `README`s, `FAIR.md`, CHANGELOG) now consistent at v1.3.2 / 385 regions. Paper cites the always-latest concept DOI, which now resolves to v1.3.2.

## What's NOT shipped / open PRs

**None open.** Everything from the 2026-06-06/07 session is merged or closed:
- **#119** loader-resilience (Norway NO5 B11+B12, NYISO solar-gap, sourceStatus, serbia/nmk demotion) — merged.
- **#109** paper v1.3.2 numbers refresh — merged.
- **#120** STATUS refresh — merged.
- **#108** claim-cascade Figure 1 — merged (SVG regenerated to v1.3.2 numbers / 385 regions before merge).
- **#121** v1.3.2 version bump + CHANGELOG — merged; tag `v1.3.2` + GitHub release published → Zenodo minted version DOI `10.5281/zenodo.20570864` (2026-06-07).
- **#105** Vercel-bot analytics draft — closed (redundant; analytics already on main via dynamic-inject, commits 36a602e / 7dcf2e8 / 6ce4c7e).

Also cleaned this session: 16 merged remote branches + 4 session branches deleted; 3 snapshot-only stashes dropped (6 source-bearing stashes left for review). PR #68 remains superseded (pricing layer deleted in PR #87).

## Known follow-ups

**Closed by the 2026-05-10 follow-up sprint:**
- ✅ Pillar-coord bugs (guinea, guatemala-siepac) — PR #89
- ✅ Island-polygon artifacts (japan-okinawa, jeju, vanuatu) — PR #91 (override polygons)
- ✅ Japan upstream availability — PR #90 (3 tier downgrades + investigation)
- ✅ `build_region_docs.py` manual-block markers — PR #92

**Still outstanding:**
- **Recalibrate north-macedonia-solar anchor** — current 0.02 TWh/yr static (IRENA RCS 2025, 833 MW end-2024 basis) is a known underestimate; NMK hit ~1.2 GW by end-2025 with solar already moving power-exchange prices. Revisit if a machine-readable MEPSO/exchange curtailment source appears. (serbia-solar 0.007 TWh/yr is fine — curtailment genuinely negligible at 241–318 MW per USEA 2022.)
- **6 source-bearing stashes** left undropped (`stash@{0}`–`{5}`: WIP on main eia-iso/turkey, dead-code-purge, japan-regional-wiring, india-sldc-t1a, dari-research-bundle, paper-post-council-edits). Review and drop/apply when convenient.
- **Wrap the other 6 cited docs in manual-block markers** — `alberta-wind.md` and `india-{andhra-pradesh,gujarat,karnataka,maharashtra,tamil-nadu}.md`. PR #92 demonstrated the mechanism on `india-rajasthan.md` only. Mechanical sweep, ~10 minutes of work.
- **End-to-end loader-output integrity test** — deferred to Phase 5 of the audit-fix plan. Needs the wiring logic factored out of `src/index.md`'s inline Observable cell into a callable `loaders.ts` module, then a test that exercises the full loader → wiring → `regionData` chain.
- **`mountGlobe` split** — 862-line single function holding rendering, projection, drag/zoom, panel, weather/price threading. Worth a refactor pass, separate brainstorming.
- **TEPCO monthly CSV migration** (loader rewrite) — would restore TEPCO from `tier: "estimated"` to `T1a-live-tso`. The viable file `eria_jukyu_YYYYMM_03.csv` has a direct `太陽光出力制御量` (solar curtailment) column — better data quality than the abandoned 5-min path. YYYYMM URL scheme + 30-min intervals + multi-column parse needed.

**Closed by the 2026-05-12 launch-prep sprint:**
- ✅ **Issue #44** — flare regions render as solar-yellow when the flare-gas toggle is on. Verified fixed in `src/lib/fuel.ts::getRegionFuelColor` (the `region.kind === "flare"` short-circuit returns the flare token before the `dominantFuel` fall-through can paint it yellow).
- ✅ Stale "Sunfire/Vellum/Eclipse" theme references in `src/lib/fuel.ts` and `src/lib/theme-tokens.ts` corrected — shipped themes are Sunfire and Deepcurrent. (Vellum and Eclipse were never shipped.)
- ✅ Duplicate `iso-ne` / `nyiso` entries removed from `KNOWN_AGGREGATE_IDS` in `scripts/ci/check-tier-coherence.ts`.

**Pre-existing:**
- **Issue #43** — India SLDC live parsers. Needs Mullvad (or equivalent) with a genuine India PoP before the 3 geoblocked SLDCs from PR #74 can be wired live. Note: the SLDC ingestion path now exists (PR #88), it just has no data to ingest yet.
- Safari new-tab theme-persistence quirk (Bug 3 from earlier Phase 7 work — still needs Tab B/C reload reproduction).

## Plans archive

Shipped plans live in `docs/superpowers/plans/archive/`. Active plans (if any) live in `docs/superpowers/plans/`. **A plan being on disk does NOT mean it's still live work** — check this file or git log before acting on a plan you find.

## Worktree hygiene

- Rule: before creating any branch, run `git branch -a | grep <prefix>` and `gh pr list --state all --search <prefix>`. If a branch with similar name exists, ask the user before reusing it.
- Rule: stale worktrees are evidence to the next session that work is mid-flight. Tear them down when done — don't leave them around as breadcrumbs that mislead future Claudes.
- Run `git worktree list` to see current state. Most worktrees are dispatch artefacts from earlier phases; not all represent live work. If unsure whether a worktree is active, ask the user before touching its branch.
