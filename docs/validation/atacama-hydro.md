# Validation — Chile Hydro (`atacama-hydro`)

Last updated: 2026-06-17 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `atacama-hydro`
- **Country:** CHL
- **Tier:** estimated
- **Kind:** hydro
- **Source:** CEN Chile 2024 annual report (reducciones hidráulicas ~0.8 TWh/yr; central/south reservoir spill; typical hydro-seasonal profile)
- **Source URL:** [https://www.coordinador.cl/operacion/documentos/reducciones-de-generacion-renovable/](https://www.coordinador.cl/operacion/documentos/reducciones-de-generacion-renovable/)
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

- **TSO annual curtailment (latest published):** —
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_New region (granularity survey expansion, PR #206). Modelled from a capacity/literature anchor; promote when a machine-readable operator curtailment series becomes reachable._

## Known limitations

- Magnitude is a modelled estimate (typical hydro shape × an annual anchor), not a measured curtailment series. ±40% T3 envelope.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_atacama-hydro_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
