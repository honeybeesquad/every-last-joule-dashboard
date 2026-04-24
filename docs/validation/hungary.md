# Validation — Hungary (`hungary`)

Last updated: 2026-04-24 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `hungary`
- **Country:** HUN
- **Tier:** live
- **Kind:** mixed
- **Source:** ENTSO-E MAVIR
- **Source URL:** [https://transparency.entsoe.eu/](https://transparency.entsoe.eu/)
- **Loader:** _(no single-file loader — see multi-region source)_
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** yes (per HB methodology §"Rate application over time")

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| 2020 | 14,013 | 0.054 | — | — | entsoe |
| 2021 | 13,898 | 0.078 | — | — | entsoe |
| 2022 | 14,749 | 0.098 | — | — | entsoe |
| 2023 | 15,015 | 0.138 | — | — | entsoe |
| 2024 | 15,888 | 0.177 | 0.150 | +18.0% | entsoe |
| 2025 | 17,167 | 0.210 | — | — | entsoe |
| 2026 | 5,448 | 0.053 | — | — | entsoe |

## Published anchors

- **TSO annual curtailment (latest published):** MAVIR 2024 RES curtailment ~0.15 TWh (solar dominant)
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_Auto-generated placeholder. Backfill annual totals are populated above; compare against the TSO annual in the row for the matching year. Pending narrative pass to characterise any year-over-year drift and whether the discrepancy is definitional (e.g., we include spill, TSO doesn't) or methodological._

## Known limitations

No region-specific limitations recorded. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_hungary_*.parquet` (7 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
