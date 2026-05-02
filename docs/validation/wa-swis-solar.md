# Validation — Western Australia Solar (SWIS) (`wa-swis-solar`)

Last updated: 2026-05-02 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `wa-swis-solar`
- **Country:** AUS
- **Tier:** live
- **Kind:** solar
- **Source:** AEMO WEM Facility SCADA (solar DUIDs)
- **Source URL:** [https://data.wa.aemo.com.au/](https://data.wa.aemo.com.au/)
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

_No backfill and no solar-only TSO curtailment anchor. Region relies on recent Facility SCADA solar generation and the SWIS aggregate 8% curtailment-rate calibration._

## Known limitations

AEMO WEM Facility SCADA is a generation feed. The loader applies an 8% calibrated curtailment rate from the WA-SWIS annual anchor, so the hourly shape is live TSO-published but the curtailed magnitude is still rate-calibrated.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_wa-swis-solar_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
