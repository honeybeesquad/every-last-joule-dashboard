# Validation — South Korea (mainland) (`south-korea`)

Last updated: 2026-06-06 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `south-korea`
- **Country:** KOR
- **Tier:** estimated
- **Kind:** solar
- **Source:** KPX EPSIS KNRE assessed 2026-05-09: same endpoint as Jeju (selectKnreMain.do) covers mainland solar. Interactive SVG map required — browser-only, not programmatically accessible. KEPCO open data portal (opendata.kepco.co.kr) does not expose curtailment data. KEA energy statistics are PDF-only. T1 blocked.
- **Source URL:** [https://epsis.kpx.or.kr/epsisnew/selectKnreMain.do](https://epsis.kpx.or.kr/epsisnew/selectKnreMain.do)
- **Loader:** [`south-korea.json.ts`](../../src/data/south-korea.json.ts)
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** KPX 2024 RES curtailment ~0.8 TWh
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

No region-specific limitations recorded. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: [`south-korea.json.ts`](../../src/data/south-korea.json.ts)
- Backfill archive: `data/historical/backfill/*_south-korea_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
