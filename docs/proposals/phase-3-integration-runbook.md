# Phase-3 integration runbook

Date: 2026-04-25 · Owner: Claude · Triggered by: all dispatched Codex/Gemini PRs landed.

## What this is

The deterministic checklist Claude follows once Phase-1 and Phase-2 work has all landed. The work is mostly verification, regeneration, and final-pass editing.

**B4 decision: Option B is locked** (`docs/proposals/b4-option-b-decision.md`).
T1 subdivides into T1a/T1b/T1c. Options A and C are not maintained as
fallbacks. The Step 4 paper-rewrite block below describes the single
Option-B path.

## Pre-flight checklist (verify before starting)

- [ ] `CODEX-1` (B1 PT15M overcount fix) merged into `v0-build`.
- [ ] `CODEX-2` (S5 splitRegion observedStdGW) merged.
- [ ] `CODEX-3` (N3 misleading sourceNote) merged.
- [ ] `CODEX-4` (S2 sourceStatus degraded enum) merged.
- [ ] `GEMINI-1` (B2+B3+N1 region/zone count + drop ±20% T4 band) merged.
- [ ] `GEMINI-2` (S6 T2 constant-rate doc in uncertainty.md) merged.
- [ ] `GEMINI-3` (S1 implementation: anchor schema v2 migration) merged.
- [ ] `CODEX-5` (S3 end-to-end reproducer) merged.
- [ ] `CODEX-6` (S4 implementation: tier-coherence + tally-golden + docs-drift CI) merged.
- [x] B4 Option B locked (decision record: `docs/proposals/b4-option-b-decision.md`).
- [ ] `CODEX-7` (Option B implementation: T1 subdivision into T1a/T1b/T1c) dispatched and merged. **NOTE: CODEX-7 dispatch itself is blocked on CODEX-1 + B4 rerun completing — see Step 2 below.**

If any are not yet landed, integration is partial — execute only the steps unblocked by what landed, defer the rest.

## Step 1 — Regenerate downstream artefacts (10–15 min)

Order matters: parquet → figures → validation MDs → tally golden → paper sweep.

```bash
# 1a. Regenerate the per-region annual rollup parquet (incorporates B1 fix)
cd /Users/simoncollins/code/every-last-joule-dashboard
python3 scripts/build_annual_rollup.py
# Verify ENTSO-E TWh values dropped ~75% per docs/methodology/uncertainty-recalibration.md

# 1b. Re-run B4 empirical analysis on corrected data
python3 scripts/calibration/empirical_tier_bands.py --by-tier > /tmp/b4-postfix.txt
diff <(grep "^Coverage" /tmp/b4-postfix.txt) <(echo "expected post-fix coverage table")
# Expected: ±15% coverage rises substantially (was 17.4%; PT1H zones now dominate inliers)

# 1c. Regenerate figures
python3 scripts/validation/figure1_global_map.py
python3 scripts/validation/figure2_data.py
python3 scripts/validation/figure2_plot.py
python3 scripts/validation/figure3_temporal_trace.py
python3 scripts/validation/figure4_coverage_map.py
python3 scripts/validation/figure5_top20_timeseries.py

# 1d. Regenerate validation MDs (post-anchor-v2 migration)
python3 scripts/validation/build_region_docs.py

# 1e. Update tally golden file
npm run tally:tiers > tests/__golden__/tally-tiers.txt

# 1f. Verify CI passes (ideally on a feature branch first)
npm run typecheck && npm test && npm run validate && npm run validate:tiers && npm run check:tally && npm run check:docs
```

If any step fails, halt — the fix is somewhere in the upstream PR set, not in integration.

## Step 2 — Re-run B4 analysis and decide outliers (30 min)

With the corrected parquet:

1. `python3 scripts/calibration/empirical_tier_bands.py --by-tier` — fresh report.
2. Walk the worst-offender table. Expected post-B1 outliers (per `uncertainty-recalibration.md` predictions):
   - Iberia: was +333%, expect +8% post-fix. **If still > 30%, escalate** (anchor-scope mismatch with REE 10.6 TWh figure).
   - Norway NO4: was +299%, expect ~0% post-fix. **If still > 20%, hydro-rate scope mismatch.**
   - Greece: was +129%, expect ~−43%. **Material discrepancy — anchor or rate refresh candidate.**
   - Germany: was −59%, expect ~−90%. Confirms BNetzA scope mismatch (covers redispatch + EEG; we cover EEG only).
3. Sort residual outliers into three classes (per `uncertainty-recalibration.md`):
   - **Genuine T1 agreement (|Δ%| ≤ 15%):** good outcome.
   - **Anchor scope mismatch:** update anchor in `external-anchors.json`. v2 schema requires updating `_provenance.notes` to document scope.
   - **Genuine residual envelope > ±15%:** these are the candidates for B5 demotion.

## Step 3 — B5 implementation: T1 subdivision into T1a/T1b/T1c (1–2 h)

Per the locked Option B decision (`docs/proposals/b4-option-b-decision.md`).
This is the CODEX-7 dispatch — Claude prepares the brief, Codex executes.

For each zone Step 2 has classified:

1. **T1c set** (residual > ±15% AND uses neighbour-extrapolated rate):
   - `src/lib/regions.ts`: switch `tier: "live"` → `tier: "live-neighbour-anchored"`.
2. **T1b set** (residual ±15–25% AND uses domestic stat-agency anchor):
   - `src/lib/regions.ts`: switch `tier: "live"` → `tier: "live-domestic-anchored"`.
3. Both new tiers added to `Tier` type alias and to `ConfidenceTier`
   union in `src/lib/uncertainty.ts`.
4. `deriveTier` extended to map both new region tiers to their
   confidence-tier counterparts.
5. `applyUncertainty` updated with empirical envelope numbers from
   Step 2 (T1b ±20–25%, T1c ±30–40% — sized to observed residual).
6. `tests/regions.test.ts` and `tests/uncertainty.test.ts` updated.
7. Full test suite + CI passes (assumes CODEX-6 has landed and the
   tier-coherence CI is in place).

Predicted T1c zones (per `b4-option-b-decision.md`): Switzerland (Czech
rate), Italy splits — Centre-North, Sicily, Sardinia (peninsular rate),
possibly Greece. Estimate: ~6 zones. Actual list comes from Step 2.

## Step 4 — Paper rewrite sweep (Option B, ~4 h)

Per the locked Option B decision and the
"edit-after-decision" block in `docs/paper/post-council-rewrite-checklist.md`.

### Tier-table changes
- §2.5 tier table grows from 4 rows to 6 rows: T1a, T1b, T1c, T2, T2-flare, T3.
  Structural form is fixed in `b4-option-b-decision.md`; counts and the
  T1c envelope number are filled at sweep time from `npm run tally:tiers`
  output and the Step 2 rerun.
- §5.2 tier table — same structure, repeat.

### Prose changes
- Every "T1 ±15%" citation in §1, §4, figure-captions is annotated with
  the specific sub-tier (T1a / T1b / T1c). No unqualified "T1" remains.
- Per-region §4.2 worst-offender table annotates which sub-tier each
  zone now sits in.
- README tier breakdown updates to 6-row form.
- `tests/__golden__/tally-tiers.txt` regenerated.

### N1 / N2 hygiene (independent of Option B but part of the sweep)
- Drop "T4-structural-gap" tier row from §2.5 per N2 (already in
  rewrite checklist).
- Replace "structural gap" vocabulary with "documented-gap" per N2.
- Confirm region count matches `npm run tally:tiers`.
- Verify the two-axis taxonomy table appears once in §1.

## Step 5 — Final verification (30 min)

```bash
# Full local CI dry-run
npm run typecheck
npm test
npm run validate
npm run validate:tiers
npm run check:tally
npm run check:docs
python3 scripts/validation/check_anchors.py

# No occurrences of stale rhetoric
grep -rn "T4\|three pillar\|structural gap" docs/paper/ README.md  # expect: empty
grep -n "140 regions\|~140" docs/paper/ README.md  # expect: empty

# Region counts consistent across artefacts
grep "128 regions" README.md docs/paper/01-background-and-summary.md  # expect: matches
npm run tally:tiers | head -10  # confirm matches above
```

If everything passes, the dataset is Scientific-Data-submission-ready.

## Step 6 — Tag and ship (15 min)

```bash
git tag -a sci-data-readiness-v1 -m "Council remediation complete; dataset ready for Scientific Data submission"
git push origin sci-data-readiness-v1
```

Update `docs/paper/README.md` with the tag reference. Update `docs/paper/06-code-availability.md` with the tag for citation.

## Failure modes and what to do

| Symptom | Likely cause | Recovery |
|---|---|---|
| `npm run validate:tiers` fails | A loader's `confidenceTier` doesn't match `regions.ts` | Trace to specific region; either fix the loader or update regions.ts |
| Iberia Δ% post-B1 still > 30% | Anchor scope mismatch (REE total vs sub-segment) | Update anchor to 10.6 TWh; update `_provenance.notes` |
| Tally golden diff | Region added/removed/retiered intentionally? | Update tests/__golden__/tally-tiers.txt; otherwise revert |
| `check_anchors.py` orphan provenance warnings | Gemini left unused `_provenance` entries | Remove or reuse; warnings don't fail build |
| Figure regen fails | Matplotlib/pyarrow version drift | Reinstall via `pip install -r scripts/requirements.txt` |
| Backfill rerun fails | EIA/ENTSO-E API rate limit | Pause, retry; check `data/historical/backfill/*.parquet` mtimes |

## Estimated total integration time

Option B is locked, so the estimate is single-path:

- Clean run (no T1c outlier escalations beyond the predicted ~6 zones,
  CI passes first try): **6–7 hours**.
- Realistic (1–2 anchor-scope mismatches escalate to anchor refresh in
  `external-anchors.json`): **8–10 hours**.
- Worst case (CI checks fail repeatedly, requires multi-session debug):
  **1–2 days** spread across sessions.

## What does NOT happen in Phase 3

- New design decisions. Option B is locked; the §2.5 / §5.2 tier table
  structure is fixed in `b4-option-b-decision.md`.
- New loader development. (v1 work is paused for submission.)
- Any change to the dispatched Codex/Gemini PRs after they're merged.
- Live deployment to everylastjoule.com (separate decision).

## Status — pre-flight readiness

| Item | Status |
|---|---|
| Phase-1 Claude items committed | ✅ B4, S1-design, S4-design, N2, anchors.md, post-council-rewrite-checklist.md |
| Codex dispatched | CODEX-1 through CODEX-4, CODEX-5, CODEX-6 |
| Gemini dispatched | GEMINI-1, GEMINI-2, GEMINI-3 |
| User decision (B4 Option) | ✅ Option B locked 2026-04-25 (`b4-option-b-decision.md`) |
| CODEX-7 (Option B implementation) | Pending — Claude dispatches post-B1+rerun |
| Phase-3 trigger | All dispatched items + CODEX-7 merged |
