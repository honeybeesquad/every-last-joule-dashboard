# Phase-3 integration runbook

Date: 2026-04-25 · Owner: Claude · Triggered by: all dispatched Codex/Gemini PRs landed.

## What this is

The deterministic checklist Claude follows once Phase-1 and Phase-2 work has all landed. The work is mostly verification, regeneration, and final-pass editing — no new design decisions beyond Simon's pick of B4 Option A/B/C.

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
- [ ] Simon has decided B4 Option A / B / C.

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

## Step 3 — B5 demote neighbour-anchored ENTSO-E zones (1–2 h)

Only if Simon picks Option B (subdivide T1).

For each zone identified in Step 2 as "genuine residual envelope > ±15% AND uses neighbour-extrapolated rate":

1. Switch tier in `src/lib/regions.ts` from `tier: "live"` to `tier: "live-neighbour-anchored"` (new enum value).
2. Extend `src/lib/uncertainty.ts::deriveTier` to map this to a new `T1c` confidence tier with empirically-derived envelope.
3. Update `tests/regions.test.ts` count expectations.
4. Update `tests/uncertainty.test.ts` to test the new tier.
5. Run full test suite.

Affected zones (predicted): Switzerland (anchored to Czech rate), Italy zone splits (Centre-North, Sicily, Sardinia), possibly Greece. Estimate: ~6 zones.

## Step 4 — Paper rewrite sweep (2–6 h depending on Option)

Using `docs/paper/post-council-rewrite-checklist.md`:

### Option A (keep ±15% with bias note) — ~1 h
- Add §4.2.1 "Documented systematic bias" paragraph with the +X% figure from Step 2.
- No tier-table changes.

### Option B (subdivide T1a/T1b/T1c — recommended) — ~4 h
- Update §2.5 tier table (4 rows → 6 rows).
- Update §5.2 tier table.
- Update every "T1 ±15%" citation in §1, §4, figure-captions to specify T1a vs T1c.
- Update README tier breakdown.
- Run `npm run tally:tiers > tests/__golden__/tally-tiers.txt`.

### Option C (collapse to ±25%) — ~2 h
- Update §2.5 tier table (one row).
- Update §5.2 tier table.
- Update every "T1 ±15%" → "T1 ±25%" globally.
- Update figure captions.

### All options
- Drop "T4-structural-gap" tier row from §2.5 per N2 (already in checklist).
- Replace "structural gap" vocabulary with "documented-gap" per N2.
- Confirm region count matches `npm run tally:tiers`.
- Verify two-axis taxonomy table appears once in §1.

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

- Best case (Option A, no scope-mismatch surprises): **2–3 hours**
- Realistic case (Option B, 1–2 outlier escalations): **6–8 hours**
- Worst case (Option B with multiple failed CI checks): **1–2 days** spread across sessions

## What does NOT happen in Phase 3

- New design decisions beyond Option A/B/C.
- New loader development. (v1 work is paused for submission.)
- Any change to the dispatched Codex/Gemini PRs after they're merged.
- Live deployment to everylastjoule.com (separate decision).

## Status — pre-flight readiness

| Item | Status |
|---|---|
| Phase-1 Claude items committed | ✅ B4, S1-design, S4-design, N2, anchors.md, post-council-rewrite-checklist.md |
| Codex dispatched | CODEX-1 through CODEX-4, CODEX-5, CODEX-6 |
| Gemini dispatched | GEMINI-1, GEMINI-2, GEMINI-3 |
| User decision (B4 Option) | Pending — needed after B1 lands |
| Phase-3 trigger | All dispatched items merged |
