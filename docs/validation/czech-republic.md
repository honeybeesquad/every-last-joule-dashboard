# Validation — Czech Republic (`czech-republic`)

Last updated: 2026-04-24 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `czech-republic`
- **Country:** CZE
- **Tier:** live
- **Kind:** mixed
- **Source:** ENTSO-E CEPS
- **Source URL:** [https://transparency.entsoe.eu/](https://transparency.entsoe.eu/)
- **Loader:** _(no single-file loader — see multi-region source)_
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** yes (per HB methodology §"Rate application over time")

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| 2020 | 14,553 | 0.050 | — | — | entsoe |
| 2021 | 14,527 | 0.050 | — | — | entsoe |
| 2022 | 14,555 | 0.054 | — | — | entsoe |
| 2023 | 14,542 | 0.063 | — | — | entsoe |
| 2024 | 14,488 | 0.085 | 0.050 | +70.2% | entsoe |
| 2025 | 14,322 | 0.100 | — | — | entsoe |
| 2026 | 4,276 | 0.026 | — | — | entsoe |

## Published anchors

- **TSO annual curtailment (latest published):** ČEPS 2024 RES curtailment <0.1 TWh (treated as 0.05 TWh midpoint for Δ% calc)
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_Auto-generated placeholder. Backfill annual totals are populated above; compare against the TSO annual in the row for the matching year. Pending narrative pass to characterise any year-over-year drift and whether the discrepancy is definitional (e.g., we include spill, TSO doesn't) or methodological._

## Known limitations

No region-specific limitations recorded. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_czech-republic_*.parquet` (7 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
