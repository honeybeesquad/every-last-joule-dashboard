# Validation — Qinghai Wind (`qinghai-wind`)

Last updated: 2026-08-20 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `qinghai-wind`
- **Country:** CHN
- **Tier:** estimated
- **Kind:** wind
- **Source:** Ember China subnational generation (trailing 12mo) × NEA 2024 curtailment rate 7.2% (utilisation 92.8%); refreshed anchor, T3-modelled shape
- **Source URL:** [https://www.cpnn.com.cn/news/xny/202502/t20250219_1773747.html](https://www.cpnn.com.cn/news/xny/202502/t20250219_1773747.html)
- **Loader:** [`qinghai.json.ts`](../../src/data/qinghai.json.ts)
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

- Loader source: [`qinghai.json.ts`](../../src/data/qinghai.json.ts)
- Backfill archive: `data/historical/backfill/*_qinghai-wind_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
