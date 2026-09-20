# Validation — Prince Edward Island (`prince-edward-island`)

Last updated: 2026-09-20 · Sprint: TSO-grid completeness · Paper section: Technical Validation §4.2

## Source

- **Region id:** `prince-edward-island`
- **Country:** CAN
- **Tier:** estimated
- **Kind:** wind
- **Source:** Maritime Electric. No hourly TSO series wired. Grid present, ops unpublished.
- **Source URL:** [https://www.maritimeelectric.com/](https://www.maritimeelectric.com/)
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

- Backfill archive: `data/historical/backfill/*_prince-edward-island_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
