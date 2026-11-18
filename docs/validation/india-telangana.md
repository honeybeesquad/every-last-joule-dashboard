# Validation — Telangana (`india-telangana`)

Last updated: 2026-08-20 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `india-telangana`
- **Country:** IND
- **Tier:** estimated
- **Kind:** mixed
- **Source:** CEA gen-re.cea.gov.in daily Excel × Ember India 2024 2% rate (≈0.17 TWh/yr at ~8.0 TWh/yr solar + 0.28 TWh/yr wind, trailing 365 days to 2026-10-15). Hourly shape is synthetic. Not a measured TSO series.
- **Source URL:** [https://gen-re.cea.gov.in/](https://gen-re.cea.gov.in/)
- **Loader:** [`india-telangana.json.ts`](../../src/data/india-telangana.json.ts)
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

_New region (granularity survey 2026-06-10, PR #203). Modelled from a capacity/utilisation anchor; promote when a machine-readable operator curtailment series becomes reachable._

## Known limitations

- Magnitude is a modelled estimate (typical mixed shape × an annual anchor), not a measured curtailment series. ±40% T3 envelope.

## Links

- Loader source: [`india-telangana.json.ts`](../../src/data/india-telangana.json.ts)
- Backfill archive: `data/historical/backfill/*_india-telangana_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
