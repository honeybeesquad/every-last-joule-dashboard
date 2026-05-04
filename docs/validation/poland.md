# Validation — Poland (`poland`)

Last updated: 2026-05-04 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `poland`
- **Country:** POL
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
| 2020 | 12,806 | 0.138 | — | — | entsoe |
| 2021 | 14,753 | 0.238 | — | — | entsoe |
| 2022 | 14,293 | 0.419 | — | — | entsoe |
| 2023 | 14,205 | 0.573 | — | — | entsoe |
| 2024 | 14,082 | 0.726 | 0.749 | -3.0% | entsoe |
| 2025 | 13,848 | 0.783 | — | — | entsoe |
| 2026 | 4,162 | 0.226 | — | — | entsoe |

## Published anchors

- **TSO annual curtailment (latest published):** URE 2024 redispatch report: 621 GWh PV + 128 GWh wind non-market RES reductions = 0.749 TWh. The number the rates in src/data/entsoe.json.ts were calibrated to. Broader PSE 'redispatch' ~1.5 TWh is a different scope.
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

The 2024 backfill annual total of 0.726 TWh is 3.1% lower than the 0.749 TWh reported in URE's 2024 redispatch report (597.26 GWh PV + 24.12 GWh PV DSO + 125.1 GWh Wind + 2.8 GWh Wind DSO). This minor discrepancy is likely definitional, stemming from subtle differences in the scope of "redispatch" as defined by the source versus the aggregated curtailment calculated from our generation-times-rate methodology.

For all other backfill years (2020-2023, 2025-2026), no equivalent TSO annual curtailment figures are publicly available to conduct a direct comparison. Consequently, the year-over-year drift in backfill totals for these periods cannot be directly cross-referenced against published anchors.

## Known limitations

*   The current loader for Poland calculates curtailment by applying static rates to observed generation data. The existence of a more direct ENTSO-E API product (`documentType=A77`) for "Curtailed Renewable Energy" implies that actual hourly curtailment values could be directly captured, but this is not yet implemented.
*   Static curtailment rates, although grounded in the URE 2024 redispatch report for the current year, are applied uniformly across all backfill years (2020-2026). This approach does not account for year-over-year changes in capacity mix, grid topology, or operational policies that might cause actual curtailment rates to drift in non-2024 periods.
*   With the exception of 2024, no TSO-published annual curtailment totals are available to validate the backfill figures for other years (2020-2023, 2025-2026), limiting direct year-over-year verification.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_poland_*.parquet` (7 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
