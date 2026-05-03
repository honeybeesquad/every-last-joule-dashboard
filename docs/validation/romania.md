# Validation — Romania (`romania`)

Last updated: 2026-05-03 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `romania`
- **Country:** ROU
- **Tier:** live
- **Kind:** mixed
- **Source:** ENTSO-E
- **Source URL:** [https://transparency.entsoe.eu/](https://transparency.entsoe.eu/)
- **Loader:** _(no single-file loader — see multi-region source)_
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** yes (per HB methodology §"Rate application over time")

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| 2020 | 13,587 | 0.225 | — | — | entsoe |
| 2021 | 13,720 | 0.214 | — | — | entsoe |
| 2022 | 13,647 | 0.228 | — | — | entsoe |
| 2023 | 13,615 | 0.245 | — | — | entsoe |
| 2024 | 13,716 | 0.242 | — | — | entsoe |
| 2025 | 13,505 | 0.256 | — | — | entsoe |
| 2026 | 4,077 | 0.089 | — | — | entsoe |

## Published anchors

- **TSO annual curtailment (latest published):** Transelectrica 2024 renewable curtailment low (grid-capacity-driven)
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

The multi-year backfill totals for Romania, derived from ENTSO-E actual generation and applied curtailment rates, currently lack a directly comparable official TSO annual curtailment anchor. As noted in the ENTSO-E rate audit (`docs/methodology/entsoe-rates.md`), no citable 2023 or 2024 curtailed-energy total for Romania was identified from Transelectrica/ANRE public materials. Consequently, the `Δ %` column in the "Multi-year backfill annual totals" table is unpopulated, preventing a direct quantitative discrepancy analysis against published figures. The solar (B16) and wind (B19) curtailment rates applied are acknowledged placeholders, further limiting the ability to characterize year-over-year drift or reconcile with external benchmarks.

## Known limitations

*   The curtailment rates applied for Romania's solar (B16) and wind (B19) generation are based on acknowledged placeholder values. The ENTSO-E rate audit (`docs/methodology/entsoe-rates.md`) indicates that no citable 2023 or 2024 annual curtailed-energy total was found from Transelectrica/ANRE public materials.
*   While Romania is classified as `T1-live-TSO` due to its live ENTSO-E loader, the absence of a directly citable annual curtailment anchor means the absolute magnitude of reported curtailment relies on these placeholder rates.
*   A future audit could investigate the feasibility of using ENTSO-E's A77 "Curtailed Renewable Energy" API product for Romania, which may provide measured hourly data and allow for a more grounded substitution of the current rate-based modelling.
*   See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes on the historical backfill methodology.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_romania_*.parquet` (7 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
