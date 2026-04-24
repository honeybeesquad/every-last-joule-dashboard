# Validation — Portugal (`portugal`)

Last updated: 2026-04-24 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `portugal`
- **Country:** PRT
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
| 2020 | 13,914 | 0.487 | — | — | entsoe |
| 2021 | 13,893 | 0.558 | — | — | entsoe |
| 2022 | 14,182 | 0.639 | — | — | entsoe |
| 2023 | 14,822 | 0.744 | — | — | entsoe |
| 2024 | 14,789 | 0.913 | 0.400 | +128.1% | entsoe |
| 2025 | 14,340 | 1.014 | — | — | entsoe |
| 2026 | 4,450 | 0.301 | — | — | entsoe |

## Published anchors

- **TSO annual curtailment (latest published):** REN 2024 renewable curtailment ~0.4 TWh
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** REN Dados Técnicos 2024

## Discrepancy analysis

_Auto-generated placeholder. Backfill annual totals are populated above; compare against the TSO annual in the row for the matching year. Pending narrative pass to characterise any year-over-year drift and whether the discrepancy is definitional (e.g., we include spill, TSO doesn't) or methodological._

## Known limitations

No region-specific limitations recorded. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_portugal_*.parquet` (7 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
