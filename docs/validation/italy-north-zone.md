# Validation — Italy North (`italy-north-zone`)

Last updated: 2026-04-24 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `italy-north-zone`
- **Country:** ITA
- **Tier:** live
- **Kind:** mixed
- **Source:** ENTSO-E Terna (North zone)
- **Source URL:** [https://transparency.entsoe.eu/](https://transparency.entsoe.eu/)
- **Loader:** _(no single-file loader — see multi-region source)_
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** yes (per HB methodology §"Rate application over time")

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| 2020 | 11,085 | 0.043 | — | — | entsoe |
| 2021 | 11,392 | 0.043 | — | — | entsoe |
| 2022 | 11,848 | 0.047 | — | — | entsoe |
| 2023 | 12,674 | 0.051 | — | — | entsoe |
| 2024 | 13,239 | 0.059 | — | — | entsoe |
| 2025 | 13,778 | 0.077 | — | — | entsoe |
| 2026 | 4,013 | 0.020 | — | — | entsoe |

## Published anchors

- **TSO annual curtailment (latest published):** Terna 2024 Italy North zonal overflow redispatch ~1.1 TWh
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_Auto-generated placeholder. Backfill annual totals are populated above; compare against the TSO annual in the row for the matching year. Pending narrative pass to characterise any year-over-year drift and whether the discrepancy is definitional (e.g., we include spill, TSO doesn't) or methodological._

## Known limitations

No region-specific limitations recorded. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_italy-north-zone_*.parquet` (7 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
