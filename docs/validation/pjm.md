# Validation — PJM (`pjm`)

Last updated: 2026-04-24 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

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

## Published anchors

- **TSO annual curtailment (latest published):** PJM small but growing curtailment, concentrated in NJ/MD/VA solar (2024 PJM State of the Market)
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** PJM Renewable Integration Study 2024; PJM Markets Monitor 2024

## Discrepancy analysis

_Auto-generated placeholder. Backfill annual totals are populated above; compare against the TSO annual in the row for the matching year. Pending narrative pass to characterise any year-over-year drift and whether the discrepancy is definitional (e.g., we include spill, TSO doesn't) or methodological._

## Known limitations

No region-specific limitations recorded. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: [`pjm.json.ts`](../../src/data/pjm.json.ts)
- Backfill archive: `data/historical/backfill/*_pjm_*.parquet` (6 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
