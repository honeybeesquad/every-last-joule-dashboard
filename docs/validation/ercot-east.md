# Validation — ERCOT East (`ercot-east`)

Last updated: 2026-04-24 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

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

_Auto-generated placeholder. Backfill annual totals are populated above; compare against the TSO annual in the row for the matching year. Pending narrative pass to characterise any year-over-year drift and whether the discrepancy is definitional (e.g., we include spill, TSO doesn't) or methodological._

## Known limitations

See ercot-west.

## Links

- Loader source: [`ercot.json.ts`](../../src/data/ercot.json.ts)
- Backfill archive: `data/historical/backfill/*_ercot-east_*.parquet` (7 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
