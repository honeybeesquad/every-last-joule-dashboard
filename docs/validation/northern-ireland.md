# Validation — Northern Ireland (`northern-ireland`)

Last updated: 2026-04-24 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `northern-ireland`
- **Country:** GBR
- **Tier:** static (T3-modelled, ±40% — demoted from live on 2026-04-25; see "Known limitations" below)
- **Kind:** wind
- **Source:** EirGrid probe + wind typical-shape (NI 42% of 2.18 TWh/yr SONI/EirGrid 2024 anchor)
- **Source URL:** [https://cms.soni.ltd.uk/sites/default/files/publications/Annual%20Renewable%20Constraint%20and%20Curtailment%20Report%202024%20V1.0.pdf](https://cms.soni.ltd.uk/sites/default/files/publications/Annual%20Renewable%20Constraint%20and%20Curtailment%20Report%202024%20V1.0.pdf)
- **Loader:** _(no single-file loader — see multi-region source)_
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** SONI 2024 wind curtailment ~0.3 TWh
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

**Tier-overstatement fix (2026-04-25):** demoted from `T1-live-TSO` to `T3-modelled` together with `ireland-republic`. The EirGrid `ireland.json.ts` loader emits a single all-island typical-shape series (calibrated to the SONI/EirGrid 2024 anchor, 2.181 TWh total) which is split 58/42 into ROI/NI at consumption time. NI inherits the same probe-only treatment — there is no measured NI dispatch-down feed in the loader, and the 0.915 TWh anchor is reproduced by the calibrated shape, not measured hour-by-hour. `sourceStatus="live"` reflects probe reachability, not a measured-dispatch claim. See `docs/known-limitations.md` item 6.

See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_northern-ireland_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
