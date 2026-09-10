# Validation - Chile CEN Annual Floor 2025

Last updated: 2026-05-08

## Source

- **Rows:** `chile-sen-solar` and `chile-wind`
- **Country:** CHL
- **Source:** Coordinador Electrico Nacional monthly `Reducciones de Energia Eolica Solar Hidro en el SEN` XLSX workbooks
- **Source URL:** [https://www.coordinador.cl/operacion/documentos/reducciones-de-generacion-renovable/](https://www.coordinador.cl/operacion/documentos/reducciones-de-generacion-renovable/)
- **Extractor:** [`scripts/research/chile-cen-annual-floor.ts`](../../scripts/research/chile-cen-annual-floor.ts)
- **Research artifact:** [`docs/research/2026-05-08-chile-cen-annual-floor-2025.md`](../research/2026-05-08-chile-cen-annual-floor-2025.md)

## Formula

The annual floor uses the official monthly workbooks and sums plant-level hourly MWh reduction rows:

- Solar: sheet `Resumen-DiarioHorario-Solar`, plant rows beginning `PFV-`.
- Wind: sheet `Resumen-DiarioHorario-Eolico`, plant rows beginning `PE-`.
- Formula: `sum(plant-level hourly MWh reductions)`.
- Interval: 1 hour.
- Exclusions: hydro reduction sheets are not included in these wind/solar floor rows.

## 2025 Result

| Region | Kind | 2025 TWh | 2025 MWh | Coverage |
|---|---|---:|---:|---|
| `chile-sen-solar` | solar | 4.405404 | 4,405,403.6 | 12 monthly CEN workbooks |
| `chile-wind` | wind | 1.619815 | 1,619,814.8 | 12 monthly CEN workbooks |
| **Total** | wind+solar | **6.025218** | **6,025,218.4** | 12 monthly CEN workbooks |

The CEN 2025 press-deck excerpt found during QA reported 5.700 TWh of reductions through 25 December 2025. The full monthly workbook reconciliation is higher because it includes the final December workbook. January-November in the workbooks totals 5.234 TWh, close to the press-deck month table through November; the remaining difference is concentrated in December, where the press deck used a partial-month 450 GWh value while the final December workbook totals 791 GWh for wind plus solar.

## Production Gate

These rows clear the source-verified annual floor gate because the source publishes measured energy reductions by technology, the parser uses hourly MWh fields directly, all 12 calendar months were retrieved, and no rate multiplier, capacity proxy, instruction percentage, or DSM/deviation denominator is used.

Known caveat: the dashboard has an `atacama` solar row, but the annual floor uses `chile-sen-solar` because the CEN workbook is SEN-wide. This avoids presenting a national source as an Atacama-only annual total.
