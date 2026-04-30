# Validation — Ireland (Republic) (`ireland-republic`)

Last updated: 2026-04-30 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `ireland-republic`
- **Country:** IRL
- **Tier:** live
- **Kind:** wind
- **Source:** EirGrid/SONI DD half-hourly workbook (ROI 58% of all-island DD)
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

- **TSO annual curtailment (latest published):** EirGrid 2024 wind constraint+curtailment ~1.5 TWh
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** EirGrid Annual Renewable Energy Report 2024

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

**Tier-overstatement fix (2026-04-25):** demoted from `T1-live-TSO` to `T3-modelled`. The EirGrid `ireland.json.ts` loader is probe-only — it fetches the public renewables page only for reachability/freshness, then emits a calibrated wind typical-shape (`WIND_SHAPE × 17.8% × 1400 MW` average all-island fleet, scaled to reproduce the SONI/EirGrid 2024 Annual Renewable Constraint and Curtailment Report total of 2.181 TWh) which is split 58/42 into ROI/NI at consumption time. The SmartGrid Dashboard hourly API that would carry measured dispatch-down is not publicly reachable. `sourceStatus="live"` continues to surface when the probe succeeds, but that is a freshness signal and not a measured-dispatch claim. See `docs/known-limitations.md` item 6 for the cross-cutting treatment of probe-only loaders.

See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: [`ireland.json.ts`](../../src/data/ireland.json.ts)
- Backfill archive: `data/historical/backfill/*_ireland-republic_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
