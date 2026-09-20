# Validation — Sweden SE2 Solar (`sweden-se2-solar`)

Last updated: 2026-09-20 · Sprint: TSO-grid completeness · Paper section: Technical Validation §4.2

## Source

- **Region id:** `sweden-se2-solar`
- **Country:** SWE
- **Tier:** estimated
- **Kind:** solar
- **Source:** Svenska kraftnät SE2 A75 generation. Waste unpublished.
- **Source URL:** [https://transparency.entsoe.eu/](https://transparency.entsoe.eu/)
- **Loader:** _(see region source / TSO-grid completeness loaders)_
- **Structural gap:** no
- **Waste status:** unpublished unless the operator publishes a curtailment/spill series. Missing ≠ zero. Live generation does not make waste T1a.

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** —
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

Grid-completeness row. Waste is unpublished unless a later loader adds a published series. Do not read a zero `profile` as a measured finding.

## Known limitations

See `docs/methodology/historical-backfill.md` and STATUS.md TSO-grid completeness.

## Links

- Backfill archive: `data/historical/backfill/*_sweden-se2-solar_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
