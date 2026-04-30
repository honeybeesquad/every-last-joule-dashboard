# Uncertainty methodology

Last updated: 2026-04-26 · Sprint: S2 + B4 Option B (CODEX-7) · Implements gap closure plan §S2 and the B4 Option B subdivision locked in `docs/proposals/b4-option-b-decision.md`

## Scope

Every emitted curtailment value — hourly profile and derived `peakGW` — carries an uncertainty envelope and a confidence tier. This document states (1) how each tier is assigned, (2) how the envelope is calculated, and (3) which assumptions drive the magnitude of the envelope. The code that implements this is `src/lib/uncertainty.ts`; the schema addition is documented in `dataset/SCHEMA.md`.

The goal is to give a reader enough information to either accept the published figure or, if they have a better calibration, replace it with theirs — and to do so reproducibly. We make no claim of a formally-propagated error model in the statistical sense; the tier fractions are conservative published-source-implied envelopes, informed where possible by multi-year observed variance.

## Tier definitions

The live-feed tier was subdivided into three sub-tiers in CODEX-7 (locked 2026-04-25 per `docs/proposals/b4-option-b-decision.md`) once the post-B1 rerun made it clear that "live feed plus rate" hides three operationally distinct calibration provenances. The legacy `T1-live-TSO` label is retained as an alias of T1a-live-tso for pre-2026-04-25 snapshots and reads as T1a for envelope sizing.

| Tier | Condition | Envelope model | Typical ± on peakGW |
|---|---|---|---|
| **T1a-live-tso** | `Region.tier === "live"` — live feed from a TSO/ISO/operator *and* a calibration rate published by the same jurisdiction's TSO or regulator (own-jurisdiction anchor) | 2σ from the 5-year backfill archive when available (`σ` = std deviation of annual peakGW across the backfill years), otherwise fallback ±15 % of current-snapshot peakGW | 5–15 % |
| **T1b-live-domestic-anchored** | `Region.tier === "live-domestic-anchored"` — live feed plus a rate sourced from a domestic statistical agency or modelled share-split of a national anchor (rate scope and feed scope do not coincide) | ±50 % × peakGW (empirical, post-B1 rerun P67 across the four T1b zones) | ±50 % |
| **T1c-live-neighbour-anchored** | `Region.tier === "live-neighbour-anchored"` — live feed plus a rate extrapolated from a neighbouring zone (no domestic rate published) | ±35.5 % × peakGW (empirical Switzerland residual against Czech CEPS rate) | ±35.5 % |
| **T1-live-TSO** *(legacy alias)* | Pre-2026-04-25 snapshots emitted before the subdivision; equivalent to T1a-live-tso for envelope sizing | Same as T1a (2σ from backfill, fallback ±15 %) | 5–15 % |
| **T2-annual-calibrated** | `Region.tier === "flare"` **or** (`Region.tier === "static"` and `profileKind === "flat"`) — anchored to a published annual total (GGFR, Ember, IRENA, TSO annual report) with no shape modelling | ±20 % × peakGW | ±20 % |
| **T3-modelled** | `Region.tier === "static"` and `profileKind ∈ { "solar", "wind", "mixed", "hydro-seasonal", "overnight" }` — static annual anchor combined with a typical-shape diurnal, seasonal, or fuel-mix profile | ±40 % × peakGW | ±40 % |
| **T4-structural-gap** | No hourly claim made for this region | n/a | n/a |

T4 is reserved — structural-gap regions are documented in `docs/known-limitations.md` and do not appear as rows in `RegionData`. Tier derivation is implemented in `uncertainty.ts::deriveTier` and is deterministic — given a loader id and its profile kind, the tier is fixed.

**Current per-tier population** (emitted by `npx tsx scripts/tally-tiers.ts` on 2026-04-26): T1a = 63 regions, T1b = 4 (italy-sardinia, italy-north-zone, netherlands, baltics), T1c = 1 (switzerland), T2 = 2, T2-flare = 4, T3 = 54, total 128.

**Why T1b and T1c skip the 2σ shortcut.** T1a regions have a single coherent calibration: the live feed and the curtailment rate measure the same dispatch series in the same jurisdiction, so 5-year σ on the live feed is a faithful empirical envelope. T1b and T1c carry a *systematic* anchor-scope offset that the live series cannot self-detect — Italy-Sardinia's bidding-zone live feed against a national-anchor zone-split, Switzerland against Czech rates — and the 2σ shortcut would understate the envelope. The implementation in `computeBounds` therefore applies the empirical fractional envelope (±50 % / ±35.5 %) to T1b and T1c regardless of `observedStdGW`, and reserves the 2σ branch for T1a (and the legacy T1-live-TSO alias) only.

**Note on "T2 flare" labelling.** The paper's Figure 4 coverage map and `docs/paper/04-technical-validation.md §4.5` present flare regions (Permian, West Siberia, South Iraq, East Saudi) as a separately-coloured "T2 flare" bucket so readers can visually distinguish the flat 24/7 base-load shape from dispatch-down curtailment. The envelope model is the same ±20 % as T2-annual-calibrated — the split is presentational, not an additional uncertainty tier. `deriveTier` returns the single label `T2-annual-calibrated` for both groups.

## Envelope calculation

The implementation emits three fields on every `RegionData`:

- `confidenceTier` — the label from the table above.
- `uncertaintyLowGW` — lower bound on `peakGW`. `max(0, peakGW - δ)`.
- `uncertaintyHighGW` — upper bound on `peakGW`. `max(peakGW, peakGW + δ)`.

where the half-width `δ` is chosen per tier:

- **T1a with backfill**. `δ = 2σ`, where σ is the standard deviation of annual-peak curtailment across the backfill years (2020–2026 where all years are present). This is the strongest model we publish — the envelope reflects empirically observed year-over-year variance for that specific region, not a blanket fraction.
- **T1a without backfill** (loader exists but backfill has not completed yet, or the region is new). `δ = 0.15 × peakGW`. Revisit when backfill catches up. The legacy `T1-live-TSO` alias takes the same path.
- **T1b**. `δ = 0.50 × peakGW`. Empirical from the post-B1 rerun on 2026-04-26 — the P67 fractional residual across italy-sardinia, italy-north-zone, netherlands, and baltics measured against their respective domestic stat-agency anchors was 0.50. The 2σ branch is intentionally bypassed (see "Why T1b and T1c skip the 2σ shortcut" above).
- **T1c**. `δ = 0.355 × peakGW`. Empirical residual of Switzerland's reconstructed total against the Czech-CEPS-rate-projected total over the post-B1 rerun window. Like T1b, the 2σ branch is bypassed because the cross-border generation-mix bias is systematic.
- **T2**. `δ = 0.20 × peakGW`. Anchored to the publisher's own stated precision. GGFR flare volumes, Ember annuals, and IRENA annuals each claim their data is within roughly ±20 % — we adopt the same envelope rather than understate.

  **Note on T2 constant-rate assumption.** T2-tier calibration applies a single, time-invariant rate per region and per PSR-type, sourced from the regulator publications cited in `src/data/entsoe.json.ts` line-comments and summarised in `docs/methodology/entsoe-rates.md`. The rate is constant across the 30-day rolling window the dashboard surfaces — no monthly weighting, no seasonal adjustment, and no within-window time variation. This is a known approximation: intra-year curtailment-rate concentration (for example, URE's 2024 Polish PV redispatch was heavily concentrated May–August) is not captured by the static rate. The ±20% T2 envelope is intended to absorb this drift; the rate itself is reviewed against TSO-published annuals in the per-region validation MDs (`docs/validation/<region>.md`).
- **T3**. `δ = 0.40 × peakGW`. The additional 20 percentage points (vs. T2) reflect the typical-shape profile assumption. For the 60 T3 regions in v0.5 (Ireland Republic + Northern, Peru, South Africa reachability probes, Chinese provinces, most of South Asia, Africa, the Middle East outside flare, Latin America outside Brazil/Atacama, Hawaii) we know the annual volume to within ±20 % from Ember/IRENA/regulator anchors, but the diurnal / seasonal / fuel-mix shape is modelled (solar cosine, wind broad-overnight, hydro monthly-seasonal, mixed fuel-share, geothermal-overnight) rather than measured at hourly granularity, so the peak-hour value inherits additional uncertainty.

## Why 2σ, why ±15 %, why ±50 %, why ±35.5 %, why ±20 %, why ±40 %

A reviewer might reasonably ask whether these fractions are hand-picked. The short answer: they are, and the document is explicit about it. The longer answer:

- **2σ for T1a.** A 95 % interval under a normal approximation is 1.96σ; rounding to 2 is standard in observational data publication (e.g. the FAIR-NUM-2019 conventions cited in `dataset/FAIR.md`). Curtailment distributions are not normal — they are right-skewed, and 2σ over-covers the left tail while under-covering extreme right-tail events. For the peak-GW point estimate this is a conservative choice (we accept slight over-coverage of the lower bound and slight under-coverage of the upper bound). We flag this explicitly rather than adopt a bootstrap interval that would be harder to reproduce from the archive.
- **±15 % fallback for T1a (and legacy T1-live-TSO).** Until the 5-year backfill is complete for a given region, the fallback is the ±15 % representative variance observed in the regions where backfill *has* completed (CAISO, ERCOT, NYISO over 2020–2024). It does not depend on `peakGW` magnitude; it scales linearly. This is a deliberately conservative pre-backfill placeholder.
- **±50 % for T1b — empirical, post-B1 rerun (2026-04-26).** The four T1b zones (italy-sardinia, italy-north-zone, netherlands, baltics) were reconstructed in the post-B1 rerun against their respective domestic stat-agency anchors (TERNA national totals split by zone-share for the two Italian zones; CBS national renewables share for the Netherlands; the joint Baltic anchor). The fractional residuals — `|reconstructed − anchor| / anchor` — clustered between 0.40 and 0.55 across the four zones; the 67th-percentile value was 0.50, which we adopt as the envelope. The systematic source of the offset is anchor-scope mismatch: the rate's jurisdiction (national, joint-Baltic) does not coincide with the live feed's jurisdiction (one bidding zone, one country, three countries respectively). The provenance and cited anchor numbers are in `docs/proposals/b4-option-b-decision.md §"Post-B1 rerun"`.
- **±35.5 % for T1c — empirical, Switzerland residual against Czech rate.** The single T1c zone is Switzerland, where Swissgrid publishes a live curtailment feed but no domestic curtailment rate; we use the Czech CEPS rate as the closest neighbour. Over the post-B1 rerun window, Switzerland's reconstructed total against the Czech-rate-projected total had a fractional residual of 0.355. T1c is structurally a slot — additional zones may move into it as more domestic anchors are audited — and the band is sized from a single residual rather than a P67 cohort, which is reflected in its narrower-than-T1b magnitude (the closer-proxy neighbour rate carries less anchor-scope offset than a domestic-stat-agency split).
- **±20 % for T2.** Matches the stated precision bands of the three anchor publishers we rely on. Ember's methodological notes for the Electricity Review call ±20 % a "useful planning accuracy". GGFR satellite flare volume is typically within ±15–25 %. IRENA's renewable statistics work at annual granularity and do not publish sub-annual variance at all.
- **±40 % for T3.** A doubling of the T2 envelope. The additional uncertainty source is the typical-shape profile. Five shape families are in use across the 60 T3 regions: `solar` (Gaussian peak at local solar noon — Xinjiang, Qinghai, the Middle East fallbacks); `wind` (broad-overnight — Inner Mongolia, Kazakhstan, Ireland Republic, Northern Ireland); `hydro-seasonal` (monthly weights, near-flat diurnal — Iceland, Peru, Sichuan, Tibet, Yunnan, Russia European grid); `mixed` (capacity-weighted blend — Gansu, Ningxia, South Africa); `overnight` (geothermal venting window — Kenya, Hawaii). All are industry-typical approximations but none is measured at hourly granularity — this is the "modelled" in T3-modelled.

If later work replaces any T3 region with measured hourly data, its tier transitions to T1a/T1b/T1c (depending on the calibration provenance) and the envelope narrows accordingly. The dataset schema explicitly records the tier per region so any consumer can filter to just T1a regions if they need tighter calibration, or to the union of T1a/T1b/T1c if they want all live-feed-backed regions regardless of anchor scope.

## What the envelope covers — and what it does not

Covers:
- Measurement precision of the underlying TSO / publisher feed.
- For T3, profile-shape uncertainty at the hour-of-day level.
- For T1a, observed year-over-year variance from the 5-year backfill (implicitly: weather, policy, capacity changes).
- For T1b/T1c, the systematic anchor-scope offset measured against published domestic or neighbour anchors in the post-B1 rerun.

Does not cover:
- Definitional differences between our series and a reference series (e.g., "spill" included or excluded, intra-hour clearing conventions, whether economic curtailment is counted). These are per-region narrative items in `docs/validation/<region>.md`.
- Missing-data windows (outage gaps in the upstream feed). These are tracked separately in `sourceStatus` and, where patching is applied, in `sourceNote`.
- Regions classified T4 (structural gap). We do not publish numbers for them.

## Downstream consumers

Every emitted `RegionData` row includes the three uncertainty fields when the region is in T1, T2, or T3. The parquet snapshot archive (`data/historical/curtailment_history.parquet`) is extended with matching `confidence_tier`, `uncertainty_low_gw`, `uncertainty_high_gw` columns (see `scripts/append_history.py`).

Dashboard tooltips surface the tier label (e.g. "±20 % — published annual anchor"). Figures colour-code points by tier so a reader can see at a glance how much of the global total is T1 vs. T2 vs. T3 (see `scripts/validation/figure4_coverage_map.py`).

## Version history

- **2026-04-24 (S2.v1)** — initial tier definitions, envelope fractions, methodology writeup. T1 bounds fall back to ±15 % until the HB backfill completes and 2σ calculations become available.
- **2026-04-26 (CODEX-7, B4 Option B)** — T1 subdivided into T1a-live-tso (±15 % / 2σ), T1b-live-domestic-anchored (±50 % empirical), and T1c-live-neighbour-anchored (±35.5 % empirical). The T1b/T1c empirical envelopes replace the original ±20–25 % / ±30–40 % provisional bands proposed in the B4 Option B decision doc — the post-B1 rerun's per-zone residuals against published anchors were wider than the pre-rerun analytic estimate. Legacy `T1-live-TSO` label retained as an alias of T1a for pre-2026-04-25 snapshots. The 2σ shortcut applies only to T1a (and the legacy alias); T1b/T1c always use the empirical fractional envelope. Implementation: `src/lib/uncertainty.ts`. Per-zone tier resolution at the cache boundary: `src/lib/resilient.ts::enrichWithTier`.
