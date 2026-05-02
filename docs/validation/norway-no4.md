# Validation — Norway NO4 (Tromsø) (`norway-no4`)

Last updated: 2026-05-02 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `norway-no4`
- **Country:** NOR
- **Tier:** live
- **Kind:** mixed
- **Source:** ENTSO-E NO4 hydro+wind (export-constrained north; former n-norway)
- **Source URL:** [https://transparency.entsoe.eu/](https://transparency.entsoe.eu/)
- **Loader:** [`norway.json.ts`](../../src/data/norway.json.ts)
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** yes (per HB methodology §"Rate application over time")

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| 2020 | 17,559 | 1.326 | — | — | entsoe |
| 2021 | 17,515 | 1.492 | — | — | entsoe |
| 2022 | 17,518 | 1.659 | — | — | entsoe |
| 2023 | 17,510 | 1.473 | — | — | entsoe |
| 2024 | 17,565 | 1.196 | — | — | entsoe |
| 2025 | 17,520 | 1.419 | — | — | entsoe |
| 2026 | 5,448 | 0.464 | — | — | entsoe |

## Published anchors

- **TSO annual curtailment (latest published):** No directly-comparable broad-scope anchor available. Statnett, NVE, RME, and SSB do NOT publish per-price-area all-fuel curtailment in TWh. The narrow Statnett wind-only figure (~0.3 TWh 2024) excludes hydro spill, which dominates curtailment in this export-constrained northernmost zone (combined NO3+NO4 reservoirs above previously-recorded maximum throughout 2024 per SSB). Loader src/data/norway.json.ts uses ENTSO-E A75 B12 hydro + B19 wind × 6% rate, matching the methodology §2 broad-curtailment framing. Treat loader output as the best-available public estimate; this zone is excluded from |Δ%| calibration corpus pending publication of broad-scope anchor.
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** Narrow scope: Statnett NO4 ~0.3 TWh wind-only curtailment 2024 (export-constrained north) — NOT a valid comparator for the broad-scope hydro+wind loader.

## Discrepancy analysis

The 2024 backfill total for `norway-no4` of 1.196 TWh exhibits a significant positive discrepancy of +298.7% when compared against the Statnett NO4 published wind curtailment of ~0.3 TWh. This difference is primarily definitional: the backfill model, derived from ENTSO-E NO4, captures both hydro and wind curtailment, while the published TSO anchor explicitly refers only to wind curtailment. This suggests the TSO figure excludes components such as hydro spill or other forms of generation curtailment that are included in our model.

For other years where a TSO anchor is not yet available, a direct comparison is not feasible. The observed annual totals vary across the backfill years, which may indicate year-over-year shifts in generation mix or curtailment events not captured by a single, uniform calibration rate.

## Known limitations

- The backfill for `norway-no4` applies a uniform curtailment rate across all backfilled years. This is a deliberate simplification, as actual TSO curtailment rates are subject to year-to-year drift due to evolving capacity mixes and policy changes.
- ENTSO-E data feeds, which supply the upstream data for `norway-no4`, are prone to reporting latency holes. These can manifest as 1-3 month lags during reporting system outages, though the backfill process is designed to tolerate gaps up to 10% per year.
- As discussed in the discrepancy analysis, definitional differences exist between the model's calculated curtailment series (which includes both hydro and wind) and external published TSO figures (which may be specific to wind only).
- The curtailment rates applied to `norway-no4` are considered illustrative floor/ceiling values rather than measured annual calibration, as a citable 2023/2024 curtailed-energy total for this region was not identified during the ENTSO-E rate audit.

## Links

- Loader source: [`norway.json.ts`](../../src/data/norway.json.ts)
- Backfill archive: `data/historical/backfill/*_norway-no4_*.parquet` (7 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
