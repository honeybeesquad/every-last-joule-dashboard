# Validation — SPP (`spp`)

Last updated: 2026-04-26 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `spp`
- **Country:** USA
- **Tier:** live
- **Kind:** mixed
- **Source:** EIA SPP wind+solar
- **Source URL:** [https://www.eia.gov/opendata/browser/electricity/rto/fuel-type-data](https://www.eia.gov/opendata/browser/electricity/rto/fuel-type-data)
- **Loader:** [`spp.json.ts`](../../src/data/spp.json.ts)
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** yes (per HB methodology §"Rate application over time")

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| 2020 | 13,289 | 3.311 | — | — | eia |
| 2021 | 13,412 | 3.729 | — | — | eia |
| 2022 | 13,288 | 4.316 | — | — | eia |
| 2023 | 13,368 | 4.283 | — | — | eia |
| 2024 | 13,945 | 4.417 | 3.000 | +47.2% | eia |
| 2025 | 14,421 | 4.511 | — | — | eia |
| 2026 | 3,961 | 1.627 | — | — | eia |

## Published anchors

- **TSO annual curtailment (latest published):** SPP ~3 TWh wind on ~75 TWh generation (2024 SoM)
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

The backfill for 2024 (4.417 TWh) significantly overreports against the latest published TSO anchor for SPP wind (3.000 TWh), resulting in a Δ% of +47.2%. This discrepancy is primarily definitional: the EIA source for SPP aggregates both wind and solar curtailment, while the published TSO anchor specifically refers to wind curtailment. Additionally, our backfill methodology includes energy 'spill' which may not be fully accounted for in the TSO's published figures.

For years 2020-2023 and 2025-2026, no comparable TSO annual curtailment figures are available, precluding a year-over-year reconciliation beyond 2024.

## Known limitations

- **Limited TSO Annual Data:** Published TSO annual curtailment figures are available only for 2024, limiting the multi-year reconciliation of backfill totals against external anchors.
- **Definitional Mismatch for TSO Anchor:** The available TSO anchor for 2024 specifically covers wind curtailment, whereas our EIA source combines both wind and solar, leading to an inherent definitional discrepancy in comparisons.
- **Backfill Start Year:** Due to EIA definitional shifts in reporting from BA-level to sub-BA detail prior to 2020, the backfill for SPP commences in 2020, excluding historical curtailment data for earlier periods even when available via the API.

## Links

- Loader source: [`spp.json.ts`](../../src/data/spp.json.ts)
- Backfill archive: `data/historical/backfill/*_spp_*.parquet` (7 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
