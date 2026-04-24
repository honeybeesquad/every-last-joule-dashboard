# Validation — Bulgaria (`bulgaria`)

Last updated: 2026-04-24 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `bulgaria`
- **Country:** BGR
- **Tier:** live
- **Kind:** mixed
- **Source:** ENTSO-E ESO
- **Source URL:** [https://transparency.entsoe.eu/](https://transparency.entsoe.eu/)
- **Loader:** _(no single-file loader — see multi-region source)_
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** yes (per HB methodology §"Rate application over time")

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| 2020 | 13,451 | 0.050 | — | — | entsoe |
| 2021 | 13,508 | 0.049 | — | — | entsoe |
| 2022 | 13,918 | 0.054 | — | — | entsoe |
| 2023 | 15,471 | 0.084 | — | — | entsoe |
| 2024 | 16,081 | 0.119 | 0.100 | +18.6% | entsoe |
| 2025 | 17,306 | 0.146 | — | — | entsoe |
| 2026 | 5,440 | 0.039 | — | — | entsoe |

## Published anchors

- **TSO annual curtailment (latest published):** ESO 2024 RES curtailment ~0.1 TWh
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_Auto-generated placeholder. Backfill annual totals are populated above; compare against the TSO annual in the row for the matching year. Pending narrative pass to characterise any year-over-year drift and whether the discrepancy is definitional (e.g., we include spill, TSO doesn't) or methodological._

## Known limitations

No region-specific limitations recorded. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_bulgaria_*.parquet` (7 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
