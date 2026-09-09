# Session handoff — repo sync + recovery of the 2026-05 source-elevation WIP

Date: 2026-09-09
Author: Claude (Opus 5) session, at Simon's request
Status: **read this before running any git command in this repo**

---

## TL;DR

This checkout had been sitting on a 2026-05-06 snapshot for four months. It is now synced
to `origin/main` @ `d2fa1b00`, dependencies are reinstalled, and the full gate suite is
**verified green**.

Four months of uncommitted work was found in the working tree and has been preserved as
commit `7bec8b0a` on branch `codex/global-source-elevation-sweep`. It has **not** been
triaged against current `main`. That triage is the open task.

---

## Trap 1 — git hangs under the Bash sandbox (this will bite you)

Any git command that scans the working tree — `git status`, `git checkout` — **hangs
indefinitely** in this repo when run through Claude Code's Bash tool with the sandbox on.
It does not error. It returns nothing and blocks until the tool times out.

**Empty `git status` output here means "hung", not "clean".** This session initially
concluded the tree was clean on exactly that false signal, and came close to recommending
a `reset --hard` that would have destroyed the WIP described below.

Workaround: run git with the sandbox disabled. With it off, `git status` completes in
~49s (slow, but correct). Read-only commands (`log`, `show`, `diff <tree> <tree>`,
`ls-files`, `fetch`, `merge-base`) work fine sandboxed.

Verify any "clean tree" claim before acting on it.

## Trap 2 — the old checkout's CLAUDE.md and STATUS.md were stale, and inverted

Pre-sync, this checkout carried the May CLAUDE.md, which said:

- **"Active branch: `v0-build`"** — that branch no longer exists.
- **"Never push to `main`/`master`"** — the current rule is the opposite in spirit: `main`
  *is* the production branch (Vercel, auto-deploys to everylastjoule.com); work lands as
  PRs into it.
- It was missing the whole **"Writing data PRs (tiers, regions, honesty)"** section — the
  five rules added after PR #267 shipped tier claims its diff didn't contain.

It also claimed the pre-commit hook runs `npm run lint` and `npm test`. It does not —
`.githooks/pre-commit` is a **secret scanner only** (burned keys + key-shaped patterns).

The sync fixed all of this. The CLAUDE.md and STATUS.md now in the tree are current.
STATUS.md was last verified 2026-09-06 and is accurate; this session shipped nothing to
`main`, so it needed no update.

## Trap 3 — the branch name was not a stale label

`codex/global-source-elevation-sweep` looked empty: zero unique commits, and its tip was a
strict ancestor of `origin/main`. That reads as "disposable branch."

It was not. The work was **uncommitted in the working tree** — 16 modified tracked files
and 119 untracked ones, dated 2026-05-06 to 2026-05-08.

---

## What this session did

| Step | Result |
|---|---|
| Pruned stale worktree | `~/.codex/worktrees/9ee8` removed (was flagged prunable) |
| Backed up WIP | 135 files → `elj-wip-backup-2026-09-09.tar.gz` (593K, in session scratchpad — **not durable**) |
| Committed WIP | `7bec8b0a` on `codex/global-source-elevation-sweep`, pre-commit hook passed clean, no bypass |
| Synced | `main` fast-forwarded 1,162 commits to `origin/main` @ `d2fa1b00` |
| Reinstalled deps | `npm ci` exit 0 |
| Verified baseline | typecheck ✓ · 207 test files / 1290 tests ✓ · all 9 `ci:gates` ✓ |

Nothing was pushed. `origin` is untouched.

**Verified baseline numbers:** 459 regions — T1a=160, T1b=26, T1c=1, T2=23, T3=249.
180 live-tier regions within magnitude band. 468 validation docs match `regions.ts`.

---

## The preserved WIP — what it is

Commit `7bec8b0a`. Its own closeout note
(`docs/research/2026-05-07-global-source-elevation-closeout.md`) states the intent:

> ship as an auditable source-gating package plus the first source-verified annual floor slice

It separates four things the dashboard previously let readers blend: source-verified annual
floor / measured feeds needing calendar-year aggregation / research candidates needing
denominator proof / modelled envelope and excluded rows.

**Headline claim:** 18 rows ready for source-verified annual-floor publication totalling
**9.833029 TWh** — Brazil ONS 2025 constrained-off (16 rows, 3.807811 TWh) plus Chile CEN
2025 SEN-wide wind/solar reductions (2 rows, 6.025218 TWh).

- Brazil formula: `sum(max(val_geracaoreferenciafinal - val_geracao, 0) * 0.5h)`;
  `val_geracaolimitada` deliberately excluded from the floor.
- Chile formula: plant-level hourly MWh reductions from CEN wind/solar sheets; hydro
  excluded; solar uses floor-only id `chile-sen-solar` because the source is SEN-wide,
  not Atacama-only.

Contents: release-layer manifest (401 rows) + generator, source-verified floor slice +
generator, global source-readiness audit + sorter, India closeout (Rajasthan / Karnataka /
CEA / Gujarat boundaries locked, no production change), Brazil/Chile validation notes,
Rajasthan + Karnataka curtailment extraction corpus, and `tests/research/` covering the
two generators.

Tracked-file changes: `src/data/brazil-ne.json.ts` (+28/−8), `src/data/uruguay.json.ts`,
7 Brazil test files, `dataset/SCHEMA.md` (+31), `docs/data-source-log.md`, 3 validation docs.

The May session's own worker-audit files (`2026-05-07-mmx-*.md`,
`2026-05-07-deepseek-*-output.md`) are labelled by their author as **advisory, not source
evidence**. Treat them that way.

---

## The open task: triage before reviving

`main` moved 1,162 commits while this sat. It has since reworked the exact regions the WIP
touches, and — most importantly — added a `generationBasis` honesty gate
(`measured-independent` / `derived-from-generation` / `anchor-implied`) with
`src/lib/generation-share.ts::curtailmentShare()` refusing a number for anything but
`measured-independent`.

That gate may reframe or partly subsume the WIP's layer taxonomy. It may equally validate
it. **Do not assume either — diff it.**

Specific things to check before reviving any of it:

1. `git diff main...codex/global-source-elevation-sweep -- src/data/brazil-ne.json.ts src/data/uruguay.json.ts`
   — both loaders have almost certainly changed upstream.
2. Does the WIP's four-layer taxonomy duplicate, conflict with, or usefully extend
   `generationBasis`? STATUS.md's "Curtailment share" section is the reference.
3. Are the Brazil ONS and Chile CEN annual floors still the current formulas? STATUS
   lists both as live measured-independent sources.
4. The Rajasthan/Karnataka extraction corpus is the least likely to be superseded —
   upstream shows no India state source-elevation since May.
5. Region count moved 384 → 459 since this WIP was written. Any row-count claim in the
   manifest (401 rows) is stale by construction.

Per CLAUDE.md's data-PR rules: describe the diff, not the plan; a tier is the `tier:`
field plus `tier-counts.json` plus STATUS.md, or it isn't a tier change; and never label
modelled data as measured.

---

## Housekeeping notes

- `.env` does not exist in this checkout. Loaders needing API keys (ENTSO-E, EIA) will
  fall back rather than fetch live. STATUS notes the EIA key rotation still needs a human.
- `npm ci` warns that 3 packages have install scripts not run under npm 11's `allowScripts`
  gating (esbuild ×2, fsevents). Tests and typecheck pass regardless; note it only if you
  hit a native-binary error.
- Node installed is 26.8.1; `package.json` `engines` asks for 24.x. Advisory only so far.
- One PR open upstream: **#931** `fix(honesty): stop stamping modelled-fallback regions
  live`, open since 2026-09-06.
- This file landed in PR #961 with the corpus.

---

## Outcome (2026-09-10)

The triage in `2026-09-09-wip-triage.md` was completed the next day. Result:

- **PR #960** — Brazil loader aligned to ONS's own frustrated-generation definition (GNRa), verified to
  reproduce ONS's published column to the MW; ~+4% on Brazil T1a rows; reason split (ENE/CNF/REL) in
  `sourceNote`. The WIP's loader change was **rejected** (REL-only settlement column, ~13% of curtailment).
- **PR #961** — the research corpus, with the Brazil floor **recomputed** (37.18 TWh for 2025, not 3.81;
  floor total 43.2 TWh over 18 rows), loader/test/snapshot changes dropped, India links ported inside
  MANUAL markers, docs-drift allow-list for the two annual-floor notes.
- **Open:** Rajasthan ≈6.3 TWh/yr anchor vs 0.052 TWh in official PDFs (issue drafted); Uruguay workbook
  semantics (0.2–0.4 TWh/yr research vs zero loader); structured `curtailmentReasonShare` snapshot field
  (schema bump); `brazil-rs-wind` magnitude-golden key will flap on a quiet window.
- Both PRs insert at the same point in `STATUS.md` and append to `docs/data-source-log.md`: merge one,
  rebase the other.
