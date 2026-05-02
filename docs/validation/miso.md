# Validation — MISO (Midwest) (`miso`)

Last updated: 2026-05-02 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `miso`
- **Country:** USA
- **Tier:** live
- **Kind:** mixed
- **Source:** EIA MISO wind+solar
- **Source URL:** [https://www.eia.gov/opendata/browser/electricity/rto/fuel-type-data](https://www.eia.gov/opendata/browser/electricity/rto/fuel-type-data)
- **Loader:** [`miso.json.ts`](../../src/data/miso.json.ts)
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** yes (per HB methodology §"Rate application over time")

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| 2020 | 14,509 | 5.747 | — | — | eia |
| 2021 | 15,575 | 6.540 | — | — | eia |
| 2022 | 15,675 | 8.176 | — | — | eia |
| 2023 | 16,122 | 7.592 | — | — | eia |
| 2024 | 16,349 | 8.437 | 5.500 | +53.4% | eia |
| 2025 | 17,297 | 9.107 | — | — | eia |
| 2026 | 5,398 | 3.556 | — | — | eia |

## Published anchors

- **TSO annual curtailment (latest published):** MISO ~5 TWh wind + ~0.5 TWh solar (2024 State of the Market, Potomac Economics)
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

The backfill annual total for 2024 of 8.437 TWh exceeds the published MISO anchor of 5.500 TWh (2024 State of the Market, Potomac Economics) by 53.4%. This significant over-reporting is primarily attributed to a definitional difference in what constitutes "curtailment." Our reconstruction, based on generation multiplied by a derived rate, captures physical curtailment and potentially other forms of generation constraint (e.g., spill) as seen in the EIA data. The Potomac Economics report, however, may employ a narrower definition that excludes certain categories, such as economic curtailment or specific redispatch events, which are not visible in our upstream source data from EIA. No TSO annual anchors are available for other backfill years to assess year-over-year drift.

## Known limitations

-   The backfill exclusively uses EIA data from 2020 onwards, avoiding pre-2020 data to prevent mixing regimes due to EIA's definitional shift from BA-level to sub-BA reporting in 2019. This ensures consistency within the backfilled period.
-   As detailed in `docs/methodology/historical-backfill.md`, our backfill approach uses a uniform calibration rate across all years. While this simplifies the model, it does not account for year-over-year drift in TSO curtailment rates due to evolving capacity mixes or policy changes, although significant discrepancies are flagged (e.g., 2024).
-   Cross-cutting limitations common to all backfilled regions are documented in `docs/methodology/historical-backfill.md` §"Known limitations".

## Links

- Loader source: [`miso.json.ts`](../../src/data/miso.json.ts)
- Backfill archive: `data/historical/backfill/*_miso_*.parquet` (7 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
