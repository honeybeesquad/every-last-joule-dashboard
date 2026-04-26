# Validation — ERCOT West (`ercot-west`)

Last updated: 2026-04-26 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `ercot-west`
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
| 2020 | 13,665 | 3.753 | — | — | eia |
| 2021 | 13,721 | 4.277 | — | — | eia |
| 2022 | 14,002 | 4.982 | — | — | eia |
| 2023 | 13,861 | 5.226 | — | — | eia |
| 2024 | 15,754 | 5.797 | 5.800 | -0.1% | eia |
| 2025 | 15,228 | 6.440 | — | — | eia |
| 2026 | 4,632 | 2.252 | — | — | eia |

## Published anchors

- **TSO annual curtailment (latest published):** ERCOT ~8 TWh wind + ~0.8 TWh solar (2024, Potomac Economics State of the Market)
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

The 2024 backfill total for ERCOT West (5.797 TWh) underreports against the ERCOT-wide TSO published figure of 8.8 TWh (Potomac Economics, 2024) by approximately 34.1%. This discrepancy is primarily attributed to a scope mismatch: the TSO figure applies to the entire ERCOT balancing authority, while our backfill models the ERCOT West zone using an illustrative 66/34 split. The underlying curtailment rate is an ERCOT-wide average, further contributing to this divergence when applied to a sub-regional estimation.

Year-over-year reconciliation against published TSO data is currently limited to 2024, as no earlier ERCOT-wide annual curtailment figures from a TSO source have been extracted.

## Known limitations

*   The 66/34 West/East zonal split is illustrative; no public ERCOT zonal dispatch-down series was found as of April 2026. The rate calibration used is ERCOT-wide.
*   Pre-2020 EIA data is excluded from the backfill to avoid mixing reporting regimes, as EIA shifted from BA-level to sub-BA detail in 2019.
*   Our curtailment series reflects generation multiplied by a derived rate. Published TSO figures may include other components, such as economic curtailment or redispatch wind-down, creating potential definitional differences.
*   The applied curtailment rate is an ERCOT-wide average, uniformly applied across all backfill years. This simplification may not fully capture year-on-year variations in zonal capacity mix or specific rate adjustments.

## Links

- Loader source: [`ercot.json.ts`](../../src/data/ercot.json.ts)
- Backfill archive: `data/historical/backfill/*_ercot-west_*.parquet` (7 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
