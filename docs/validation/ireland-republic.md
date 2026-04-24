# Validation — Ireland (Republic) (`ireland-republic`)

Last updated: 2026-04-24 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `ireland-republic`
- **Country:** IRL
- **Tier:** live
- **Kind:** wind
- **Source:** SONI/EirGrid 2024 dispatch-down (ROI: 1.266 TWh)
- **Source URL:** [https://cms.soni.ltd.uk/sites/default/files/publications/Annual%20Renewable%20Constraint%20and%20Curtailment%20Report%202024%20V1.0.pdf](https://cms.soni.ltd.uk/sites/default/files/publications/Annual%20Renewable%20Constraint%20and%20Curtailment%20Report%202024%20V1.0.pdf)
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

- **TSO annual curtailment (latest published):** EirGrid 2024 wind constraint+curtailment ~1.5 TWh
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** EirGrid Annual Renewable Energy Report 2024

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

No region-specific limitations recorded. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: [`ireland.json.ts`](../../src/data/ireland.json.ts)
- Backfill archive: `data/historical/backfill/*_ireland-republic_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
