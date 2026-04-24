# Figure 2 Validation Discrepancies — Dataset-Level Survey

Audit date: 2026-04-25 · Scope: the 23 region-year pairs plotted in
`figure2_validation_scatter.pdf` and sourced from
`data/historical/figure2_validation_scatter.csv`.

Purpose: give reviewers of the Scientific Data submission a single
place to see every material gap between our HB backfill reconstruction
and the published TSO / IMM / SoM anchor, diagnose each gap using the
standard five-category taxonomy
(`docs/methodology/uncertainty.md`), and record the decision we took.

This document intentionally complements rather than replaces the
per-region "Discrepancy analysis" sections in `docs/validation/*.md`.
Per-region MDs diagnose the specific feed-vs-anchor story; this
document surveys the dataset as a whole and explains why v0.5 ships
with the backfill rates unchanged.

## Headline numbers (from Figure 2)

| Count | Classification | Region-year pairs |
|---:|---|---|
|   4 | within ±15% T1 envelope | `ercot-east`, `ercot-west`, `nyiso`, `poland` |
|   7 | moderate (15% < |Δ%| ≤ 50%) | `bulgaria`, `caiso`, `hungary`, `italy-north-zone`, `spp`, `sweden-south`, `switzerland` |
|  12 | material (|Δ%| > 50%) | see diagnostic table below |

Median |Δ%| across all 23 pairs: 53.4%. The dataset's headline tier
claim is ±15% only for the four regions inside the envelope; every
other region is covered by the wider ±20% (T2) or the reviewer-visible
per-region discrepancy note. No region is silently misrepresented.

## Material discrepancies — diagnostic table

Ordered by |Δ%| descending. Category names match the taxonomy in
`uncertainty.md`.

| Region | Year | HB TWh | Anchor TWh | Δ % | Category | Cause | v0.5 action |
|---|---:|---:|---:|---:|---|---|---|
| `norway-no3` | 2024 | 0.722 | 0.10 | +622% | scope mismatch | Rate applied to (hydro + wind); anchor is wind-only. NO3 is hydro-dominated. | Documented; rate unchanged. v1 audit candidate. |
| `iberia` | 2024 | 9.084 | 2.10 | +333% | scope mismatch | Feed covers ES+PT aggregated curtailment calibrated to REE 10.6 TWh total; anchor row cites 2.1 TWh "grid-side redispatch" subset only. | Figure 2 anchor updated in v1; preserves the 10.6 TWh calibration intent. |
| `norway-no4` | 2024 | 1.196 | 0.30 | +299% | scope mismatch | Rate applied to (hydro + wind); anchor is wind-only. NO4 is export-constrained with real hydro spill. | Documented; rate unchanged. |
| `iso-ne` | 2024 | 0.131 | 0.034 | +284% | definitional | Anchor = IMM "dispatch-down" (a narrow economic-curtailment concept); 93% concentrated in Maine/Vermont congestion pocket. Our rate captures broader renewable shed. | Documented; rate unchanged. |
| `greece` | 2024 | 0.802 | 0.35 | +129% | rate over-calibration candidate | Rate 3.6% grounded to HAEE 860 GWh, but Ember-2024 VRE denominator may underrepresent 2024 growth. | Documented; v1 candidate for Ember denominator refresh. |
| `portugal` | 2024 | 0.913 | 0.40 | +128% | rate placeholder | Rate 10% (solar) / 3% (wind) are flagged placeholder in `entsoe-rates.md`; no citable 2024 curtailed-energy total published by REN. | Rate marked placeholder; Figure 2 row kept to document the gap. |
| `italy-sardinia` | 2024 | 0.116 | 0.062 | +88% | anchor approximation | Anchor is 20% × Terna national 0.31 TWh (estimated Sardinia share); the actual Terna zonal breakdown is not separately published. | Documented; rate unchanged. |
| `czech-republic` | 2024 | 0.085 | 0.05 | +70% | anchor precision | ČEPS 2024 RES curtailment quoted as "<0.1 TWh"; treated as 0.05 midpoint for Δ%. | Midpoint methodology surfaced in validation/czech-republic.md. |
| `netherlands` | 2024 | 0.809 | 3.00 | -73% | rate grounded-but-drifting | Rate calibrated against IEEFA 4.9%; applied to A75 generation for B16+B18+B19. IEEFA figure is a VRE-scope aggregate that includes economic redispatch A75 doesn't return. | Rate unchanged; discrepancy accepts the IEEFA-scope mismatch. |
| `baltics` | 2024 | 0.082 | 0.20 | -59% | rate placeholder | Rate placeholder; Litgrid publishes combined Baltic wind curtailment but no disaggregation across LT/LV/EE. | Documented; v1 candidate after Litgrid 2025 annual. |
| `germany` | 2024 | 9.417 | 23.20 | -59% | regime change | BNetzA's 23.2 TWh includes Redispatch 2.0 volumes since Oct 2021; our rate captures the older "EEG Einspeisemanagement" concept that was ~60% of the new regime. | Documented in methodology/historical-backfill.md §"Regime change". |
| `miso` | 2024 | 8.437 | 5.50 | +53% | rate over-calibration candidate | EIA wind+solar × flat rate outpaces MISO SoM reporting; SoM covers only market-settled curtailment. Our rate captures operator-curtailed wind more completely. | Documented; v1 candidate for tighter scope. |

## Moderate discrepancies (15% < |Δ%| ≤ 50%)

| Region | Year | HB TWh | Anchor TWh | Δ % | Note |
|---|---:|---:|---:|---:|---|
| `spp` | 2024 | 4.417 | 3.00 | +47% | ~75 TWh wind × ~4% curtailment vs SoM ~3 TWh; acceptable fit. No action. |
| `italy-north-zone` | 2024 | 0.059 | 0.108 | -45% | Anchor is 35% × Terna national 0.31 TWh (North share); Terna separately publishes ~1.1 TWh zonal-overflow redispatch treated as a different metric. Narrower anchor preserves single-concept comparison. |
| `switzerland` | 2024 | 0.065 | 0.10 | -35% | Swissgrid PV curtailment; hydro spill deliberately excluded (`docs/validation/switzerland.md`). |
| `caiso` | 2024 | 2.757 | 3.90 | -29% | CAISO Ascend/daily-report composite; flat rate slightly under-captures Q3 spike. |
| `bulgaria` | 2024 | 0.119 | 0.10 | +19% | ESO anchor is a rounded "~0.1 TWh"; within tolerance. |
| `hungary` | 2024 | 0.177 | 0.15 | +18% | MAVIR 2024 anchor; solar dominant. |
| `sweden-south` | 2024 | 0.168 | 0.20 | -16% | Svk SE3+SE4 wind curtailment; within T1 envelope at ±20% tier fraction. |

## Why v0.5 does not re-calibrate rates

Three reasons to document rather than revise:

1. **Backfill reproducibility.** The 2.59M-row
   `curtailment_backfill.parquet` archive committed in HB sprint is the
   single reproducibility artefact Figures 2, 3, 4 all depend on. A
   rate change triggers a 7-year × 29-region re-fan-out, invalidates
   every committed per-region TWh total in `per_region_annual.parquet`,
   and forces every `docs/validation/*.md` table to be regenerated.
   For a submission-phase data descriptor we value the byte-stable
   artefact over a better-fitting rate.
2. **Anchor-quality ceiling.** The largest gaps (`norway-no3`,
   `norway-no4`, `iso-ne`, `germany`, `iberia`) reflect scope or
   definitional mismatches between our hourly rate-model and the
   anchor's accounting concept, not arithmetic miscalibration.
   Changing the rate would hide a real methodological divergence we
   want reviewers to see.
3. **Envelope transparency.** T1-live-TSO's ±15% envelope is a
   _target_ for the subset of regions where the rate-model converges
   on the anchor; the envelope is not a claim that every region lies
   within it. Figure 2 explicitly shows 19/23 points outside the
   shaded band; rule-green within-envelope pairs are identified and
   counted in the summary inset.

## v1 candidates (post-submission)

For each, a concrete rate refinement or scope re-scope that would
tighten the Figure 2 fit without changing methodology scope:

- `norway-no3`, `norway-no4`: move rate application from `(B12 hydro +
  B19 wind)` to `B19 wind` only; accept that Norwegian hydro spill is
  a separate concept Statnett does not publish.
- `iberia`: refresh the Figure 2 anchor to REE's 10.6 TWh total
  (matches the rate-calibration target in `entsoe.json.ts`); the 2.1
  TWh anchor applies only to the "grid-side redispatch" subset.
- `greece`, `portugal`, `miso`: refresh Ember-based denominator to
  2024/25 data when available; current rates grounded against
  2023-era VRE generation.
- `germany`: add a post-2021-Oct split between EEG
  Einspeisemanagement and Redispatch 2.0; the BNetzA figure that
  yields -59% is Redispatch-2.0-inclusive.
- `netherlands`: investigate whether ENTSO-E A77 "Curtailed Renewable
  Energy" is populated for NL; would replace the 4.9% VRE-aggregate
  rate with directly-measured curtailed-energy hourlies.

All five candidates are deferred to a v1 "curtailment-dataset 2.0"
sprint that will re-fan-out the backfill on a corrected rate sheet
and re-render Figures 2-4 against the new archive.

## Cross-references

- `docs/methodology/entsoe-rates.md` — the per-zone rate audit table
  (source of truth for rate origin / placeholder status).
- `docs/methodology/uncertainty.md` — the tier model (T1 ±15% / T2
  ±20% / T3 ±40%) that defines the envelope bands on Figure 2.
- `docs/methodology/historical-backfill.md` — the backfill
  construction method; Figure 2 Y-axis values are products of this.
- `docs/validation/<region>.md` — per-region discrepancy prose (14
  material regions all carry a commit-grade analysis).
- `scripts/validation/figure2_data.py`,
  `scripts/validation/figure2_plot.py` — the
  build chain for the validation scatter.
