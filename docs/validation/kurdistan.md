# Validation — Kurdistan (KRG) (`kurdistan`)

Last updated: 2026-04-24 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `kurdistan`
- **Country:** IRQ
- **Tier:** static
- **Kind:** solar
- **Source:** KRG Ministry fallback
- **Source URL:** [https://gov.krd/moel-en/](https://gov.krd/moel-en/)
- **Loader:** [`kurdistan.json.ts`](../../src/data/kurdistan.json.ts)
- **Structural gap:** yes

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** KRG no public data; structural gap
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

Structural gap: no public hourly archive.

## Links

- Loader source: [`kurdistan.json.ts`](../../src/data/kurdistan.json.ts)
- Backfill archive: `data/historical/backfill/*_kurdistan_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
