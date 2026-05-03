# Validation — Alberta Solar (`alberta-solar`)

Last updated: 2026-05-03 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `alberta-solar`
- **Country:** CAN
- **Tier:** live
- **Kind:** solar
- **Source:** AESO solar snapshot
- **Source URL:** [http://ets.aeso.ca/ets_web/ip/Market/Reports/CSDReportServlet](http://ets.aeso.ca/ets_web/ip/Market/Reports/CSDReportServlet)
- **Loader:** [`alberta.json.ts`](../../src/data/alberta.json.ts)
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** —
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

No solar-only Alberta curtailment anchor is currently archived. The loader uses AESO's live solar supply row and shapes the solar component around Alberta local noon so overnight hours remain zero.

## Known limitations

AESO CSD is a current-supply snapshot rather than a historical curtailment feed. The solar child is modelled from the solar snapshot and should be upgraded when AESO publishes an hourly solar curtailment or dispatch-down feed.

## Links

- Loader source: [`alberta.json.ts`](../../src/data/alberta.json.ts)
- Backfill archive: `data/historical/backfill/*_alberta-solar_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
