# STATUS — single source of truth for "where is the project right now"

**Last verified against git:** 2026-05-09 by Claude (nav + USD toggle cleanup shipped)
**Active branch:** `main` @ `e9d86a7` (Vercel production branch; auto-deploys to everylastjoule.com)
**Maintained by:** humans + AI sessions. **Update protocol:** any session that ships work to `main`, or notices STATUS is wrong, must update this file in the same commit. Stale STATUS is worse than no STATUS.

> **For AI sessions:** read this file before drafting plans, brainstorming, or creating worktrees. Plans in `~/.claude/plans/` and `docs/superpowers/plans/` may be SHIPPED — check this file before treating any plan as live work.

---

## What's shipped on `main`

**Coverage — full world:**
- 384 regions across 195 countries (every UN member + Taiwan + Palestine)
- Tally golden as of 2026-05-08: T1a=155, T1b=9, T1c=1, T2=6, T2-flare=8, T3=205
- Live at **everylastjoule.com** — Vercel auto-deploys from `main`
- Dashboard banner: **"WASTED ENERGY DATABASE · V1.2.1"**

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
- USD toggle hidden from dashboard UI; pricing data layer (price.ts, fx.ts) retained for future use

**Visual system + theme system + brand:** as previously shipped (Sunfire/Vellum/Eclipse themes, sun-aligned terminator + pillars, scrubbable timeline, mode toggle, tooltips, mobile perf, self-hosted fonts, theme-tokens runtime reader, no-FOUC boot script, themechange repaints). Defaults to 0.5× playback.

**Paper + DOI:**
- Paper drafts ready at `docs/paper/01-06-*.md`
- v1.2.1 Zenodo DOI minted: `10.5281/zenodo.20045637`

## What's NOT shipped / open PRs

None. PR #68 (USD toggle) superseded by e9d86a7 — toggle hidden, data layer retained.

## Known follow-ups

- **Issue #43** — India SLDC live parsers. Needs Mullvad (or equivalent) with a genuine India PoP before the 3 geoblocked SLDCs from PR #74 can be wired live.
- **Issue #44** — flare regions render as solar-yellow when the flare-gas toggle is on.
- Safari new-tab theme-persistence quirk (Bug 3 from earlier Phase 7 work — still needs Tab B/C reload reproduction).

## Plans archive

Shipped plans live in `docs/superpowers/plans/archive/`. Active plans (if any) live in `docs/superpowers/plans/`. **A plan being on disk does NOT mean it's still live work** — check this file or git log before acting on a plan you find.

## Worktree hygiene

- Rule: before creating any branch, run `git branch -a | grep <prefix>` and `gh pr list --state all --search <prefix>`. If a branch with similar name exists, ask the user before reusing it.
- Rule: stale worktrees are evidence to the next session that work is mid-flight. Tear them down when done — don't leave them around as breadcrumbs that mislead future Claudes.
- Run `git worktree list` to see current state. Most worktrees are dispatch artefacts from earlier phases; not all represent live work. If unsure whether a worktree is active, ask the user before touching its branch.
