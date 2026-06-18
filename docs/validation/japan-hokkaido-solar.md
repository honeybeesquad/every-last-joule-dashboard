# Validation — Hokkaido Solar (Japan) (`japan-hokkaido-solar`)

Last updated: 2026-06-18 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `japan-hokkaido-solar`
- **Country:** JPN
- **Tier:** live
- **Kind:** solar
- **Source:** Hokkaido Electric Power Network area supply/demand CSV (eria_jukyu_YYYYMM_01.csv) — 太陽光出力制御量 column (MW, 30-min). Solar share of measured curtailment.
- **Source URL:** [https://www.hepco.co.jp/network/con_service/public_document/supply_demand_results/index.html](https://www.hepco.co.jp/network/con_service/public_document/supply_demand_results/index.html)
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

_Pending: no backfill parquet yet for this region. Once HB.1 / HB.2 land the per-year totals for this region, this section will summarise the Δ vs TSO/Ember/IRENA and flag any year exceeding ±25%._

## Known limitations

No region-specific limitations recorded. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_japan-hokkaido-solar_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
