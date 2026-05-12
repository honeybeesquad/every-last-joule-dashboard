# Agent Instructions

This repository is launch-sensitive. Treat public data contracts, methodology
docs, and health monitoring as part of the product.

## Operating Rules

- Branch from `main` and open PRs back into `main`. Do not push directly to
  `main`.
- Use Node 20. Prefer `fnm use 20`; `nvm use 20` is also acceptable where
  available.
- Run `npm ci` before verification.
- Keep edits scoped to the requested launch issue. Do not refactor unrelated
  dashboard, loader, or docs surfaces.
- Do not keep generated snapshot diffs blindly. If `npm run build` refreshes
  tracked files under `data/snapshots/last-good/`, inspect the diffs and keep
  only intentional, valid data-contract changes.
- Do not bypass data-health failures with broad allowlists. Add a zero-output
  allowlist entry only after proving the zero is legitimate for the rolling
  window and documenting why.

## Data Contract Boundaries

Keep these fields distinct:

- `sourceStatus`: freshness of this build (`live`, `cached`, `degraded`).
- `sourceProvenance`: upstream-link kind (`verified`, `official-lead`,
  `modelled-fallback`).
- `confidenceTier`: uncertainty / source-quality tier (`T1a`, `T1b`, `T1c`,
  `T2`, `T3` labels).

If one changes, update the schema, validator, tests, snapshots, and public docs
that describe it.

## Launch Verification

Required checks before a launch-readiness PR is considered green:

```bash
npm run typecheck
npm test
npm run validate
npm run ci:gates
npm run build
python3 -m py_compile scripts/append_history.py scripts/build_annual_rollup.py
```

Run affected `pytest` coverage for any Python/data-history changes.

## Data-Freshness Launch Gate

The current monitor parses real region records from live dashboard JSON,
including multi-region payloads. Acceptance target:

- freshness-degraded region records below 10
- zero-output live-tier records below 5
- no aggregate-file false positives

Primary known issue as of PR #97: ENTSO-E payload freshness was degraded for
the whole bundle. Investigate `src/data/entsoe.json.ts`, `src/lib/entsoe.ts`,
deployment env vars, and current ENTSO-E API behavior before touching
thresholds.

Non-ENTSO-E zero-output records observed during the PR #97 dry run:

- `new-zealand-solar`
- `norway-no5`
- `nyiso-rest-solar`
- `peru-solar`
- `turkey-solar`

For each zero-output record, determine whether it is a legitimate recent-window
zero, a split artifact, parser failure, or overclaimed live tier. Fix the loader
or tier honestly; only allowlist after evidence.

## Planning

Do not define or assume named subagents unless the tool runtime explicitly
supports them and the user asks for parallel delegation. For Kimi or any single
coding model, make a simple task plan with ownership by file area:

- ENTSO-E freshness
- non-ENTSO-E zero-output records
- validator/health-check allowlist changes, if evidence supports them
- docs/tests/verification

## Repo Hygiene

- `STATUS.md` is the source of truth for shipped state.
- Files under `docs/superpowers/plans/archive/` are historical context, not
  active implementation instructions.
- Delete or archive stale workflows/plans rather than leaving them active.
