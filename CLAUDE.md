# CLAUDE.md — operating rules for AI sessions on this repo

## Read STATUS.md first

`STATUS.md` at repo root is the single source of truth for what's shipped, what's in flight, and what's still open. Plan files in `~/.claude/plans/` and `docs/superpowers/plans/` may be SHIPPED — they are working memory, not state of record. **Always check STATUS.md (and `git log main -15`) before treating any plan, slash-command argument, or compaction summary as live work.**

## Verify-before-drafting rule (mandatory after compaction)

If this conversation has been through a compaction (summary at the top), or if the work appears to span more than one session, the first action of any non-trivial task MUST be a state check, not a draft:

```bash
git log --oneline main -20
ls src/components/ src/data/ src/lib/
gh pr list --state all --limit 10
cat STATUS.md
```

Compare what you see against the assumptions in the conversation summary or any plan you've been pointed at. If they disagree, **stop and report to the user** before writing code, drafting plans, or creating branches. Compaction summaries are unreliable; the file system is not.

This rule was added 2026-04-28 after a session burnt tokens drafting a Phase A plan for v0.5 work that had already shipped two weeks earlier.

## Branch + worktree hygiene

- Before creating a branch, run `git branch -a | grep <prefix>` and `gh pr list --state all --search <prefix>`. If a branch with similar name exists or has existed, surface that to the user before reusing the name.
- Tear down worktrees when work merges. Stale worktrees are read by the next session as evidence that work is mid-flight; they cause the same class of confusion as stale plans.
- When in doubt about whether a worktree is active, ask the user. Do not touch branches you didn't create.

## Plan lifecycle

- Active plans live in `docs/superpowers/plans/`.
- Shipped plans move to `docs/superpowers/plans/archive/` with a `STATUS: SHIPPED` banner at the top, in the same commit that ships the work or shortly after.
- Plans in `~/.claude/plans/` are session-local working memory only. They are NOT canonical and may be stale. If you find one and it looks live, verify against `STATUS.md` and git before acting.

## STATUS.md update protocol

Any session that ships work to `main`, or notices that STATUS is wrong, must update `STATUS.md` in the same commit. Stale STATUS is worse than no STATUS — it actively misleads.

## Writing data PRs (tiers, regions, honesty)

Multiple AI-authored data PRs (e.g. #267) shipped descriptions claiming tier upgrades and new regions the diff didn't contain. Root cause every time: **the PR was written from the plan, not the diff.** Follow these rules for any PR that touches `regions.ts` or `src/data/*`:

1. **Describe the diff, not the intent.** Before opening or updating a PR, run `git diff --stat origin/main...HEAD` and write the summary from that output. Every file and every claim must map to a changed line. Unfinished ambitions go under a "Follow-ups" heading — never in the summary as if done. The PR title becomes the squash-commit subject on `main`, so an overstated title is a permanent false record in the history this file tells you to trust.

2. **A tier is the `tier:` field in `src/lib/regions.ts` — prose is not a tier change.** Editing a `source:` string to say "anchored" or "T2" changes nothing the dashboard or dataset sees. A real upgrade needs, in one commit: the `tier:` field **+** `scripts/ci/golden/tier-counts.json` **+** `STATUS.md`. Litmus test: if `npm run tally:tiers` is unchanged (or `ci:tally-golden` passes without you touching the golden file), no tier moved — strip every "upgrade / anchored / T2 / T3→T2" word from the PR.

3. **Honesty — the repo's whole point.** The label must match the `tier:` field: never call `estimated`/synthetic data anchored, measured, or live (in headers, comments, or `source:` strings). Never delete an honesty caveat (e.g. "the X% rate was an invented placeholder") unless you added the data that makes it false. A "live probe" that always falls through to fallback is decoration, not an integration — don't describe it as live. Changing a headline anchor (e.g. 0.5 → 2.1 TWh/yr) needs a citation in the same edit and an explicit call-out, because it moves the dataset's totals.

4. **Keep your own numbers consistent** across the `regions.ts` `source:` string, the loader constant, and the `SOURCE_NOTE`. Grep your own figures across the diff before pushing.

5. **Run the gates locally before requesting review:** `npm run typecheck && npm test && npm run ci:tier-coherence && npm run ci:tally-golden && npm run ci:docs-drift`. Green proves structure, not prose — honesty (rule 3) is on you.

## Things this repo expects you to know

- **Active branch:** `main` (production branch). Open launch work as PRs into `main`; do not push directly to it.
- **Test runner:** vitest (`npm test` or `npx vitest run`).
- **Data loader pattern:** see `src/lib/resilient.ts::withFallback`. Every new loader wraps in this.
- **Profile helpers:** `src/lib/profile.ts` (`timeOfDayAverageGW`, `totalTWh30d`, `peakGW`) drive every loader's output shape.
- **Calc helpers:** `src/lib/calc.ts` (`aggregateAtHour`, `perHourAggregate`, `regionGWAtHour`) — fractional-hour-aware, used by globe + tooltip.
- **Theme tokens:** `src/lib/theme-tokens.ts` (`readGlobeTokens`, `parseHexToRGB`, `sanitisePillarAlpha`). Re-read on `themechange` event.
- **Fuel colours:** `src/lib/fuel.ts::getFuelColor()`. Do NOT introduce hardcoded fuel hex codes; that migration is done.

## Safety rails

- Never push directly to `main`/`master`.
- Never force-push without explicit user approval.
- Never reuse a branch name that has an open or recently-closed PR without surfacing that to the user first.
- Hooks run on commit (`npm run lint`, `npm test`). If a hook fails, fix the cause and create a NEW commit. Do not `--amend` or `--no-verify`.
