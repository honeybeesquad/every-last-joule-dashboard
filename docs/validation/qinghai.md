# Validation — Qinghai (`qinghai`)

Last updated: 2026-06-06 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `qinghai`
- **Country:** CHN
- **Tier:** estimated
- **Kind:** solar
- **Source:** NEA 2024 / Huaon-NBS generation
- **Source URL:** [https://www.nea.gov.cn/20251113/cc1fb0298a2944f8bd5441f67c9be9b3/c.html](https://www.nea.gov.cn/20251113/cc1fb0298a2944f8bd5441f67c9be9b3/c.html)
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

- **TSO annual curtailment (latest published):** Ember China 2024 Qinghai ~4 TWh
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

No public hourly archive for Chinese provincial dispatch-down. The mechanism is solar-dominated midday and shoulder-hour curtailment in the Haixi/Qinghai clean-energy export corridor with a smaller wind component; the loader emits a typical solar shape (peak UTC 5) scaled to a 4.1 TWh/yr central estimate from NEA 2024 wind/PV utilisation × Huaon/NBS Qinghai generation by fuel. Uncertainty range 3.3–5.2 TWh, medium confidence. T3-modelled, ±40% envelope; see `docs/known-limitations.md` item 10 and `docs/methodology/china-provinces.md`.

## Links

- Loader source: [`qinghai.json.ts`](../../src/data/qinghai.json.ts)
- Backfill archive: `data/historical/backfill/*_qinghai_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
