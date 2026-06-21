# Validation — Taiwan (`taiwan`)

Last updated: 2026-06-21 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `taiwan`
- **Country:** TWN
- **Tier:** estimated
- **Kind:** mixed
- **Source:** TAIPOWER 2023 Sustainability Report: ~0.3 TWh/yr curtailment anchor (2023 actual). Live promotion attempted 2026-04-29, reverted: TAIPOWER genary.json exposes instantaneous unit output, no curtailment archive or daily CSV. MOEA/TAIPOWER publish annual aggregate in PDF only. T1 not achievable until a daily machine-readable endpoint is published.
- **Source URL:** [https://www.taipower.com.tw/en/](https://www.taipower.com.tw/en/)
- **Loader:** [`taiwan.json.ts`](../../src/data/taiwan.json.ts)
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** Taipower 2024 RES curtailment ~0.3 TWh
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

No region-specific limitations recorded. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: [`taiwan.json.ts`](../../src/data/taiwan.json.ts)
- Backfill archive: `data/historical/backfill/*_taiwan_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
