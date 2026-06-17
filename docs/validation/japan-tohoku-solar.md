# Validation — Tohoku Solar (Japan) (`japan-tohoku-solar`)

Last updated: 2026-06-17 · Sprint: Japan fuel split · Paper section: Technical Validation §4.2

## Source

- **Region id:** `japan-tohoku-solar`
- **Country:** JPN
- **Tier:** live
- **Kind:** solar
- **Source:** Tohoku Electric area supply/demand CSV (realtime_jukyu_YYYYMMDD_02.csv) — 太陽光出力制御量 column (MW, 30-min, Shift-JIS). Solar share of measured curtailment.
- **Source URL:** [https://setsuden.nw.tohoku-epco.co.jp/common/demand/realtime_jukyu/](https://setsuden.nw.tohoku-epco.co.jp/common/demand/realtime_jukyu/)
- **Loader:** [`japan-tohoku.json.ts`](../../src/data/japan-tohoku.json.ts)
- **Structural gap:** no

## Split rationale

30-day measurement (May–June 2026) found wind curtailment at ~12.3% of total Tohoku measured curtailment (~13.5 GWh/30d). This is above the 5% below-noise-floor threshold, so Tohoku is split into separate solar and wind regions. FY2023 OCCTO anchor: ~0.13 TWh solar curtailment; rising trend ~1.5-2 TWh/yr by FY2025.

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
- **Other:** FY2023 OCCTO anchor: ~0.13 TWh solar curtailment

## Discrepancy analysis

_Pending: no backfill parquet yet for this region. Once HB.1 / HB.2 land the per-year totals for this region, this section will summarise the Δ vs TSO/Ember/IRENA and flag any year exceeding ±25%._

## Known limitations

No region-specific limitations recorded. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: [`japan-tohoku.json.ts`](../../src/data/japan-tohoku.json.ts)
- Backfill archive: `data/historical/backfill/*_japan-tohoku-solar_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
