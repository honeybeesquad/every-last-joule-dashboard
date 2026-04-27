# STATUS — single source of truth for "where is the project right now"

**Last verified against git:** 2026-04-28 by Claude (post-compaction cleanup)
**Active branch:** `v0-build` @ `53ad6b1`
**Maintained by:** humans + AI sessions. **Update protocol:** any session that ships work to `v0-build`, or notices STATUS is wrong, must update this file in the same commit. Stale STATUS is worse than no STATUS.

> **For AI sessions:** read this file before drafting plans, brainstorming, or creating worktrees. Plans in `~/.claude/plans/` and `docs/superpowers/plans/` may be SHIPPED — check this file before treating any plan as live work.

---

## What's shipped on `v0-build`

**Visual system (v0.5a + v1c–v1r):**
- Sun-aligned terminator and pillar rendering in `src/globe.js`
- Reactive playback clock at `src/components/clock.js` (RAF loop, scrub, speed chips, real-time wall-clock lock)
- Scrubbable timeline at `src/components/timeline.js` (stacked-area, draggable hour marker)
- Play/pause/speed controls at `src/components/controls.js` (0.5×/1×/2×/4×/8× + Now chip)
- Mode toggle (30-day avg vs Last 24h) at `src/components/mode-toggle.js`
- Region detail tooltip at `src/components/region-tooltip.js`
- Smooth pillar tweening, two-column hotspot list, renewable-only headline + 4-fuel split
- Mobile perf: 30fps cap, RAF pause on hide, vendored topojson

**Theme system (PR #14 + #21):**
- Three dark-by-design themes via `:root[data-theme="<name>"]` blocks in `src/style.css`: **Sunfire** (default), **Vellum** (parchment-on-charcoal), **Eclipse** (cool blue-black)
- Self-hosted woff2 fonts under `src/fonts/`
- `src/lib/theme-tokens.ts` — runtime CSS-var reader (`readGlobeTokens`, `parseHexToRGB`, `sanitisePillarAlpha`)
- `src/components/theme-toggle.js` + no-FOUC boot script in `src/index.md`
- Theme-scoped `--pillar-base-alpha` for canvas pillar legibility per theme (Vellum=ee, Sunfire/Eclipse=99)
- `getFuelColor()` migration replacing hardcoded `FUEL_COLOR`
- `themechange` event re-paints canvas + open tooltips

**Data coverage:**
- 77 region loaders in `src/data/*.json.ts` covering: ENTSO-E zones (DE/ES/FR/NL/DK/FI/BE/NO/IE/PT/GR/IT/CH/CZ/PL/RO/HU/AT…), UK NESO, ERCOT (split + native), CAISO/MISO/NYISO/PJM/SPP/ISO-NE/BPA, AEMO per-state, Brazil-NE clusters, Atacama Chile, Canada (Ontario/Alberta/Quebec/Manitoba/Saskatchewan/BC), Mexico, all India zones, China provinces (Gansu/Inner-Mongolia/Ningxia/Qinghai/Tibet/Yunnan), Japan, Korea + Jeju, Taiwan, SE Asia (TH/VN/MY/ID/PH), Russia, Kazakhstan, Mongolia, Pakistan/Bangladesh, MENA (UAE/Saudi/Iran/Iraq/Israel/Jordan/Egypt/Morocco/Turkey/Cyprus), Africa Pattern-D sweep (PR #18, +26 regions), LatAm Pattern-D sweep (PR #17, +16 regions), Oman, Kenya, Ethiopia, Namibia, NZ, others.
- `src/lib/typical-profiles.ts` for the few regions with no public hourly source (Sichuan/Xinjiang/Iceland — methodology disclosed)
- `src/lib/resilient.ts::withFallback` wrapping every loader

**Brand:** product is "Wasted Energy Database"; defaults to 0.5× playback.

## What's NOT shipped (open PRs / threads)

- **PR #19** — `feat/per-fuel-region-split` — CAISO per-fuel split fixes overnight curtailment floor. Canonical pattern for per-fuel splitting; if merged, replicate to other ISOs. Open since 2026-04-27.
- **PR #16** — `feat/two-output-schema-v1` — schema(v1.0.0): optional generation fields for two-output positioning. Open since 2026-04-27.
- **PR #8** — `chore/anchor-refresh-decision` — anchor refresh decision request for ISO-NE / Greece / Portugal. Open since 2026-04-26.

## Known follow-ups (acknowledged, not blocking)

- Safari new-tab theme-persistence quirk (Bug 3 from Phase 7 — needs Tab B/C reload reproduction).
- Eclipse theme retune — Simon noted "a bit garish."
- Browser-verify PR #21 fixes (Vellum hydro/wind dot distinction + pillar legibility) on live URL.

## Plans archive

Shipped plans live in `docs/superpowers/plans/archive/`. Active plans (if any) live in `docs/superpowers/plans/`. **A plan being on disk does NOT mean it's still live work** — check this file or git log before acting on a plan you find.

## Worktree hygiene (lessons from PR #20 fiasco, 2026-04-27)

- Two parallel sessions both grabbed branch name `feat/theme-system-spec`. Resolved by closing the redundant PR and porting fixes via PR #21. **Cost:** ~1 dispatch + a round-trip of human cleanup.
- Rule: before creating any branch, run `git branch -a | grep <prefix>` and `gh pr list --state all --search <prefix>`. If a branch with similar name exists, ask the user before reusing it.
- Rule: stale worktrees are evidence to the next session that work is mid-flight. Tear them down when done — don't leave them around as breadcrumbs that mislead future Claudes.

## Active worktrees as of 2026-04-28

Run `git worktree list` to see current state. Most are dispatch worktrees from earlier phases; not all represent live work. If unsure whether a worktree is active, ask the user before touching its branch.
