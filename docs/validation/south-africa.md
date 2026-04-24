# Validation — South Africa (`south-africa`)

Last updated: 2026-04-24 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `south-africa`
- **Country:** ZAF
- **Tier:** live
- **Kind:** mixed
- **Source:** Eskom Data Portal
- **Source URL:** [https://www.eskom.co.za/dataportal/](https://www.eskom.co.za/dataportal/)
- **Loader:** [`south-africa.json.ts`](../../src/data/south-africa.json.ts)
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** ESKOM 2024 RES curtailment modest; overshadowed by load-shedding mechanics
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** ESKOM Data Portal

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

No region-specific limitations recorded. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: [`south-africa.json.ts`](../../src/data/south-africa.json.ts)
- Backfill archive: `data/historical/backfill/*_south-africa_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
