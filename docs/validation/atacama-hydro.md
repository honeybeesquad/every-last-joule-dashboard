# Validation — Chile Hydro (`atacama-hydro`)

Last updated: 2026-06-17 · Expansion push (PR #206) · T3 modelled

## Source

- **Region id:** `atacama-hydro`
- **Country:** CHL
- **Tier:** estimated
- **Kind:** hydro
- **Source:** CEN Chile 2024 annual report (reducciones hidráulicas ~0.8 TWh/yr; central/south reservoir spill; typical hydro-seasonal profile). T3-modelled: a typical hydro profile scaled to a capacity/literature-based annual anchor (the operator publishes no per-technology curtailment series).
- **Source URL:** [https://www.coordinador.cl/operacion/documentos/reducciones-de-generacion-renovable/](https://www.coordinador.cl/operacion/documentos/reducciones-de-generacion-renovable/)
- **Structural gap:** no

## Calibration

- **Anchor basis:** capacity + typical-profile estimate, cross-checked to IRENA/Ember where available. T3 ±40% envelope. (Parent-region totals de-conflicted to avoid double-counting — see PR #206.)

## Published anchors

- **Operator annual:** —
- **Ember / IRENA annual:** —

## Discrepancy analysis

_New region (granularity survey expansion, PR #206). Modelled from a capacity/literature anchor; promote when a machine-readable operator curtailment series becomes reachable._

## Known limitations

- Magnitude is a modelled estimate (typical hydro shape × an annual anchor), not a measured curtailment series. ±40% T3 envelope.

## Links

- Methodology — tiers & live-data paths: [`docs/methodology/live-data-paths.md`](../methodology/live-data-paths.md)
