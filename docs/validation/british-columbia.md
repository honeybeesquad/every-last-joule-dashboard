# Validation — British Columbia (`british-columbia`)

Last updated: 2026-06-06 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `british-columbia`
- **Country:** CAN
- **Tier:** estimated
- **Kind:** hydro
- **Source:** BC Hydro fallback
- **Source URL:** [https://www.bchydro.com/](https://www.bchydro.com/)
- **Loader:** [`british-columbia.json.ts`](../../src/data/british-columbia.json.ts)
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** BC Hydro 2024 curtailment minimal (hydro baseload)
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

No region-specific limitations recorded. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: [`british-columbia.json.ts`](../../src/data/british-columbia.json.ts)
- Backfill archive: `data/historical/backfill/*_british-columbia_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
