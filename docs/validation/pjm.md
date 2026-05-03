# Validation — PJM (`pjm`)

Last updated: 2026-05-03 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `pjm`
- **Country:** USA
- **Tier:** live
- **Kind:** mixed
- **Source:** EIA PJM wind+solar
- **Source URL:** [https://www.eia.gov/opendata/browser/electricity/rto/fuel-type-data](https://www.eia.gov/opendata/browser/electricity/rto/fuel-type-data)
- **Loader:** [`pjm.json.ts`](../../src/data/pjm.json.ts)
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** yes (per HB methodology §"Rate application over time")

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| 2020 | 15,710 | 0.523 | — | — | eia |
| 2021 | 16,027 | 0.705 | — | — | eia |
| 2022 | 17,294 | 0.820 | — | — | eia |
| 2023 | 16,867 | 0.814 | — | — | eia |
| 2024 | 17,347 | 1.016 | — | — | eia |
| 2025 | 17,193 | 1.259 | — | — | eia |
| 2026 | 5,308 | 0.471 | — | — | eia |

## Published anchors

- **TSO annual curtailment (latest published):** PJM small but growing curtailment, concentrated in NJ/MD/VA solar (2024 PJM State of the Market)
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** PJM Renewable Integration Study 2024; PJM Markets Monitor 2024

## Discrepancy analysis

Specific published annual TSO curtailment figures for PJM are not available within the provided context for direct reconciliation against the backfill annual totals. The backfill data, however, indicates a consistent increase in curtailment, growing from 0.523 TWh in 2020 to 1.259 TWh in 2025. This observed trajectory aligns with general statements regarding "small but growing curtailment" in the PJM region, as noted in the 2024 PJM State of the Market.

## Known limitations

- **EIA definitional shift**: The backfill period for PJM begins in 2020. This start year is necessitated by a definitional shift in EIA reporting from BA-level to sub-BA detail in 2019. Pre-2020 data from EIA is not backfilled to avoid mixing disparate reporting regimes.
- **Uniform rate application**: The backfill methodology applies a single calibration rate uniformly across all backfilled years. While this approach is cross-checked against published annual curtailment totals where available, it does not dynamically account for year-over-year drift in curtailment rates that may arise from changes in capacity mix or operational policies.

## Links

- Loader source: [`pjm.json.ts`](../../src/data/pjm.json.ts)
- Backfill archive: `data/historical/backfill/*_pjm_*.parquet` (7 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
