# Validation — Germany (`germany`)

Last updated: 2026-04-24 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `germany`
- **Country:** DEU
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
| 2020 | 26,334 | 8.944 | — | — | entsoe |
| 2021 | 26,276 | 8.039 | — | — | entsoe |
| 2022 | 26,277 | 8.731 | — | — | entsoe |
| 2023 | 26,280 | 9.054 | — | — | entsoe |
| 2024 | 26,348 | 9.417 | 23.200 | -59.4% | entsoe |
| 2025 | 26,280 | 9.586 | — | — | entsoe |
| 2026 | 8,169 | 3.610 | — | — | entsoe |

## Published anchors

- **TSO annual curtailment (latest published):** BNetzA 2024: ~19.5 TWh onshore wind, ~3.1 TWh offshore wind, ~0.6 TWh solar curtailment
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** BNetzA Monitoringbericht 2024; Bundesnetzagentur Redispatch report

## Discrepancy analysis

_Auto-generated placeholder. Backfill annual totals are populated above; compare against the TSO annual in the row for the matching year. Pending narrative pass to characterise any year-over-year drift and whether the discrepancy is definitional (e.g., we include spill, TSO doesn't) or methodological._

## Known limitations

No region-specific limitations recorded. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_germany_*.parquet` (7 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
