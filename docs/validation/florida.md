# Validation — Florida (`florida`)

Last updated: 2026-04-29 · Sprint: source audit · Paper section: Technical Validation §4.2

## Source

- **Region id:** `florida`
- **Country:** USA
- **Tier:** static
- **Kind:** solar
- **Source:** EIA FLA solar generation exists, but no public hourly curtailment feed or citable curtailed-energy anchor verified
- **Source URL:** [https://www.eia.gov/opendata/browser/electricity/rto/fuel-type-data](https://www.eia.gov/opendata/browser/electricity/rto/fuel-type-data)
- **Loader:** [`florida.json.ts`](../../src/data/florida.json.ts)
- **Structural gap:** yes

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
- **Other:** provisional FPL/FRCC-style low-curtailment estimate only

## Discrepancy analysis

Florida is held at T3 because EIA publishes generation rather than curtailed energy for FLA. The provisional profile should not be promoted until a public curtailed-energy annual figure or measured hourly curtailment feed is verified.

## Known limitations

Region is a **structural gap**: no public hourly curtailment archive is available, so backfill is not possible. Current live snapshot is populated from a provisional annual anchor and scaled by a typical solar profile.

## Links

- Loader source: [`florida.json.ts`](../../src/data/florida.json.ts)
- Backfill archive: `data/historical/backfill/*_florida_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
