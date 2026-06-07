# Validation — Jeju (S. Korea) (`jeju`)

Last updated: 2026-06-06 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `jeju`
- **Country:** KOR
- **Tier:** estimated
- **Kind:** wind
- **Source:** KPX EPSIS KNRE assessed 2026-05-09: epsis.kpx.or.kr/epsisnew/selectKnreMain.do publishes renewable utilisation rate (신재생이용률) but requires an interactive SVG map click to set region code before data loads — server returns empty gridData without it. Session-dependent AJAX endpoint (selectKnreUtilRtoGridAjax.ajax POST) confirmed browser-only. No open API key path found. T1 blocked: interactive map required, not programmatically accessible.
- **Source URL:** [https://epsis.kpx.or.kr/epsisnew/selectKnreMain.do](https://epsis.kpx.or.kr/epsisnew/selectKnreMain.do)
- **Loader:** [`jeju.json.ts`](../../src/data/jeju.json.ts)
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** KPX 2024 Jeju wind+solar curtailment ~0.15 TWh
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

No region-specific limitations recorded. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: [`jeju.json.ts`](../../src/data/jeju.json.ts)
- Backfill archive: `data/historical/backfill/*_jeju_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
