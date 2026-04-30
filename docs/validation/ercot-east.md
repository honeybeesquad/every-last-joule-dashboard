# Validation — ERCOT East (`ercot-east`)

Last updated: 2026-04-27 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `ercot-east`
- **Country:** USA
- **Tier:** live
- **Kind:** mixed
- **Source:** EIA / ERCOT (wind+solar)
- **Source URL:** [https://www.eia.gov/opendata/browser/electricity/rto/fuel-type-data](https://www.eia.gov/opendata/browser/electricity/rto/fuel-type-data)
- **Loader:** [`ercot.json.ts`](../../src/data/ercot.json.ts)
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** yes (per HB methodology §"Rate application over time")

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| 2020 | 13,665 | 1.933 | — | — | eia |
| 2021 | 13,721 | 2.204 | — | — | eia |
| 2022 | 14,002 | 2.567 | — | — | eia |
| 2023 | 13,861 | 2.692 | — | — | eia |
| 2024 | 15,754 | 2.986 | 3.000 | -0.5% | eia |
| 2025 | 15,228 | 3.318 | — | — | eia |
| 2026 | 4,632 | 1.160 | — | — | eia |

## Published anchors

- **TSO annual curtailment (latest published):** ERCOT ~8 TWh wind + ~0.8 TWh solar (2024, Potomac Economics SoM) × 34% East/Central share
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

The 2024 backfill total for ERCOT East wind and solar curtailment (2.986 TWh) shows strong alignment with the TSO-derived annual anchor (3.000 TWh, representing 34% of ERCOT's total wind+solar curtailment per Potomac Economics), with a negligible discrepancy of -0.5%. This indicates robust calibration for the most recent validated year.

For all other years (2020-2023, 2025, 2026), no directly comparable published TSO annual curtailment figures specific to ERCOT East wind and solar are available in the provided context. Therefore, a comprehensive year-over-year discrepancy analysis against external anchors is not feasible, and our backfill values for these periods represent the best estimate based on the applied methodology.

## Known limitations

*   **Scope Mismatch (Generation Type)**: This validation focuses exclusively on wind and solar curtailment, consistent with the EIA/ERCOT source. Broader ERCOT curtailment reports may encompass other generation types or economic curtailment, which are beyond the scope of this dataset.
*   **EIA Reporting Regime Change**: The backfill period for ERCOT East commences in 2020. Data prior to 2020 from EIA sources was not backfilled to avoid inconsistencies arising from significant definitional shifts and changes in reporting granularity (from BA-level to sub-BA detail) that occurred around 2019.
*   **Uniform Rate Application**: A single, flat calibration rate is applied uniformly across all backfilled years. While this approach shows strong alignment with the most recent TSO anchor, year-over-year changes in ERCOT's capacity mix or operational practices may introduce minor methodological drift for earlier years not supported by specific annual calibration rates.
*   **Limited External Anchors**: Only the 2024 TSO annual curtailment figure for ERCOT East wind and solar is available as a direct external anchor. This limits the ability to perform a year-over-year validation of our backfill against published figures across the entire historical period.
*   **Definitional Nuances**: Our curtailment calculation is based on generation multiplied by a derived rate. TSO figures may incorporate different definitional boundaries, such as the inclusion of "spill" or varying interpretations of economic curtailment, which are not explicitly differentiated in our methodology.

## Links

- Loader source: [`ercot.json.ts`](../../src/data/ercot.json.ts)
- Backfill archive: `data/historical/backfill/*_ercot-east_*.parquet` (7 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
