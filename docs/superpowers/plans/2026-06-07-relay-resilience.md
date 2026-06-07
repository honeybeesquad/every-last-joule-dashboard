# Plan — Relay resilience: staleness→degraded + freshness alerting

**Spec:** `docs/superpowers/specs/2026-06-07-relay-resilience-design.md`
**Branch:** `feat/relay-resilience`
**Status:** IN PROGRESS

---

## Task map (follows spec §8 file table)

### Task 1 — `relayFreshness` helper + constant in `src/lib/freshness.ts`
- Add `RELAY_STALENESS_THRESHOLD_DAYS = 4` constant
- Add `relayFreshness(latestRowDateIso, now, thresholdDays)` pure function
- Returns `"live" | "degraded"`; null/garbage/missing date → `"degraded"`

### Task 2 — `tests/freshness.test.ts` (NEW — write test first, then impl)
- fresh date → `"live"`
- stale date (> threshold) → `"degraded"`
- exact-boundary age (= threshold) → `"live"` (on-boundary is fresh)
- `null` date → `"degraded"`
- empty string date → `"degraded"`
- garbage date string → `"degraded"`
- uses fixed `now`

### Task 3 — `tests/fixtures/colombia-vertimientos-stale.csv` (NEW)
- Header: `date,gwh,fetched_at_utc,note` (matching real CSV)
- A few rows with newest row dated well before test's fixed `now` (> 4 days)

### Task 4 — `src/data/colombia.json.ts` loader seam + self-stamp
- Add `now` and `csvPath` optional params to `run()`
- Thread `latestDate` out of both branches
- After `applyUncertainty`, call `relayFreshness` and set `sourceStatus: "degraded"` + `lastSuccessAt` when stale
- Verify `stampLive` in resilient.ts preserves pre-set `"degraded"` (lines 174-176 — confirmed above)

### Task 5 — `tests/data/colombia.test.ts` (EXTEND)
- Test: stale fixture CSV → `sourceStatus === "degraded"`, `lastSuccessAt` = fixture's newest row date
- Test: fresh fixture CSV (or real CSV) → `sourceStatus` not set to `"degraded"` (left for stampLive)

### Task 6 — `.github/workflows/relay-freshness.yml` (NEW)
- Daily at `0 20 * * *` + `workflow_dispatch`
- Parse max `date` across relay CSVs (start: just Colombia CSV)
- Open/update/auto-close deduplicated issue labelled `auto-relay-stale`
- Mirror create/comment/close pattern from `health-check.yml`

### Task 7 — `docs/validation/colombia.md` (MODIFY)
- Add one-line note about relay self-degradation + freshness alert

---

## Commit plan (one commit per task)
1. `test(freshness): failing tests for relayFreshness helper`
2. `feat(freshness): relayFreshness helper + RELAY_STALENESS_THRESHOLD_DAYS`
3. `test(data/colombia): stale fixture + loader degraded-status tests`
4. `feat(data/colombia): now/csvPath seams + relay-freshness self-stamp`
5. `feat(ci): relay-freshness.yml — daily staleness alert workflow`
6. `docs(validation/colombia): relay self-degradation + alert note`
