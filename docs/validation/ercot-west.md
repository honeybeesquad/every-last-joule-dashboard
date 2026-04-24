# Validation — ERCOT West (`ercot-west`)

Last updated: 2026-04-24 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

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

_Auto-generated placeholder. Backfill annual totals are populated above; compare against the TSO annual in the row for the matching year. Pending narrative pass to characterise any year-over-year drift and whether the discrepancy is definitional (e.g., we include spill, TSO doesn't) or methodological._

## Known limitations

West/East split (66/34) is illustrative only — no public ERCOT zonal dispatch-down series was found as of 2026-04. Rate calibration is ERCOT-wide.

## Links

- Loader source: [`ercot.json.ts`](../../src/data/ercot.json.ts)
- Backfill archive: `data/historical/backfill/*_ercot-west_*.parquet` (7 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
