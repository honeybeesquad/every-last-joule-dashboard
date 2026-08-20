# Validation — 50Hertz Wind (`germany-50hertz-wind`)

Last updated: 2026-08-20 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `germany-50hertz-wind`
- **Country:** DEU
- **Tier:** live-domestic-anchored
- **Kind:** wind
- **Source:** netztransparenz.de redispatch (measured renewable curtailment, 50Hertz; wind/solar split apportioned by ENTSO-E fuel ratio)
- **Source URL:** [https://ds.netztransparenz.de/](https://ds.netztransparenz.de/)
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

_Source upgraded 2026-06-25 from ENTSO-E A75 generation × national BNetzA/SMARD rate proxy to direct netztransparenz.de measured renewable redispatch curtailment. Magnitude changed from proxy to measured; the wind/solar split remains estimated via ENTSO-E fuel ratio. Amprion and TransnetBW correctly show near-zero measured curtailment in the May 2026 window — consistent with operational reality (wind/solar curtailment in Germany is concentrated in the 50Hertz and TenneT DE zones)._

## Known limitations

- Wind/solar split is estimated (ENTSO-E fuel ratio) because the netztransparenz feed does not break down `Erneuerbar` further into wind vs solar. Hence T1b, not T1a.
- Single-month window (latest complete calendar month, ~1–2 month settlement lag). Seasonal variation applies.
- On API outage, loader falls back to last-good snapshot via `withFallback`.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_germany-50hertz-wind_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
