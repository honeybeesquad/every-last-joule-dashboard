# Validation — Chhattisgarh (`india-chhattisgarh`)

Last updated: 2026-06-17 · Granularity survey 2026-06-10 · T3 modelled

## Source

- **Region id:** `india-chhattisgarh`
- **Country:** IND
- **Tier:** estimated
- **Kind:** solar
- **Source:** CEA gen-re.cea.gov.in daily Excel × Ember India 2024 state curtailment rate. T3-modelled: a typical solar profile scaled to a capacity/utilisation-based annual anchor (no live per-fuel curtailment feed).
- **Source URL:** [https://cea.nic.in/](https://cea.nic.in/)
- **Structural gap:** no

## Calibration

- **Anchor basis:** Ember India 2024 solar curtailment rate × CEA generation. T3 ±40% envelope.

## Published anchors

- **Operator annual:** —
- **Ember / IRENA annual:** —

## Discrepancy analysis

_New region (granularity survey 2026-06-10, PR #203). Modelled from a capacity/utilisation anchor; promote when a machine-readable operator curtailment series becomes reachable._

## Known limitations

- Magnitude is a modelled estimate (typical solar shape × an annual anchor), not a measured curtailment series. ±40% T3 envelope.

## Links

- Methodology — tiers & live-data paths: [`docs/methodology/live-data-paths.md`](../methodology/live-data-paths.md)
