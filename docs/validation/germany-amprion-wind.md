# Validation — Amprion Wind (`germany-amprion-wind`)

Last updated: 2026-06-25 · Source upgraded from ENTSO-E proxy to netztransparenz.de measured curtailment

## Source

- **Region id:** `germany-amprion-wind`
- **Country:** DEU
- **Tier:** live-domestic-anchored
- **Kind:** wind
- **Source:** netztransparenz.de redispatch API — MEASURED renewable curtailment per instructing TSO (Amprion). Wind/solar split apportioned by the ENTSO-E per-fuel ratio; magnitude is measured, split is estimated.
- **Source URL:** [https://ds.netztransparenz.de/](https://ds.netztransparenz.de/)
- **Structural gap:** no

## Calibration

- **Method:** Direct measurement — no calibration rate applied. Wind/solar split: `fw = wind_twh / (wind_twh + solar_twh)` from ENTSO-E Amprion CTA snapshot.
- **Anchor basis:** Measured redispatch totals from netztransparenz.de for the latest complete calendar month (~1–2 month lag).

## Published anchors

- **netztransparenz.de annual:** available via the same API for prior years

## Discrepancy analysis

_Source upgraded 2026-06-25 from ENTSO-E A75 proxy to direct measured curtailment. Amprion correctly shows near-zero measured renewable curtailment in May 2026 — consistent with operational reality. German renewable curtailment is concentrated in the 50Hertz and TenneT DE zones (North Sea offshore and NE Germany); Amprion's Rhine–Ruhr and Baden area sees minimal renewable redispatch._

## Known limitations

- Wind/solar split is estimated (ENTSO-E fuel ratio). Hence T1b, not T1a.
- Amprion/TransnetBW renewable curtailment is typically near-zero. The ~0 measured value is accurate, not a data gap.
- Single-month window with ~1–2 month settlement lag.

## Links

- Loader: [`src/data/germany-curtailment.json.ts`](../../src/data/germany-curtailment.json.ts)
- Methodology — tiers & live-data paths: [`docs/methodology/live-data-paths.md`](../methodology/live-data-paths.md)
