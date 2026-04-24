# Validation — PJM (`pjm`)

Last updated: 2026-04-24 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `pjm`
- **Country:** USA
- **Tier:** live
- **Kind:** mixed
- **Source:** EIA PJM wind+solar
- **Source URL:** [https://www.eia.gov/opendata/browser/electricity/rto/fuel-type-data](https://www.eia.gov/opendata/browser/electricity/rto/fuel-type-data)
- **Loader:** [`pjm.json.ts`](../../src/data/pjm.json.ts)
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** PJM small but growing curtailment, concentrated in NJ/MD/VA solar (2024 PJM State of the Market)
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** PJM Renewable Integration Study 2024; PJM Markets Monitor 2024

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

No region-specific limitations recorded. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: [`pjm.json.ts`](../../src/data/pjm.json.ts)
- Backfill archive: `data/historical/backfill/*_pjm_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
