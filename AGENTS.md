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

## Kimi Multi-Agent Swarm Plan

When running Kimi's swarm/multi-agent mode, use explicit role ownership. The
goal is parallel diagnosis without overlapping edits or weakening the monitor.

### Coordinator Agent

Owns the final merge plan and launch recommendation.

- Start by reading this file, `STATUS.md`, PR #97 context, and the current
  branch diff.
- Assign agents to disjoint file areas before implementation begins.
- Prevent duplicate edits across loader files.
- Reject fixes that only lower thresholds, disable checks, or broadly
  allowlist failures.
- Merge agent outputs into one coherent PR.
- Final output: concise launch-gate summary, list of files changed, residual
  risks, and verification results.

### ENTSO-E Freshness Agent

Owns the degraded ENTSO-E bundle.

Primary files:

- `src/data/entsoe.json.ts`
- `src/lib/entsoe.ts`
- ENTSO-E related tests under `tests/data/`
- relevant workflow/env documentation if the root cause is deployment config

Tasks:

- Determine why all ENTSO-E records degraded from `lastSuccessAt:
  2026-05-08T04:25:29.944Z`.
- Distinguish token/env failure from API response drift and parser drift.
- Verify whether production has `ENTSOE_API_TOKEN` and whether the scheduled
  build path sees it.
- Fix loader/parser behavior only if code is the root cause.
- Do not touch non-ENTSO-E loader files.
- Final output: root cause, patch summary, before/after health count for
  ENTSO-E records, and tests run.

### Zero-Output Records Agent

Owns non-ENTSO-E zero-output live-tier records.

Primary files:

- `src/data/new-zealand.json.ts`
- `src/data/norway.json.ts`
- `src/data/nyiso.json.ts`
- `src/lib/eia-iso.ts`
- `src/data/peru.json.ts`
- `src/data/turkey.json.ts`
- focused tests under `tests/data/`

Investigate these records:

- `new-zealand-solar`
- `norway-no5`
- `nyiso-rest-solar`
- `peru-solar`
- `turkey-solar`

For each record:

- Decide whether zero is legitimate, a split artifact, parser failure, stale
  upstream behavior, or overclaimed live tier.
- Fix parser/split/tier issues honestly.
- If the zero is legitimate, provide evidence and propose a narrow allowlist
  entry with a comment.
- Do not touch ENTSO-E files.
- Final output: per-record decision table, patch summary, and tests run.

### Contract And Monitor Agent

Owns validator and health-check consistency.

Primary files:

- `.github/workflows/health-check.yml`
- `scripts/validate-snapshots.ts`
- `dataset/schema/region-snapshot.schema.json`
- `dataset/SCHEMA.md`
- related tests

Tasks:

- Keep health-check parsing aligned with snapshot validation.
- Ensure `cached` and `degraded` both count as freshness degradation.
- Ensure zero checks apply only to actual per-region live-tier records.
- Add narrow allowlist entries only when the ENTSO-E or zero-output agents
  provide evidence.
- Do not change thresholds unless the Coordinator approves with dry-run data.
- Final output: contract consistency summary and health dry-run output.

### Verification Agent

Owns final verification and launch-readiness evidence.

Tasks:

- Run Node 20 verification:

  ```bash
  npm ci
  npm run typecheck
  npm test
  npm run validate
  npm run ci:gates
  npm run build
  ```

- Run Python checks when Python files changed:

  ```bash
  python3 -m py_compile scripts/append_history.py scripts/build_annual_rollup.py
  python3 -m pytest <affected tests> -v
  ```

- Run the live health parser against `everylastjoule.com` after fixes or after
  deployment if needed.
- Inspect generated snapshot diffs; report whether they are intentional data
  refreshes or should be discarded.
- Final output: pass/fail table, health counts, and any residual launch risk.

### Swarm Rules

- Each agent should state the files it intends to edit before editing.
- Agents may read any file, but should only write within their ownership area.
- If a fix crosses ownership boundaries, hand it back to the Coordinator.
- Prefer code fixes over monitor suppression.
- A legitimate zero-output allowlist needs evidence, a comment, and matching
  updates in both the validator and health-check workflow.
- The final PR should read as one launch fix, not several unrelated rewrites.

## Repo Hygiene

- `STATUS.md` is the source of truth for shipped state.
- Files under `docs/superpowers/plans/archive/` are historical context, not
  active implementation instructions.
- Delete or archive stale workflows/plans rather than leaving them active.
