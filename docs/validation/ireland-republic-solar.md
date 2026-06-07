# Validation — Ireland (Republic) Solar (`ireland-republic-solar`)

Last updated: 2026-06-07 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `ireland-republic-solar`
- **Country:** IRL
- **Tier:** live
- **Kind:** solar
- **Source:** EirGrid/SONI DD half-hourly workbook (ROI 58% solar share fallback)
- **Source URL:** [https://www.eirgrid.ie/grid/system-and-renewable-data-reports](https://www.eirgrid.ie/grid/system-and-renewable-data-reports)
- **Loader:** [`ireland.json.ts`](../../src/data/ireland.json.ts)
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** EirGrid 2024 solar curtailment negligible (<0.01 TWh); no published metric
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

No region-specific limitations recorded. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: [`ireland.json.ts`](../../src/data/ireland.json.ts)
- Backfill archive: `data/historical/backfill/*_ireland-republic-solar_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
