# Validation — New Zealand (`new-zealand`)

Last updated: 2026-04-27 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `new-zealand`
- **Country:** NZL
- **Tier:** live
- **Kind:** mixed
- **Source:** EMI wind+solar+geo
- **Source URL:** [https://www.emi.ea.govt.nz/Wholesale/Datasets/Generation/Generation_MD](https://www.emi.ea.govt.nz/Wholesale/Datasets/Generation/Generation_MD)
- **Loader:** [`new-zealand.json.ts`](../../src/data/new-zealand.json.ts)
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** Transpower 2024 RES curtailment low
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

No region-specific limitations recorded. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: [`new-zealand.json.ts`](../../src/data/new-zealand.json.ts)
- Backfill archive: `data/historical/backfill/*_new-zealand_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
