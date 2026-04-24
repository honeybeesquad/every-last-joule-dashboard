# Validation — Sweden North (`sweden-north`)

Last updated: 2026-04-24 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `sweden-north`
- **Country:** SWE
- **Tier:** live
- **Kind:** wind
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
| 2020 | 8,682 | 0.082 | — | — | entsoe |
| 2021 | 8,695 | 0.078 | — | — | entsoe |
| 2022 | 8,758 | 0.085 | — | — | entsoe |
| 2023 | 8,760 | 0.091 | — | — | entsoe |
| 2024 | 8,784 | 0.101 | — | — | entsoe |
| 2025 | 8,759 | 0.104 | — | — | entsoe |
| 2026 | 2,723 | 0.038 | — | — | entsoe |

## Published anchors

- **TSO annual curtailment (latest published):** Svk 2024 SE1+SE2 minimal curtailment — hydro baseload dominates
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_Auto-generated placeholder. Backfill annual totals are populated above; compare against the TSO annual in the row for the matching year. Pending narrative pass to characterise any year-over-year drift and whether the discrepancy is definitional (e.g., we include spill, TSO doesn't) or methodological._

## Known limitations

No region-specific limitations recorded. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_sweden-north_*.parquet` (7 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
