# Validation — Chile Wind (`chile-wind`)

Last updated: 2026-06-07 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `chile-wind`
- **Country:** CHL
- **Tier:** live
- **Kind:** wind
- **Source:** CEN Chile monthly XLSX wind reductions
- **Source URL:** [https://www.coordinador.cl/operacion/documentos/reducciones-de-generacion-renovable/](https://www.coordinador.cl/operacion/documentos/reducciones-de-generacion-renovable/)
- **Loader:** [`chile-wind.json.ts`](../../src/data/chile-wind.json.ts)
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** CEN monthly ERV workbooks publish plant-level hourly wind reductions after month close; latest loader snapshot parsed the February 2026 workbook
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** CEN Reducciones ERV monthly XLSX wind sheet

## Discrepancy analysis

_No historical backfill parquet yet. The live snapshot now comes directly from CEN monthly wind-reduction workbooks rather than a typical wind profile._

## Known limitations

CEN publishes the workbook after month close, so the feed is measured but not real-time. The loader parses the `Resumen-DiarioHorario-Eolico` wind sheet and sums `PE-` plant rows into hourly regional reductions. Daily PDF apportionment is currently implemented only for Atacama solar.

## Links

- Loader source: [`chile-wind.json.ts`](../../src/data/chile-wind.json.ts)
- Backfill archive: `data/historical/backfill/*_chile-wind_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
