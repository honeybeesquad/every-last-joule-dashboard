# Validation — ERCOT East (`ercot-east`)

Last updated: 2026-04-24 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `ercot-east`
- **Country:** USA
- **Tier:** live
- **Kind:** mixed
- **Source:** EIA / ERCOT (wind+solar)
- **Source URL:** [https://www.eia.gov/opendata/browser/electricity/rto/fuel-type-data](https://www.eia.gov/opendata/browser/electricity/rto/fuel-type-data)
- **Loader:** [`ercot.json.ts`](../../src/data/ercot.json.ts)
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| 2024 | — | — | 3.000 | — | — |

## Published anchors

- **TSO annual curtailment (latest published):** ERCOT ~8 TWh wind + ~0.8 TWh solar (2024, Potomac Economics SoM) × 34% East/Central share
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

See ercot-west.

## Links

- Loader source: [`ercot.json.ts`](../../src/data/ercot.json.ts)
- Backfill archive: `data/historical/backfill/*_ercot-east_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
