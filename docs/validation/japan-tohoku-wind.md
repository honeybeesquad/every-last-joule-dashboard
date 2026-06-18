# Validation — Tohoku Wind (Japan) (`japan-tohoku-wind`)

Last updated: 2026-06-17 · Sprint: Japan fuel split · Paper section: Technical Validation §4.2

## Source

- **Region id:** `japan-tohoku-wind`
- **Country:** JPN
- **Tier:** live
- **Kind:** wind
- **Source:** Tohoku Electric area supply/demand CSV (realtime_jukyu_YYYYMMDD_02.csv) — 風力出力制御量 column (MW, 30-min, Shift-JIS). Wind share of measured curtailment (~12.3% of total, 13.5 GWh/30d).
- **Source URL:** [https://setsuden.nw.tohoku-epco.co.jp/common/demand/realtime_jukyu/](https://setsuden.nw.tohoku-epco.co.jp/common/demand/realtime_jukyu/)
- **Loader:** [`japan-tohoku.json.ts`](../../src/data/japan-tohoku.json.ts)
- **Structural gap:** no

## Split rationale

30-day measurement (May–June 2026) found wind curtailment at ~12.3% of total Tohoku measured curtailment (~13.5 GWh/30d). This is above the 5% below-noise-floor threshold, so Tohoku is split into separate solar and wind regions. Wind figures are directly measured (風力出力制御量 column), not modelled. Tohoku is the largest wind-curtailment area in Japan, driven by transmission constraints in Tohoku region wind corridors.

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

_Pending: no backfill parquet yet for this region. Once HB.1 / HB.2 land the per-year totals for this region, this section will summarise the Δ vs TSO/Ember/IRENA and flag any year exceeding ±25%._

## Known limitations

No region-specific limitations recorded. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: [`japan-tohoku.json.ts`](../../src/data/japan-tohoku.json.ts)
- Backfill archive: `data/historical/backfill/*_japan-tohoku-wind_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
