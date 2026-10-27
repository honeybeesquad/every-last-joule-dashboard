# Validation — Himachal Pradesh (`india-himachal-pradesh`)

Last updated: 2026-10-19 · Sprint: India nationwide CEA residual · Paper section: Technical Validation §4.2

## Source

- **Region id:** `india-himachal-pradesh`
- **Country:** IND
- **Tier:** estimated
- **Kind:** solar
- **Source:** CEA gen-re.cea.gov.in daily Excel × Ember India 2024 1% rate (≈0.001 TWh/yr at ~0.13 TWh/yr solar, trailing 365 days to 2026-10-15). Hourly shape is synthetic. Not a measured TSO series.
- **Source URL:** [https://gen-re.cea.gov.in/](https://gen-re.cea.gov.in/)
- **Loader:** [`india-himachal-pradesh.json.ts`](../../src/data/india-himachal-pradesh.json.ts)
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

Nationwide CEA residual (2026-10-19). Modelled from CEA generation × Ember India 2024 1% rate; promote when a machine-readable operator curtailment series becomes reachable. Not T1a.

## Known limitations

- Magnitude is a modelled estimate (typical solar shape × an Ember rate on CEA generation), not a measured curtailment series. ±40% T3 envelope. Only the generation denominator is from a primary official source.

## Links

- Loader source: [`india-himachal-pradesh.json.ts`](../../src/data/india-himachal-pradesh.json.ts)
- Backfill archive: `data/historical/backfill/*_india-himachal-pradesh_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
