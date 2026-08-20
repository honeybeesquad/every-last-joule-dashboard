# Validation — TransnetBW Solar (`germany-transnetbw-solar`)

Last updated: 2026-08-20 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `germany-transnetbw-solar`
- **Country:** DEU
- **Tier:** live-domestic-anchored
- **Kind:** solar
- **Source:** netztransparenz.de redispatch (measured renewable curtailment, TransnetBW; wind/solar split apportioned by ENTSO-E fuel ratio)
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

_Source upgraded 2026-06-25. See germany-transnetbw-wind for full notes. TransnetBW shows very low measured curtailment in May 2026._

## Known limitations

- Wind/solar split is estimated (ENTSO-E fuel ratio). Hence T1b, not T1a.
- TransnetBW renewable curtailment is typically very small; the low measured value is accurate.
- Single-month window with ~1–2 month settlement lag.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_germany-transnetbw-solar_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
