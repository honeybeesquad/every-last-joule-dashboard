# Validation — Colombia Wind (`colombia-wind`)

Last updated: 2026-06-18 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `colombia-wind`
- **Country:** COL
- **Tier:** estimated
- **Kind:** wind
- **Source:** XM SinerGox system-wide vertimientos split; La Guajira wind corridor ~1.5 TWh/yr estimated from IRENA 2024 capacity + Ember 2024 wind curtailment share (no per-technology breakdown from XM)
- **Source URL:** [https://servapibi.xm.com.co/daily](https://servapibi.xm.com.co/daily)
- **Loader:** [`colombia.json.ts`](../../src/data/colombia.json.ts)
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

_New region (granularity survey expansion, PR #206). Modelled from a capacity/literature anchor; promote when a machine-readable operator curtailment series becomes reachable._

## Known limitations

- Magnitude is a modelled estimate (typical wind shape × an annual anchor), not a measured curtailment series. ±40% T3 envelope.

## Links

- Loader source: [`colombia.json.ts`](../../src/data/colombia.json.ts)
- Backfill archive: `data/historical/backfill/*_colombia-wind_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
