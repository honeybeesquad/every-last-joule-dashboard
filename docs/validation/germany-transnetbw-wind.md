# Validation — TransnetBW Wind (`germany-transnetbw-wind`)

Last updated: 2026-06-25 · Source upgraded from ENTSO-E proxy to netztransparenz.de measured curtailment

## Source

- **Region id:** `germany-transnetbw-wind`
- **Country:** DEU
- **Tier:** live-domestic-anchored
- **Kind:** wind
- **Source:** netztransparenz.de redispatch API — MEASURED renewable curtailment per instructing TSO (TransnetBW). Wind/solar split apportioned by the ENTSO-E per-fuel ratio; magnitude is measured, split is estimated.
- **Source URL:** [https://ds.netztransparenz.de/](https://ds.netztransparenz.de/)
- **Structural gap:** no

## Calibration

- **Method:** Direct measurement — no calibration rate applied. Wind/solar split: `fw = wind_twh / (wind_twh + solar_twh)` from ENTSO-E TransnetBW CTA snapshot.
- **Anchor basis:** Measured redispatch totals from netztransparenz.de for the latest complete calendar month.

## Published anchors

- **netztransparenz.de annual:** available via the same API for prior years

## Discrepancy analysis

_Source upgraded 2026-06-25. TransnetBW (Baden-Württemberg, inland) shows very low measured renewable curtailment — consistent with operational reality (primarily solar, small wind capacity, good grid connectivity to France/Switzerland). May 2026 measured: 263 MWh total renewable redispatch._

## Known limitations

- Wind/solar split is estimated (ENTSO-E fuel ratio). Hence T1b, not T1a.
- TransnetBW renewable curtailment is typically very small; the low measured value is accurate.
- Single-month window with ~1–2 month settlement lag.

## Links

- Loader: [`src/data/germany-curtailment.json.ts`](../../src/data/germany-curtailment.json.ts)
- Methodology — tiers & live-data paths: [`docs/methodology/live-data-paths.md`](../methodology/live-data-paths.md)
