# Validation — Shaanxi Solar (`china-shaanxi-solar`)

Last updated: 2026-06-17 · Granularity survey 2026-06-10 · T3 modelled

## Source

- **Region id:** `china-shaanxi-solar`
- **Country:** CHN
- **Tier:** estimated
- **Kind:** solar
- **Source:** NEA provincial renewable-utilisation bulletin 2024 (+ Huaon/NBS capacity). T3-modelled: a typical solar profile scaled to a capacity/utilisation-based annual anchor (no live per-fuel curtailment feed).
- **Source URL:** [https://www.nea.gov.cn/](https://www.nea.gov.cn/)
- **Structural gap:** no

## Calibration

- **Anchor basis:** NEA 2024 provincial solar utilisation rate × installed capacity. T3 ±40% envelope.

## Published anchors

- **Operator annual:** —
- **Ember / IRENA annual:** —

## Discrepancy analysis

_New region (granularity survey 2026-06-10, PR #203). Modelled from a capacity/utilisation anchor; promote when a machine-readable operator curtailment series becomes reachable._

## Known limitations

- Magnitude is a modelled estimate (typical solar shape × an annual anchor), not a measured curtailment series. ±40% T3 envelope.

## Links

- Methodology — tiers & live-data paths: [`docs/methodology/live-data-paths.md`](../methodology/live-data-paths.md)
