# Validation — Hokuriku (Japan) (`japan-hokuriku`)

Last updated: 2026-05-10 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `japan-hokuriku`
- **Country:** JPN
- **Tier:** live
- **Kind:** solar
- **Source:** Hokuriku Electric juyo CSV (5-min solar) × 1% calibrated curtailment (OCCTO FY2024 Hokuriku anchor: ~0.02 TWh/yr)
- **Source URL:** [https://www.rikuden.co.jp/nw/denki-yoho/](https://www.rikuden.co.jp/nw/denki-yoho/)
- **Loader:** [`japan-hokuriku.json.ts`](../../src/data/japan-hokuriku.json.ts)
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

- Loader source: [`japan-hokuriku.json.ts`](../../src/data/japan-hokuriku.json.ts)
- Backfill archive: `data/historical/backfill/*_japan-hokuriku_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
