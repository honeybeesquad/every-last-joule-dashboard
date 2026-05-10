# STATUS — single source of truth for "where is the project right now"

**Last verified against git:** 2026-05-10 by Claude (audit-fixes sprint shipped, tier refactor landed)
**Active branch:** `main` @ `88b4315` (Vercel production branch; auto-deploys to everylastjoule.com)
**Maintained by:** humans + AI sessions. **Update protocol:** any session that ships work to `main`, or notices STATUS is wrong, must update this file in the same commit. Stale STATUS is worse than no STATUS.

> **For AI sessions:** read this file before drafting plans, brainstorming, or creating worktrees. Plans in `~/.claude/plans/` and `docs/superpowers/plans/` may be SHIPPED — check this file before treating any plan as live work.

---

## What's shipped on `main`

**Coverage — full world:**
- 384 regions across 195 countries (every UN member + Taiwan + Palestine)
- Tally golden as of 2026-05-08: T1a=155, T1b=9, T1c=1, T2=6, T2-flare=8, T3=205
- Live at **everylastjoule.com** — Vercel auto-deploys from `main`
- Dashboard banner: **"WASTED ENERGY DATABASE · V1.2.1"**

**Tier taxonomy (refactored in PR #88, 2026-05-10):**
- `kind` (content type): wind, solar, hydro, mixed, geo, flare — orthogonal to tier
- `tier` (data quality): live, live-domestic-anchored, live-neighbour-anchored, anchored, estimated
- `sourceProvenance` (source status): verified, official-lead, modelled-fallback
- Old `tier: "static"` → `tier: "estimated"`; old `tier: "flare"` → `tier: "anchored"` with `kind: "flare"` carrying the energy-source signal.

**Discipline layer (sprint shipped 2026-05-08, PRs #69-#75):**
- **PR #69** — `sourceProvenance` enum field + CI gate scaffolding (`feat/source-status-enum`)
- **PR #70** — bad-conversions methodology checklist + baseline-metric CI stub (`feat/bad-conversions-checklist`)
- **PR #71** — CEA monthly executive summary formally rejected as a curtailment source (`docs/cea-monthly-rejection`)
- **PR #72** — provenance sweep across all 384 regions; CI gate flipped to enforce (`feat/source-provenance-sweep`)
- **PR #73** — Colombia promoted to verified via Britta XM relay (`feat/colombia-relay-refresh`)
- **PR #74** — India SLDC egress audit: 3/6 SLDCs open to any IP, 3/6 geoblocked (`docs/india-sldc-egress-audit`)
- **PR #75** — cleared two pre-existing tier-coherence failures; `ci:gates` fully green (`fix/tier-coherence-colombia-turkey`)

**Nav + USD cleanup (shipped 2026-05-09, commit e9d86a7):**
- Paper link added to dashboard nav (was missing despite page existing since PR #83)
- USD toggle hidden from dashboard UI; pricing data layer (price.ts, fx.ts) retained for future use → **layer fully deleted in PR #87 (2026-05-10)**

**Audit-fixes sprint (shipped 2026-05-10, PRs #84-#88):**
- **PR #84** — loader-wiring blockers: Belgium/Peru/SA/WA-SWIS spread fixes; runtime `assertCanonicalRegionData` now invoked at page load (catches Belgium-shape bug class loudly); strengthened integrity check verifies 24-elem profile, not just key presence; dead `ercot-native` fetch removed.
- **PR #85** — 9 Japan regional loaders wired into the dashboard (chubu, chugoku, hokkaido, hokuriku, kansai, okinawa, shikoku, tepco, tohoku — previously declared `tier: "live"` but never fetched).
- **PR #86** — pillar-base-inside-country sweep test for all 384 regions (351 pass, 32 skipped for 110m-omitted islands, 2 `it.todo` for known-bug coords).
- **PR #87** — dead code purge: build-time price/fx data layer fully removed; orphan loaders (`japan.json.ts`, `india-{north,south,west}.json.ts`), unit-toggle.js, caiso-oasis fixture, dead unit-toggle CSS rules; cosmetic sweep — region-count drift fixed across README / observablehq.config / dataset/README / about.md / tests/regions.test.ts.
- **PR #88** — tier-taxonomy refactor (described in section above) + India SLDC scaffolding (`readStateSldcCurtailment` helper + CSV ingestion path on 6 India state loaders, opportunistic, no-op until SLDC CSVs land); `build_region_docs.py` regex fixed to tolerate `sourceProvenance` field; 387 validation docs regenerated, 7 cited docs (alberta-wind + 6 India SLDC) hand-preserved.

**Visual system + theme system + brand:** as previously shipped (Sunfire/Vellum/Eclipse themes, sun-aligned terminator + pillars, scrubbable timeline, mode toggle, tooltips, mobile perf, self-hosted fonts, theme-tokens runtime reader, no-FOUC boot script, themechange repaints). Defaults to 0.5× playback.

**Paper + DOI:**
- Paper drafts ready at `docs/paper/01-06-*.md`
- v1.2.1 Zenodo DOI minted: `10.5281/zenodo.20045637`

## What's NOT shipped / open PRs

None. PRs #84-#88 all merged 2026-05-10. PR #68 (USD toggle) is fully superseded — data layer deleted in PR #87.

## Known follow-ups

**From the 2026-05-10 audit-fixes sprint:**
- **Pillar-coord bugs (2 real)** — `guinea` (-15.73, 11.75 sits in Atlantic), `guatemala-siepac` (-86.0 is in Honduras). Marked `it.todo` in `tests/pillar-country-containment.test.ts`. One-line fix per region in `regions.ts` once the right coords are decided.
- **Pillar-coord island artifacts (3)** — `japan-okinawa`, `jeju`, `vanuatu` skipped because the 110m country polygon doesn't include their islands. Either switch to higher-res topology or add per-region polygon overrides.
- **Japan upstream availability** — `japan-chubu` (DNS ENOTFOUND on `denki-yoho.chuden.jp`), `japan-tepco` (HTTP 404), `japan-hokkaido` (date-keyed CSV 404). These render via `withFallback` cached snapshots. Investigate whether endpoints have moved (Chubu DNS especially), or downgrade `tier: "live"` if permanently unreachable.
- **`build_region_docs.py` should preserve manual edits** — currently overwrites whole files on regen, blowing away author-added content like bad-conversion-checklist citations. Add `<!-- BEGIN MANUAL -->` / `<!-- END MANUAL -->` markers the regen leaves alone. The 7 hand-preserved cited docs (alberta-wind + 6 India SLDC) are evidence of this fragility.
- **End-to-end loader-output integrity test** — deferred to Phase 5 of the audit-fix plan. Needs the wiring logic factored out of `src/index.md`'s inline Observable cell into a callable `loaders.ts` module, then a test that exercises the full loader → wiring → `regionData` chain.
- **`mountGlobe` split** — 862-line single function holding rendering, projection, drag/zoom, panel, weather/price threading. Worth a refactor pass, separate brainstorming.

**Pre-existing:**
- **Issue #43** — India SLDC live parsers. Needs Mullvad (or equivalent) with a genuine India PoP before the 3 geoblocked SLDCs from PR #74 can be wired live. Note: the SLDC ingestion path now exists (PR #88), it just has no data to ingest yet.
- **Issue #44** — flare regions render as solar-yellow when the flare-gas toggle is on.
- Safari new-tab theme-persistence quirk (Bug 3 from earlier Phase 7 work — still needs Tab B/C reload reproduction).
- `dataset/README.md:83` — stale tier breakdown narrative (still references old `T1-live-TSO` / `T2-flare` 264-region totals; needs an author pass on the narrative numbers, not a numeric sub).

## Plans archive

Shipped plans live in `docs/superpowers/plans/archive/`. Active plans (if any) live in `docs/superpowers/plans/`. **A plan being on disk does NOT mean it's still live work** — check this file or git log before acting on a plan you find.

## Worktree hygiene

- Rule: before creating any branch, run `git branch -a | grep <prefix>` and `gh pr list --state all --search <prefix>`. If a branch with similar name exists, ask the user before reusing it.
- Rule: stale worktrees are evidence to the next session that work is mid-flight. Tear them down when done — don't leave them around as breadcrumbs that mislead future Claudes.
- Run `git worktree list` to see current state. Most worktrees are dispatch artefacts from earlier phases; not all represent live work. If unsure whether a worktree is active, ask the user before touching its branch.
