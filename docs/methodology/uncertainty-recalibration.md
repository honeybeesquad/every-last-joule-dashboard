# T1 tier-band empirical recalibration

Last updated: 2026-04-25 · Owner: Claude (council finding B4) · Paper section: Technical Validation §4.2

## Why this exists

The 5-agent council audit (`docs/proposals/2026-04-25-council-remediation-dispatch.md`) flagged the headline T1 ±15% claim as unsupported by the data. This document is the auditable analysis.

## Method

`scripts/calibration/empirical_tier_bands.py` joins `data/historical/per_region_annual.parquet` (203 region-years) to the `tso_annual_twh` per-year dict in `scripts/validation/external-anchors.json`. Where both backfill and a published TSO annual are available, it computes:

```
Δ% = (backfill_twh − anchor_twh) / anchor_twh × 100
```

It then runs a coverage-frequency analysis: for each candidate envelope width (±15, ±20, ±30, ±40, ±50, ±75, ±100%), what fraction of region-years fall inside? And inversely: what envelope width is required to reach P50, P67, P90, P95 coverage?

Re-run with `python3 scripts/calibration/empirical_tier_bands.py --by-tier`.

## Headline finding (23 anchored T1 region-years, 2026-04-25)

| Statistic | Value |
|---|---|
| Pairs (region-years with both backfill and anchor) | 23 |
| Median signed Δ% | **+18.0%** (systematic over-estimate) |
| Median \|Δ%\| | **53.4%** |
| Max \|Δ%\| | 622.3% (norway-no3 2024) |
| Coverage at ±15% (claimed T1 envelope) | **17.4%** (4/23) |
| Coverage at ±20% | 30.4% |
| Coverage at ±40% (T3 envelope) | 39.1% |
| Coverage at ±50% | 47.8% |
| Coverage at ±75% | 69.6% |
| Envelope for P67 coverage | ±72.3% |
| Envelope for P95 coverage | ±329.2% |

**The empirical T1 envelope at advertised P95 coverage is approximately 22× wider than the headline ±15%.** The ±15% claim is not defensible as written.

## Why the right tail is so heavy — diagnostic

Sorting by \|Δ%\| reveals a clear pattern:

| Rank | Region | Year | Backfill TWh | Anchor TWh | Δ% | Resolution |
|---|---|---|---|---|---|---|
| 1 | norway-no3 | 2024 | 0.722 | 0.100 | **+622%** | ENTSO-E PT15M |
| 2 | iberia | 2024 | 9.084 | 2.100 | **+333%** | ENTSO-E PT15M |
| 3 | norway-no4 | 2024 | 1.196 | 0.300 | **+299%** | ENTSO-E PT15M |
| 4 | iso-ne | 2024 | 0.131 | 0.034 | +284% | EIA PT1H |
| 5 | greece | 2024 | 0.802 | 0.350 | **+129%** | ENTSO-E PT15M |
| 6 | portugal | 2024 | 0.913 | 0.400 | **+128%** | ENTSO-E PT15M |
| 7 | italy-sardinia | 2024 | 0.116 | 0.062 | +88% | ENTSO-E PT15M |
| 8 | netherlands | 2024 | 0.809 | 3.000 | −73% | ENTSO-E PT15M |
| 9 | czech-republic | 2024 | 0.085 | 0.050 | +70% | ENTSO-E PT15M |
| 10 | germany | 2024 | 9.417 | 23.200 | −59% | ENTSO-E PT15M |

Best agreement (bottom of the table):

| Region | Year | Backfill TWh | Anchor TWh | Δ% | Resolution |
|---|---|---|---|---|---|
| ercot-west | 2024 | 5.797 | 5.800 | **−0.1%** | EIA PT1H |
| ercot-east | 2024 | 2.986 | 3.000 | **−0.5%** | EIA PT1H |
| poland | 2024 | 0.726 | 0.749 | **−3.0%** | ENTSO-E PT15M (rate from URE) |
| nyiso | 2023 | 0.138 | 0.162 | −14.7% | EIA PT1H |
| sweden-south | 2024 | 0.168 | 0.200 | −16.2% | ENTSO-E PT15M |

The pattern is unmistakable: **EIA PT1H zones agree with TSO anchors to within 5%; ENTSO-E PT15M zones diverge by hundreds of percent.** This is the Code Reviewer's PT15M over-count bug (council finding B1) showing up empirically — `totalTWh30d` (`src/lib/profile.ts:68`) sums 15-minute MW values as if they were 1-hour MWh contributions, overstating European TWh by ~4×.

A +4× factor would predict +300% Δ — which is exactly what Iberia (+333%), Norway NO4 (+299%), and Norway NO3 (+622%, with additional rate issues) show.

## Recommendation

**Do NOT recalibrate the T1 band from this analysis.** The current empirical distribution is corrupted by the PT15M bug. Two-step plan:

### Step 1 — wait for B1 to land (Codex)

Codex brief CODEX-1 in `docs/proposals/2026-04-25-council-remediation-dispatch.md` will fix the PT15M over-count. Expected post-fix outcome:
- ENTSO-E TWh values decrease ~75%.
- Iberia 9.084 → ~2.27 TWh (vs 2.1 TWh anchor → Δ +8%).
- Norway NO4 1.196 → ~0.30 TWh (vs 0.30 TWh anchor → Δ ~0%).
- Greece 0.802 → ~0.20 TWh (vs 0.35 TWh anchor → Δ −43%).
- Germany 9.417 → ~2.35 TWh (vs 23.2 TWh anchor → Δ −90%, i.e. anchor is wrong).

### Step 2 — re-run this script and triage residual outliers

After B1 lands, regenerate `data/historical/per_region_annual.parquet` and re-run `scripts/calibration/empirical_tier_bands.py`. The remaining outliers will fall into three classes:

1. **Genuine T1 agreement** (target |Δ%| ≤ 15%): keep the ±15% band — these zones earn it.
2. **Anchor disagreement, our backfill correct**: update the anchor in `external-anchors.json` with a more authoritative source. Examples likely: Germany (BNetzA 23 TWh covers wind+solar+ramping spill; our 9 TWh covers wind only — anchor scope mismatch, not envelope failure).
3. **Genuine residual envelope > ±15%**: these zones graduate to a new sub-tier T1b ("live-generation × static rate") with empirically-calibrated band. ERCOT/Poland stay T1a; Italy splits, Switzerland, possibly Greece move to T1b.

## Three options for the published T1 band — for user decision

After step 1+2 above, choose one:

### Option A — keep ±15%, document residual bias

- Headline: "T1 ±15%, with documented systematic bias of +X%."
- Add a "residual-bias" column to per-region MDs.
- Pros: simple; preserves existing framing.
- Cons: the bias term feels like an excuse; reviewers may push back.

### Option B — subdivide T1

- T1a (TSO-published curtailment, e.g. ERCOT, Spain REE, BNetzA-direct): ±15%.
- T1b (live-generation × documented static rate, e.g. ENTSO-E zones with TSO-published rates): ±20–25%, empirically calibrated.
- T1c (live-generation × neighbour-extrapolated rate, e.g. Switzerland anchored to Czech/Hungarian; Italy zone splits): ±30–40%, demoted in line with rate-extrapolation distance.
- Pros: methodologically honest; respects rate provenance.
- Cons: adds complexity; requires Δ% per-zone classification work (council finding B5).

### Option C — collapse T1 into a wider single band

- T1 ±25% (or whatever P67 settles at post-B1).
- Pros: simplest; doesn't require sub-tier infrastructure.
- Cons: penalises the genuinely T1a zones; loses information.

**Claude recommends Option B** as the durable answer. It maps cleanly onto the existing rate-provenance documentation in `src/data/entsoe.json.ts` line-comments and resolves both the Code Reviewer's "neighbour-anchored T1 mis-tiering" finding (B5) and the Model QA's "evidentiary depth missing" critique. Implementation cost is moderate — ~12 zones to reclassify, one new tier constant, propagation through `tally-tiers.ts`.

## Reproduction

```bash
# Run the analysis
python3 scripts/calibration/empirical_tier_bands.py --by-tier

# JSON output for downstream tooling
python3 scripts/calibration/empirical_tier_bands.py --json > out.json
```

Source files:
- Script: `scripts/calibration/empirical_tier_bands.py`
- Backfill: `data/historical/per_region_annual.parquet` (203 region-years)
- Anchors: `scripts/validation/external-anchors.json` (123 regions)

## Status / next actions

| Step | Owner | Status |
|---|---|---|
| Initial empirical analysis | Claude | ✅ landed (this doc) |
| B1 PT15M fix | Codex | dispatched (CODEX-1) |
| Re-run analysis post-B1 | Claude | blocked on B1 |
| Triage residual outliers + scope-mismatch anchors | Claude | blocked on re-run |
| Choose option A / B / C | User | blocked on re-run |
| Implement chosen option | Claude (B/C) or Gemini (A) | blocked on user decision |
| Update paper §4.2 framing | Gemini | blocked on chosen option |
