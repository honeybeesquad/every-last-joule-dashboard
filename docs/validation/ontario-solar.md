# Validation — Ontario Solar (`ontario-solar`)

Last updated: 2026-08-20 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `ontario-solar`
- **Country:** CAN
- **Tier:** live
- **Kind:** solar
- **Source:** IESO solar generation capability
- **Source URL:** [https://reports-public.ieso.ca/public/GenOutputCapability/](https://reports-public.ieso.ca/public/GenOutputCapability/)
- **Loader:** [`ontario.json.ts`](../../src/data/ontario.json.ts)
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

No solar-only backfill is currently archived. The loader uses IESO hourly solar generation capability and applies the 2% Ontario solar curtailment proxy.

## Known limitations

IESO does not publish direct hourly curtailment in this feed. The live hourly shape comes from generation capability; curtailed magnitude remains rate-calibrated.

## Links

- Loader source: [`ontario.json.ts`](../../src/data/ontario.json.ts)
- Backfill archive: `data/historical/backfill/*_ontario-solar_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
