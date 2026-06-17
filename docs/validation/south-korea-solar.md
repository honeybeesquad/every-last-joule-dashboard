# Validation — South Korea Solar (`south-korea-solar`)

Last updated: 2026-06-17 · South Korea per-fuel anchor split · T3 modelled

## Source

- **Region id:** `south-korea-solar`
- **Country:** KOR
- **Tier:** estimated
- **Kind:** solar
- **Source:** KPX EPSIS KNRE 2024: mainland solar utilization ~13%, 27 GW installed, ~5% curtailment rate (IEA/KPX). EPSIS AJAX returns 0% headless, so the loader falls back to the ~0.5 TWh IEA anchor (no fabricated data).
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

- **TSO annual curtailment (latest published):** KPX 2024 mainland solar curtailment ~0.5 TWh (IEA anchor, excl. Jeju)
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_No backfill and no TSO anchor parquet. Region relies on the published IEA/KPX annual anchor split across the typical-shape profile; solar reads 0 at local night by construction._

## Known limitations

No region-specific limitations recorded. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: [`south-korea.json.ts`](../../src/data/south-korea.json.ts)
- Backfill archive: `data/historical/backfill/*_south-korea-solar_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
