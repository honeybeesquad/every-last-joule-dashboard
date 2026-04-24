# Validation — Switzerland (`switzerland`)

Last updated: 2026-04-24 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `switzerland`
- **Country:** CHE
- **Tier:** live
- **Kind:** solar
- **Source:** ENTSO-E Swissgrid PV-only (hydro spill not in A75)
- **Source URL:** [https://transparency.entsoe.eu/](https://transparency.entsoe.eu/)
- **Loader:** _(no single-file loader — see multi-region source)_
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** yes (per HB methodology §"Rate application over time")

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| 2020 | 4,991 | 0.036 | — | — | entsoe |
| 2021 | 4,891 | 0.038 | — | — | entsoe |
| 2022 | 4,708 | 0.046 | — | — | entsoe |
| 2023 | 4,897 | 0.053 | — | — | entsoe |
| 2024 | 4,896 | 0.065 | 0.100 | -35.5% | entsoe |
| 2025 | 7,580 | 0.077 | — | — | entsoe |
| 2026 | 1,876 | 0.014 | — | — | entsoe |

## Published anchors

- **TSO annual curtailment (latest published):** Swissgrid 2024 PV curtailment ~0.1 TWh; hydro spill not in A75 (excluded from our figure)
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_Auto-generated placeholder. Backfill annual totals are populated above; compare against the TSO annual in the row for the matching year. Pending narrative pass to characterise any year-over-year drift and whether the discrepancy is definitional (e.g., we include spill, TSO doesn't) or methodological._

## Known limitations

No region-specific limitations recorded. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_switzerland_*.parquet` (7 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
