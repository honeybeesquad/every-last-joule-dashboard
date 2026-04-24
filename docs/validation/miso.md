# Validation — MISO (Midwest) (`miso`)

Last updated: 2026-04-24 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

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

_Auto-generated placeholder. Backfill annual totals are populated above; compare against the TSO annual in the row for the matching year. Pending narrative pass to characterise any year-over-year drift and whether the discrepancy is definitional (e.g., we include spill, TSO doesn't) or methodological._

## Known limitations

No region-specific limitations recorded. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: [`miso.json.ts`](../../src/data/miso.json.ts)
- Backfill archive: `data/historical/backfill/*_miso_*.parquet` (7 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
