# Validation — Norway NO4 (Tromsø) (`norway-no4`)

Last updated: 2026-04-24 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `norway-no4`
- **Country:** NOR
- **Tier:** live
- **Kind:** mixed
- **Source:** ENTSO-E NO4 hydro+wind (export-constrained north; former n-norway)
- **Source URL:** [https://transparency.entsoe.eu/](https://transparency.entsoe.eu/)
- **Loader:** [`norway.json.ts`](../../src/data/norway.json.ts)
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** yes (per HB methodology §"Rate application over time")

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| 2020 | 17,559 | 1.326 | — | — | entsoe |
| 2021 | 17,515 | 1.492 | — | — | entsoe |
| 2022 | 17,518 | 1.659 | — | — | entsoe |
| 2023 | 17,510 | 1.473 | — | — | entsoe |
| 2024 | 17,565 | 1.196 | 0.300 | +298.7% | entsoe |
| 2025 | 17,520 | 1.419 | — | — | entsoe |

## Published anchors

- **TSO annual curtailment (latest published):** Statnett NO4 ~0.3 TWh wind curtailment (export-constrained north)
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_Auto-generated placeholder. Backfill annual totals are populated above; compare against the TSO annual in the row for the matching year. Pending narrative pass to characterise any year-over-year drift and whether the discrepancy is definitional (e.g., we include spill, TSO doesn't) or methodological._

## Known limitations

No region-specific limitations recorded. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: [`norway.json.ts`](../../src/data/norway.json.ts)
- Backfill archive: `data/historical/backfill/*_norway-no4_*.parquet` (6 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
