# Validation — Italy Centre-South Wind (`italy-csud-wind`)

Last updated: 2026-06-17 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `italy-csud-wind`
- **Country:** ITA
- **Tier:** live-domestic-anchored
- **Kind:** wind
- **Source:** ENTSO-E Terna CSUD zone wind
- **Source URL:** [https://transparency.entsoe.eu/](https://transparency.entsoe.eu/)
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

_New zone (granularity survey 2026-06-10). Completes Italy's 7-zone partition (was 3 of 7 modelled). ENTSO-E A75 live-probed 2026-06-17 (both B16/B19 non-empty). ±50% T1b envelope pending Terna per-zone confirmation._

## Known limitations

- The calibration rate is a zone-share of the Terna national anchor, not a Terna per-zone published figure — hence T1b, not T1a. Terna's download center would upgrade this.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_italy-csud-wind_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
