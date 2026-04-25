# Validation — Iceland (`iceland`)

Last updated: 2026-04-24 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `iceland`
- **Country:** ISL
- **Tier:** static
- **Kind:** hydro
- **Source:** Published
- **Source URL:** [https://orkustofnun.is/](https://orkustofnun.is/)
- **Loader:** _(no single-file loader — see multi-region source)_
- **Structural gap:** yes

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** Orkustofnun 2024 annual curtailment ~0 TWh (load-following hydro+geothermal, reservoir-buffered)
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

No public hourly archive. Orkustofnun (Icelandic National Energy Authority, `orkustofnun.is`) publishes annual generation summaries but no hourly dispatch-down series — Landsvirkjun likewise does not surface real-time spill data. The loader emits a hydro-seasonal shape (`HYDRO_SEASONAL_SHARES.iceland`, weighted toward May–August for glacial-melt + snowmelt) scaled to a 5.3 TWh/yr anchor for combined hydro and geothermal load-following slack. T3-modelled, ±40% envelope. Iceland is hydro+geothermal dominant and grid-isolated (no interconnector); the "spill" semantic here is reservoir-bound seasonal storage limit at peak melt rather than wind-or-solar dispatch-down — distinct from every other T3 region in the dataset, and a useful methodological reminder that "curtailment" generalises beyond the wind-PV case in the Scientific Data submission framing.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_iceland_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
