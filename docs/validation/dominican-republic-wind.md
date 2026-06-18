# Validation — Dominican Republic Wind (`dominican-republic-wind`)

Last updated: 2026-06-17 · Expansion push (PR #206) · T3 modelled

## Source

- **Region id:** `dominican-republic-wind`
- **Country:** DOM
- **Tier:** estimated
- **Kind:** wind
- **Source:** IRENA Dominican Republic 2024 (448 MW wind; OC does not publish per-fuel curtailment; estimated 0.3 TWh/yr from capacity + typical wind profile). T3-modelled: a typical wind profile scaled to a capacity/literature-based annual anchor (the operator publishes no per-technology curtailment series).
- **Source URL:** [https://www.oc.org.do/](https://www.oc.org.do/)
- **Structural gap:** no

## Calibration

- **Anchor basis:** capacity + typical-profile estimate, cross-checked to IRENA/Ember where available. T3 ±40% envelope. (Parent-region totals de-conflicted to avoid double-counting — see PR #206.)

## Published anchors

- **Operator annual:** —
- **Ember / IRENA annual:** —

## Discrepancy analysis

_New region (granularity survey expansion, PR #206). Modelled from a capacity/literature anchor; promote when a machine-readable operator curtailment series becomes reachable._

## Known limitations

- Magnitude is a modelled estimate (typical wind shape × an annual anchor), not a measured curtailment series. ±40% T3 envelope.

## Links

- Methodology — tiers & live-data paths: [`docs/methodology/live-data-paths.md`](../methodology/live-data-paths.md)
