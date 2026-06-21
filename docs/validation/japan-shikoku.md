# Validation — Shikoku (Japan) (`japan-shikoku`)

Last updated: 2026-06-21 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `japan-shikoku`
- **Country:** JPN
- **Tier:** live
- **Kind:** solar
- **Source:** Shikoku Electric Power T&D area supply/demand CSV (eria_jukyu_YYYYMM_08.csv) — direct 太陽光出力制御量+風力出力制御量 columns (MW, 30-min).
- **Source URL:** [https://www.yonden.co.jp/nw/supply_demand/data_download.html](https://www.yonden.co.jp/nw/supply_demand/data_download.html)
- **Loader:** [`japan-shikoku.json.ts`](../../src/data/japan-shikoku.json.ts)
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

_Pending: no backfill parquet yet for this region. Once HB.1 / HB.2 land the per-year totals for this region, this section will summarise the Δ vs TSO/Ember/IRENA and flag any year exceeding ±25%._

## Known limitations

No region-specific limitations recorded. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: [`japan-shikoku.json.ts`](../../src/data/japan-shikoku.json.ts)
- Backfill archive: `data/historical/backfill/*_japan-shikoku_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
