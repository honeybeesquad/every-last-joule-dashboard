# Validation — Tibet (Xizang) (`tibet`)

Last updated: 2026-04-30 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `tibet`
- **Country:** CHN
- **Tier:** static
- **Kind:** hydro
- **Source:** NEA 2024 / Huaon-NBS generation
- **Source URL:** [https://www.nea.gov.cn/20251113/cc1fb0298a2944f8bd5441f67c9be9b3/c.html](https://www.nea.gov.cn/20251113/cc1fb0298a2944f8bd5441f67c9be9b3/c.html)
- **Loader:** [`tibet.json.ts`](../../src/data/tibet.json.ts)
- **Structural gap:** yes

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** Ember China 2024 Tibet ~1 TWh
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

No public hourly archive for Chinese provincial dispatch-down. The mechanism is mostly PV curtailment on a small high-altitude grid with some wind and hydro-spill risk; the loader emits a hydro-seasonal shape scaled to a 0.6 TWh/yr central estimate. NEA's 2024 PV utilisation for Tibet was only 68.6% (low among provinces), but absolute 2024 PV generation was just 1.11 TWh, so the central estimate is 0.6 TWh rather than the previous 3.0 TWh anchor. There is no direct Yarlung-Tsangpo curtailment volume published, so only a small hydro-spill proxy is included. Uncertainty range 0.4–0.9 TWh, low confidence. T3-modelled, ±40% envelope; see `docs/known-limitations.md` item 10 and `docs/methodology/china-provinces.md`.

## Links

- Loader source: [`tibet.json.ts`](../../src/data/tibet.json.ts)
- Backfill archive: `data/historical/backfill/*_tibet_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
