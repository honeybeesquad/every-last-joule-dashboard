# Validation — South Africa Solar (`south-africa-solar`)

Last updated: 2026-05-05 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `south-africa-solar`
- **Country:** ZAF
- **Tier:** live
- **Kind:** solar
- **Source:** Eskom Data Portal total hourly renewable generation (PV+CSP columns × 12% curtailment)
- **Source URL:** [https://www.eskom.co.za/dataportal/renewables-performance/total-hourly-renewable-generation/](https://www.eskom.co.za/dataportal/renewables-performance/total-hourly-renewable-generation/)
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

_No backfill and no solar-only TSO anchor. Region relies on Eskom hourly PV+CSP generation and the aggregate 12% renewable-curtailment calibration._

## Known limitations

The Eskom CSV provides hourly renewable generation, not a direct curtailed-energy time series. The solar child isolates PV+CSP columns before applying the 12% aggregate curtailment rate, which improves fuel coherence but does not remove the annual-rate assumption.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_south-africa-solar_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
