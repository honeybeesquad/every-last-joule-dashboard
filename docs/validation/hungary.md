# Validation — Hungary (`hungary`)

Last updated: 2026-04-27 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `hungary`
- **Country:** HUN
- **Tier:** live
- **Kind:** mixed
- **Source:** ENTSO-E MAVIR
- **Source URL:** [https://transparency.entsoe.eu/](https://transparency.entsoe.eu/)
- **Loader:** _(no single-file loader — see multi-region source)_
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** yes (per HB methodology §"Rate application over time")

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| 2020 | 14,013 | 0.054 | — | — | entsoe |
| 2021 | 13,898 | 0.078 | — | — | entsoe |
| 2022 | 14,749 | 0.098 | — | — | entsoe |
| 2023 | 15,015 | 0.138 | — | — | entsoe |
| 2024 | 15,888 | 0.177 | 0.150 | +18.0% | entsoe |
| 2025 | 17,167 | 0.210 | — | — | entsoe |
| 2026 | 5,448 | 0.053 | — | — | entsoe |

## Published anchors

- **TSO annual curtailment (latest published):** MAVIR 2024 RES curtailment ~0.15 TWh (solar dominant)
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

The 2024 backfill total of 0.177 TWh shows an +18.0% over-reporting against the MAVIR 2024 RES curtailment anchor of 0.150 TWh. This discrepancy is attributed to rate over-calibration, as the applied solar (3.0%) and wind (1.0%) curtailment rates for Hungary are acknowledged placeholders. The ENTSO-E rate audit found no citable 2023/2024 annual curtailed energy total for Hungary, indicating that the rates are not grounded in specific TSO publications for this period.

## Known limitations

*   The applied curtailment rates for Hungary (solar 3.0%, wind 1.0%) are placeholders, as no citable 2023/2024 annual curtailed-energy total was found for MAVIR. These rates should be treated as illustrative floor/ceiling values rather than measured annual calibration.
*   Although the region is classified as `Tier: live`, the absence of a documented calibration source for the applied rates means the uncertainty envelope relies on the general T1 fallback of ±15% of current-snapshot peakGW, rather than empirically observed year-over-year variance.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_hungary_*.parquet` (7 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
