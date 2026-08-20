# Validation — Argentina (`argentina`)

Last updated: 2026-08-20 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `argentina`
- **Country:** ARG
- **Tier:** estimated
- **Kind:** wind
- **Source:** CAMMESA cdsrenovables.cammesa.com live wind generation × 5% calibrated curtailment rate (CAMMESA/IRENA 2024 anchor ~0.5 TWh/yr Patagonia wind curtailment). Fallback: typical Patagonia wind profile.
- **Source URL:** [https://cdsrenovables.cammesa.com/exhisto/RenovablesService/GetChartTotalTRDataSource/](https://cdsrenovables.cammesa.com/exhisto/RenovablesService/GetChartTotalTRDataSource/)
- **Loader:** [`argentina.json.ts`](../../src/data/argentina.json.ts)
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** CAMMESA 2024 wind+solar curtailment ~0.3 TWh
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

No region-specific limitations recorded. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: [`argentina.json.ts`](../../src/data/argentina.json.ts)
- Backfill archive: `data/historical/backfill/*_argentina_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
