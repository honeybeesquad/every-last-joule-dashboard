# Validation — Quebec (`quebec`)

Last updated: 2026-06-17 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `quebec`
- **Country:** CAN
- **Tier:** estimated
- **Kind:** hydro
- **Source:** Hydro-Quebec fallback
- **Source URL:** [https://www.hydroquebec.com/](https://www.hydroquebec.com/)
- **Loader:** [`quebec.json.ts`](../../src/data/quebec.json.ts)
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** Hydro-Québec 2024 wind curtailment low (hydro-reservoir buffered)
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

No region-specific limitations recorded. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: [`quebec.json.ts`](../../src/data/quebec.json.ts)
- Backfill archive: `data/historical/backfill/*_quebec_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
