# Validation — Sardinia (`italy-sardinia`)

Last updated: 2026-04-24 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `italy-sardinia`
- **Country:** ITA
- **Tier:** live
- **Kind:** mixed
- **Source:** ENTSO-E Terna (Sardinia)
- **Source URL:** [https://transparency.entsoe.eu/](https://transparency.entsoe.eu/)
- **Loader:** _(no single-file loader — see multi-region source)_
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** yes (per HB methodology §"Rate application over time")

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| 2020 | 13,242 | 0.071 | — | — | entsoe |
| 2021 | 13,450 | 0.078 | — | — | entsoe |
| 2022 | 13,536 | 0.090 | — | — | entsoe |
| 2023 | 13,578 | 0.102 | — | — | entsoe |
| 2024 | 13,810 | 0.116 | 0.062 | +87.6% | entsoe |
| 2025 | 13,758 | 0.127 | — | — | entsoe |
| 2026 | 4,178 | 0.041 | — | — | entsoe |

## Published anchors

- **TSO annual curtailment (latest published):** Terna 2024 Sardinia ~0.062 TWh (20% of Terna national 0.31 TWh RES curtailment anchor, used for rate calibration).
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_Auto-generated placeholder. Backfill annual totals are populated above; compare against the TSO annual in the row for the matching year. Pending narrative pass to characterise any year-over-year drift and whether the discrepancy is definitional (e.g., we include spill, TSO doesn't) or methodological._

## Known limitations

No region-specific limitations recorded. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_italy-sardinia_*.parquet` (7 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
