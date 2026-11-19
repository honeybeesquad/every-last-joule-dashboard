# Validation — Heilongjiang Wind (`china-heilongjiang-wind`)

Last updated: 2026-11-18 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `china-heilongjiang-wind`
- **Country:** CHN
- **Tier:** estimated
- **Kind:** wind
- **Source:** Ember China subnational generation (trailing 12mo) × monitoring-centre curtailment rate 5.5% (trailing 12 months 2025-04..2026-03, system-caused limits only); refreshed anchor, T3-modelled shape
- **Source URL:** [https://github.com/honeybeesquad/every-last-joule-dashboard/blob/main/data/china-curtailment-bulletins.csv](https://github.com/honeybeesquad/every-last-joule-dashboard/blob/main/data/china-curtailment-bulletins.csv)
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

_New region (granularity survey 2026-06-10, PR #203). Modelled from a capacity/utilisation anchor; promote when a machine-readable operator curtailment series becomes reachable._

## Known limitations

- Magnitude is a modelled estimate (typical wind shape × an annual anchor), not a measured curtailment series. ±40% T3 envelope.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_china-heilongjiang-wind_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
