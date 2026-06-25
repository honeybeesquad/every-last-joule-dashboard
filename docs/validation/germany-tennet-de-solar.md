# Validation — TenneT DE Solar (`germany-tennet-de-solar`)

Last updated: 2026-06-25 · Source upgraded from ENTSO-E proxy to netztransparenz.de measured curtailment

## Source

- **Region id:** `germany-tennet-de-solar`
- **Country:** DEU
- **Tier:** live-domestic-anchored
- **Kind:** solar
- **Source:** netztransparenz.de redispatch API — MEASURED renewable curtailment per instructing TSO (TenneT DE). Wind/solar split apportioned by the ENTSO-E per-fuel ratio; magnitude is measured, split is estimated.
- **Source URL:** [https://ds.netztransparenz.de/](https://ds.netztransparenz.de/)
- **Structural gap:** no

## Calibration

- **Method:** Direct measurement — no calibration rate applied. Wind/solar split: `fs = 1 − fw` from ENTSO-E TenneT DE CTA snapshot.
- **Anchor basis:** Measured redispatch totals from netztransparenz.de for the latest complete calendar month.

## Published anchors

- **netztransparenz.de annual:** available via the same API for prior years

## Discrepancy analysis

_Source upgraded 2026-06-25. See germany-tennet-de-wind for full notes._

## Known limitations

- Wind/solar split is estimated (ENTSO-E fuel ratio). Hence T1b, not T1a.
- Single-month window with ~1–2 month settlement lag.

## Links

- Loader: [`src/data/germany-curtailment.json.ts`](../../src/data/germany-curtailment.json.ts)
- Methodology — tiers & live-data paths: [`docs/methodology/live-data-paths.md`](../methodology/live-data-paths.md)
