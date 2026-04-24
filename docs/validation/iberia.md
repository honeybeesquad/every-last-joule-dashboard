# Validation — Iberia (`iberia`)

Last updated: 2026-04-24 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `iberia`
- **Country:** ESP
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
| 2020 | 16,345 | 6.937 | — | — | entsoe |
| 2021 | 16,315 | 7.874 | — | — | entsoe |
| 2022 | 16,076 | 8.173 | — | — | entsoe |
| 2023 | 16,265 | 8.937 | — | — | entsoe |
| 2024 | 16,213 | 9.084 | 2.100 | +332.6% | entsoe |
| 2025 | 16,179 | 8.995 | — | — | entsoe |
| 2026 | 4,827 | 3.133 | — | — | entsoe |

## Published anchors

- **TSO annual curtailment (latest published):** REE 2024 renewable curtailment ~2.1 TWh (Spain)
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** REE Informe del Sistema Eléctrico 2024

## Discrepancy analysis

_Auto-generated placeholder. Backfill annual totals are populated above; compare against the TSO annual in the row for the matching year. Pending narrative pass to characterise any year-over-year drift and whether the discrepancy is definitional (e.g., we include spill, TSO doesn't) or methodological._

## Known limitations

No region-specific limitations recorded. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_iberia_*.parquet` (7 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
