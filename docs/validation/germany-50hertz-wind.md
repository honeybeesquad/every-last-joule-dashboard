# Validation — 50Hertz Wind (`germany-50hertz-wind`)

Last updated: 2026-06-25 · Source upgraded from ENTSO-E proxy to netztransparenz.de measured curtailment

## Source

- **Region id:** `germany-50hertz-wind`
- **Country:** DEU
- **Tier:** live-domestic-anchored
- **Kind:** wind
- **Source:** netztransparenz.de redispatch API — MEASURED renewable curtailment (`GESAMTE_ARBEIT_MWH` where `RICHTUNG=Wirkleistungseinspeisung reduzieren` and `PRIMAERENERGIEART=Erneuerbar`) per instructing TSO (50Hertz). Wind/solar split apportioned by the ENTSO-E per-fuel ratio (the feed reports renewable curtailment without a fuel breakdown); magnitude is measured, split is estimated. Seasonal — single-month window.
- **Source URL:** [https://ds.netztransparenz.de/](https://ds.netztransparenz.de/)
- **Structural gap:** no

## Calibration

- **Method:** Direct measurement from netztransparenz redispatch (not generation × rate). No calibration rate applied — `GESAMTE_ARBEIT_MWH` is the metered energy of each redispatch measure. Wind/solar split: `fw = wind_twh / (wind_twh + solar_twh)` from the ENTSO-E 50Hertz CTA snapshot.
- **Anchor basis:** Measured redispatch totals from netztransparenz.de for the latest complete calendar month. Tier remains T1b (live-domestic-anchored) because the wind/solar apportionment is estimated rather than directly measured.

## Published anchors

- **netztransparenz.de annual:** available via the same API for prior years
- **BNetzA per-TSO annual:** consistent with netztransparenz (same source)

## Discrepancy analysis

_Source upgraded 2026-06-25 from ENTSO-E A75 generation × national BNetzA/SMARD rate proxy to direct netztransparenz.de measured renewable redispatch curtailment. Magnitude changed from proxy to measured; the wind/solar split remains estimated via ENTSO-E fuel ratio. Amprion and TransnetBW correctly show near-zero measured curtailment in the May 2026 window — consistent with operational reality (wind/solar curtailment in Germany is concentrated in the 50Hertz and TenneT DE zones)._

## Known limitations

- Wind/solar split is estimated (ENTSO-E fuel ratio) because the netztransparenz feed does not break down `Erneuerbar` further into wind vs solar. Hence T1b, not T1a.
- Single-month window (latest complete calendar month, ~1–2 month settlement lag). Seasonal variation applies.
- On API outage, loader falls back to last-good snapshot via `withFallback`.

## Links

- Loader: [`src/data/germany-curtailment.json.ts`](../../src/data/germany-curtailment.json.ts)
- Methodology — tiers & live-data paths: [`docs/methodology/live-data-paths.md`](../methodology/live-data-paths.md)
