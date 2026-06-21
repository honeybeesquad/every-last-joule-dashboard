# Validation — Sichuan Solar (`sichuan-solar`)

Last updated: 2026-06-21 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `sichuan-solar`
- **Country:** CHN
- **Tier:** estimated
- **Kind:** solar
- **Source:** NEA 2024 provincial RE monitoring bulletin — solar curtailment (~0.3 TWh/yr, growing distributed PV in Chengdu basin)
- **Source URL:** [https://www.nea.gov.cn/20251113/cc1fb0298a2944f8bd5441f67c9be9b3/c.html](https://www.nea.gov.cn/20251113/cc1fb0298a2944f8bd5441f67c9be9b3/c.html)
- **Loader:** [`sichuan.json.ts`](../../src/data/sichuan.json.ts)
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

- Loader source: [`sichuan.json.ts`](../../src/data/sichuan.json.ts)
- Backfill archive: `data/historical/backfill/*_sichuan-solar_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
