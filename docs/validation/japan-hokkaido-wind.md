# Validation — Hokkaido Wind (Japan) (`japan-hokkaido-wind`)

Last updated: 2026-06-17 · Sprint: Japan fuel split · Paper section: Technical Validation §4.2

## Source

- **Region id:** `japan-hokkaido-wind`
- **Country:** JPN
- **Tier:** live
- **Kind:** wind
- **Source:** Hokkaido Electric Power Network area supply/demand CSV (eria_jukyu_YYYYMM_01.csv) — 風力出力制御量 column (MW, 30-min, Shift-JIS). Wind share of measured curtailment (~16.4% of total, 5.8 GWh/30d).
- **Source URL:** [https://www.hepco.co.jp/network/con_service/public_document/supply_demand_results/index.html](https://www.hepco.co.jp/network/con_service/public_document/supply_demand_results/index.html)
- **Loader:** [`japan-hokkaido.json.ts`](../../src/data/japan-hokkaido.json.ts)
- **Structural gap:** no

## Split rationale

30-day measurement (May–June 2026) found wind curtailment at ~16.4% of total Hokkaido measured curtailment (~5.8 GWh/30d). This is above the 5% below-noise-floor threshold applied to the other 7 Japan areas, so Hokkaido is split into separate solar and wind regions. Wind figures are directly measured (風力出力制御量 column), not modelled.

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

- Loader source: [`japan-hokkaido.json.ts`](../../src/data/japan-hokkaido.json.ts)
- Backfill archive: `data/historical/backfill/*_japan-hokkaido-wind_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
