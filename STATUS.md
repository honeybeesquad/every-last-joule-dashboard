# STATUS — single source of truth for "where is the project right now"

**Last verified against git:** 2026-04-29 by Codex (split-region stabilization + data-quality backlog)
**Active branch:** `research/phase1-data-audit` @ `9038141` (dirty worktree; contains PR #19 split-region cleanup plus data-quality guardrails)
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
- 94 live region entries (T1a) + 4 live-domestic-anchored (T1b) + 1 live-neighbour-anchored (T1c) + 4 flare regions + 97 static entries in `src/lib/regions.ts` (200 canonical entries)
- `src/data/statics.json.ts` emits 56 canonical static/flare records by default; `buildAllStatics({ includeCandidates: true })` exposes the 68 non-canonical bulk-coverage candidates for research only
- Tally buckets as of 2026-04-29: T1a=94, T1b=4, T1c=1, T2=2, T2-flare=4, T3=95
- Full ENTSO-E zone fetch: DE/ES/FR/NL/DK/FI/BE/NO/IE/PT/GR/IT/CH/CZ/PL/RO/HU/AT (15 zones; croatia/slovakia/slovenia/latvia/lithuania/albania REMOVED from live fetch 2026-04-28 — no verifiable A75 published rate found; returned to T3 static pending actual calibration data)
- `src/lib/typical-profiles.ts` for the few regions with no public hourly source (Sichuan/Xinjiang/Iceland — methodology disclosed)
- `src/lib/resilient.ts::withFallback` wrapping every loader

**Brand:** product is "Wasted Energy Database"; defaults to 0.5× playback.

## What's NOT shipped (open PRs / threads)

- **PR #19 / research branch cleanup** — per-fuel splits: wa-swis-solar/wind, south-africa-solar/wind, peru-hydro/solar/wind. Parent rows/docs/snapshots have been removed or normalized. Canonical total is now 174 because the stale Peru parent was dropped. ENTSO-E elevation attempt for croatia/slovakia/slovenia/latvia/lithuania/albania REVERTED (2026-04-28): no verifiable A75 published rate found; returned to T3/static-candidate handling pending actual calibration data.
- **Data-quality elevation backlog** — `docs/research/2026-04-29-data-quality-elevation-backlog.md` is the current launch queue. Strict rule: no T3→T2 promotion without an explicit annual curtailed-energy citation; no profile-kind-only upgrades.
- **Chile Wind source elevation** — `chile-wind` promoted T3→T1a on 2026-04-29 by parsing CEN monthly XLSX wind reductions (`Resumen-DiarioHorario-Eolico` / `PE-` plant rows), reusing the Atacama CEN workbook machinery via `src/data/chile-cen-reductions.ts`.
- **Uruguay source elevation** — `uruguay` promoted T3→T1a on 2026-04-29 by parsing ADME's hourly `Restricciones Operativas` workbook (`ro_excel.php`), with renewable plant matching from `info_consignas.php`; 2024 direct workbook sum is ~0.108 TWh, not the old ~0.4-0.5 TWh modelled assumption.
- **Malaysia / Dominican Republic / Taiwan held at T3 after source audit** — attempted live promotions were reverted on 2026-04-29 because the public endpoints do not satisfy the tier rules: Malaysia GSO exposes current-day solar generation arrays, Dominican Republic OC exposes scheduled/actual total generation, and Taiwan TAIPOWER exposes current unit output/instantaneous percentages rather than a 30-day public curtailment archive or citable annual curtailed-energy rate. Keep these as upgrade candidates only if a real curtailment source is found.
- **Florida source audit** — `florida` added as T3 static on 2026-04-29. EIA FLA solar generation exists, but no public hourly curtailment feed or citable curtailed-energy annual anchor was verified; held as a provisional solar-shaped estimate pending better evidence.
- **Brazil regionalization** — `brazil-paraiba` and `brazil-maranhao` added as explicit T1a ONS state-code rows on 2026-04-29 after the April 2026 constrained-off CSV sample showed both were hidden in the old `brazil-other` residual bucket.
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
