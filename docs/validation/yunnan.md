# Validation — Yunnan (`yunnan`)

Last updated: 2026-05-05 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `yunnan`
- **Country:** CHN
- **Tier:** static
- **Kind:** hydro
- **Source:** NEA 2024 / Yunnan statistics
- **Source URL:** [https://www.nea.gov.cn/20251113/cc1fb0298a2944f8bd5441f67c9be9b3/c.html](https://www.nea.gov.cn/20251113/cc1fb0298a2944f8bd5441f67c9be9b3/c.html)
- **Loader:** [`yunnan.json.ts`](../../src/data/yunnan.json.ts)
- **Structural gap:** yes

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** Ember China 2024 Yunnan ~5 TWh hydro spill
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

No public hourly archive for Chinese provincial dispatch-down. The older 10 TWh hydro-heavy anchor is not supported by the 2024 NEA river-basin utilisation table — Lancang River utilisation was 99.85%, and Yunnan's 2024 wind/PV curtailment calculation is only about 1.3 TWh. The loader emits a hydro-seasonal shape scaled to a recalibrated 1.8 TWh/yr central estimate (~1.3 TWh wind+PV curtailment + small hydro-spill proxy for monsoon storage constraints). Confidence remains low because province-level hydro spill is not published; uncertainty range 1.0–2.8 TWh. T3-modelled, ±40% envelope; see `docs/known-limitations.md` item 10 and `docs/methodology/china-provinces.md`.

## Links

- Loader source: [`yunnan.json.ts`](../../src/data/yunnan.json.ts)
- Backfill archive: `data/historical/backfill/*_yunnan_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
