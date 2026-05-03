# Validation — Kurdistan (KRG) (`kurdistan`)

Last updated: 2026-05-03 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

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

No public hourly archive. The KRG Ministry of Electricity (`gov.krd/moel-en/`) public pages do not expose hourly solar curtailment data. The loader emits a typical solar shape (peak UTC 7) scaled to a nominal ~0.05 TWh/yr anchor — the smallest tracked anchor in the dataset, reflecting an early-stage solar deployment in the Kurdistan Region of Iraq. T3-modelled, ±40% envelope. The region is included for geographic completeness across Iraqi sub-regions (kurdistan / iraq-mainland / s-iraq flare) rather than because of dispatch-down volume; reviewers should treat it as a placeholder pending a public KRG generation/curtailment series.

## Links

- Loader source: [`kurdistan.json.ts`](../../src/data/kurdistan.json.ts)
- Backfill archive: `data/historical/backfill/*_kurdistan_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
