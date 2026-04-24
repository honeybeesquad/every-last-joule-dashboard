# Uncertainty methodology

Last updated: 2026-04-24 · Sprint: S2 · Implements gap closure plan §S2

## Scope

Every emitted curtailment value — hourly profile and derived `peakGW` — carries an uncertainty envelope and a confidence tier. This document states (1) how each tier is assigned, (2) how the envelope is calculated, and (3) which assumptions drive the magnitude of the envelope. The code that implements this is `src/lib/uncertainty.ts`; the schema addition is documented in `dataset/SCHEMA.md`.

The goal is to give a reader enough information to either accept the published figure or, if they have a better calibration, replace it with theirs — and to do so reproducibly. We make no claim of a formally-propagated error model in the statistical sense; the tier fractions are conservative published-source-implied envelopes, informed where possible by multi-year observed variance.

## Tier definitions

| Tier | Condition | Envelope model | Typical ± on peakGW |
|---|---|---|---|
| **T1-live-TSO** | `Region.tier === "live"` — live feed from a TSO/ISO with documented calibration, ≥ 1 yr live history | 2σ from the 5-year backfill archive when available (`σ` = standard deviation of annual peakGW across the backfill years), otherwise a fallback of ±15 % of current-snapshot peakGW | 5–15 % |
| **T2-annual-calibrated** | `Region.tier === "flare"` **or** (`Region.tier === "static"` and `profileKind === "flat"`) — anchored to a published annual total (GGFR, Ember, IRENA, TSO annual report) with no shape modelling | ±20 % × peakGW | ±20 % |
| **T3-modelled** | `Region.tier === "static"` and `profileKind ∈ { "solar", "hydro-seasonal" }` — static annual anchor combined with a typical-shape diurnal or seasonal profile | ±40 % × peakGW | ±40 % |
| **T4-structural-gap** | No hourly claim made for this region | n/a | n/a |

T4 is reserved — structural-gap regions are documented in `docs/known-limitations.md` and do not appear as rows in `RegionData`. Tier derivation is implemented in `uncertainty.ts::deriveTier` and is deterministic — given a loader id and its profile kind, the tier is fixed.

## Envelope calculation

The implementation emits three fields on every `RegionData`:

- `confidenceTier` — the label from the table above.
- `uncertaintyLowGW` — lower bound on `peakGW`. `max(0, peakGW - δ)`.
- `uncertaintyHighGW` — upper bound on `peakGW`. `max(peakGW, peakGW + δ)`.

where the half-width `δ` is chosen per tier:

- **T1 with backfill**. `δ = 2σ`, where σ is the standard deviation of annual-peak curtailment across the backfill years (2020–2026 where all years are present). This is the strongest model we publish — the envelope reflects empirically observed year-over-year variance for that specific region, not a blanket fraction.
- **T1 without backfill** (loader exists but backfill has not completed yet, or the region is new). `δ = 0.15 × peakGW`. Revisit when backfill catches up.
- **T2**. `δ = 0.20 × peakGW`. Anchored to the publisher's own stated precision. GGFR flare volumes, Ember annuals, and IRENA annuals each claim their data is within roughly ±20 % — we adopt the same envelope rather than understate.
- **T3**. `δ = 0.40 × peakGW`. The additional 20 percentage points (vs. T2) reflect the typical-shape profile assumption: for Sichuan, Xinjiang, Iceland we know the annual volume to within ±20 % from Ember/Orkustofnun, but the diurnal / seasonal shape is modelled rather than measured, so the peak-hour value inherits additional uncertainty.

## Why 2σ, why ±20 %, why ±40 %

A reviewer might reasonably ask whether these fractions are hand-picked. The short answer: they are, and the document is explicit about it. The longer answer:

- **2σ for T1.** A 95 % interval under a normal approximation is 1.96σ; rounding to 2 is standard in observational data publication (e.g. the FAIR-NUM-2019 conventions cited in `dataset/FAIR.md`). Curtailment distributions are not normal — they are right-skewed, and 2σ over-covers the left tail while under-covering extreme right-tail events. For the peak-GW point estimate this is a conservative choice (we accept slight over-coverage of the lower bound and slight under-coverage of the upper bound). We flag this explicitly rather than adopt a bootstrap interval that would be harder to reproduce from the archive.
- **±20 % for T2.** Matches the stated precision bands of the three anchor publishers we rely on. Ember's methodological notes for the Electricity Review call ±20 % a "useful planning accuracy". GGFR satellite flare volume is typically within ±15–25 %. IRENA's renewable statistics work at annual granularity and do not publish sub-annual variance at all.
- **±40 % for T3.** A doubling of the T2 envelope. The additional uncertainty source is the typical-shape profile. For Xinjiang (solar), we place the curtailment peak at UTC 06:20 (local solar noon); for Iceland and Sichuan (hydro), we assign monthly seasonal weights. Both are industry-typical approximations but neither is measured at hourly granularity — this is the "modelled" in T3-modelled.

If later work replaces any T3 region with measured hourly data, its tier transitions to T1 and the envelope narrows accordingly. The dataset schema explicitly records the tier per region so any consumer can filter to just T1 regions if they need tighter calibration.

## What the envelope covers — and what it does not

Covers:
- Measurement precision of the underlying TSO / publisher feed.
- For T3, profile-shape uncertainty at the hour-of-day level.
- For T1, observed year-over-year variance (implicitly: weather, policy, capacity changes).

Does not cover:
- Definitional differences between our series and a reference series (e.g., "spill" included or excluded, intra-hour clearing conventions, whether economic curtailment is counted). These are per-region narrative items in `docs/validation/<region>.md`.
- Missing-data windows (outage gaps in the upstream feed). These are tracked separately in `sourceStatus` and, where patching is applied, in `sourceNote`.
- Regions classified T4 (structural gap). We do not publish numbers for them.

## Downstream consumers

Every emitted `RegionData` row includes the three uncertainty fields when the region is in T1, T2, or T3. The parquet snapshot archive (`data/historical/curtailment_history.parquet`) is extended with matching `confidence_tier`, `uncertainty_low_gw`, `uncertainty_high_gw` columns (see `scripts/append_history.py`).

Dashboard tooltips surface the tier label (e.g. "±20 % — published annual anchor"). Figures colour-code points by tier so a reader can see at a glance how much of the global total is T1 vs. T2 vs. T3 (see `scripts/figures/fig4_tier_coverage.py` in the S3 deliverable).

## Version history

- **2026-04-24 (S2.v1)** — initial tier definitions, envelope fractions, methodology writeup. T1 bounds fall back to ±15 % until the HB backfill completes and 2σ calculations become available.
