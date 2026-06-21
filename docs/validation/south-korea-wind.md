# Validation — South Korea Wind (`south-korea-wind`)

Last updated: 2026-06-21 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `south-korea-wind`
- **Country:** KOR
- **Tier:** estimated
- **Kind:** wind
- **Source:** KPX EPSIS KNRE 2024: mainland wind utilization ~14%, 2 GW installed, ~2% curtailment rate (IEA Korea). Falls back to the ~0.05 TWh anchor when EPSIS yields 0% (no fabricated data).
- **Source URL:** [https://epsis.kpx.or.kr/epsisnew/selectKnreMain.do](https://epsis.kpx.or.kr/epsisnew/selectKnreMain.do)
- **Loader:** _(no single-file loader — see multi-region source)_
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

_No backfill and no TSO anchor parquet. Region relies on the published IEA/KPX annual anchor split across the typical-shape profile; solar reads 0 at local night by construction._

## Known limitations

No region-specific limitations recorded. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_south-korea-wind_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
