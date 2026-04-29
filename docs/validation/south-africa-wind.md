# Validation - South Africa Wind (`south-africa-wind`)

Last updated: 2026-04-29 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `south-africa-wind`
- **Country:** ZAF
- **Tier:** live
- **Kind:** wind
- **Source:** Eskom Data Portal total hourly renewable generation (Wind column x 12% curtailment)
- **Source URL:** [https://www.eskom.co.za/dataportal/renewables-performance/total-hourly-renewable-generation/](https://www.eskom.co.za/dataportal/renewables-performance/total-hourly-renewable-generation/)
- **Loader:** [`south-africa.json.ts`](../../src/data/south-africa.json.ts)
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a - no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Delta % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet - will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** SAREM 2025 / Eskom MTSAO Oct 2025 reports 4,363 GWh renewable curtailment in 2024
- **Ember annual:** -
- **IRENA annual:** -
- **Other:** Eskom Data Portal Total_Hourly_Generation CSV

## Discrepancy analysis

_No backfill and no wind-only TSO anchor. Region relies on Eskom hourly wind generation and the aggregate 12% renewable-curtailment calibration._

## Known limitations

The Eskom CSV provides hourly renewable generation, not a direct curtailed-energy time series. The wind child isolates the Wind column before applying the 12% aggregate curtailment rate, which improves fuel coherence but does not remove the annual-rate assumption.

## Links

- Loader source: [`south-africa.json.ts`](../../src/data/south-africa.json.ts)
- Backfill archive: `data/historical/backfill/*_south-africa-wind_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
