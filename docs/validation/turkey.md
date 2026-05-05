# Validation — Turkey (`turkey`)

Last updated: 2026-05-05 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `turkey`
- **Country:** TUR
- **Tier:** live
- **Kind:** mixed
- **Source:** EPIAS Transparency dashboard wind+solar
- **Source URL:** [https://seffaflik.epias.com.tr/electricity-service/v1/dashboard/realtime-generation](https://seffaflik.epias.com.tr/electricity-service/v1/dashboard/realtime-generation)
- **Loader:** [`turkey.json.ts`](../../src/data/turkey.json.ts)
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** TEİAŞ/EPİAŞ 2024 RES curtailment ~0.5 TWh (estimate)
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** EPIAS Transparency Dashboard

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

No region-specific limitations recorded. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: [`turkey.json.ts`](../../src/data/turkey.json.ts)
- Backfill archive: `data/historical/backfill/*_turkey_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
