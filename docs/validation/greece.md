# Validation — Greece (`greece`)

Last updated: 2026-04-24 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `greece`
- **Country:** GRC
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
| 2020 | 13,871 | 0.410 | — | — | entsoe |
| 2021 | 14,212 | 0.493 | — | — | entsoe |
| 2022 | 13,868 | 0.562 | — | — | entsoe |
| 2023 | 14,222 | 0.648 | — | — | entsoe |
| 2024 | 14,087 | 0.802 | 0.350 | +129.1% | entsoe |
| 2025 | 13,907 | 0.790 | — | — | entsoe |
| 2026 | 4,243 | 0.268 | — | — | entsoe |

## Published anchors

- **TSO annual curtailment (latest published):** HAEE/IPTO 2024 RES curtailment officially published (see docs/data-source-log.md)
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** Ember 2024 Greece report

## Discrepancy analysis

_Auto-generated placeholder. Backfill annual totals are populated above; compare against the TSO annual in the row for the matching year. Pending narrative pass to characterise any year-over-year drift and whether the discrepancy is definitional (e.g., we include spill, TSO doesn't) or methodological._

## Known limitations

No region-specific limitations recorded. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_greece_*.parquet` (7 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
