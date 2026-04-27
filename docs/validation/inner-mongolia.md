# Validation — Inner Mongolia (`inner-mongolia`)

Last updated: 2026-04-27 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `inner-mongolia`
- **Country:** CHN
- **Tier:** static
- **Kind:** wind
- **Source:** NEA 2024 / Huaon-NBS generation
- **Source URL:** [https://www.nea.gov.cn/20251113/cc1fb0298a2944f8bd5441f67c9be9b3/c.html](https://www.nea.gov.cn/20251113/cc1fb0298a2944f8bd5441f67c9be9b3/c.html)
- **Loader:** [`inner-mongolia.json.ts`](../../src/data/inner-mongolia.json.ts)
- **Structural gap:** yes

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** Ember China 2024 Inner Mongolia ~18 TWh
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

No public hourly archive for Chinese provincial dispatch-down. The mechanism is wind-dominant transmission bottlenecking in the Monxi/Mongdong grids with smaller PV shoulder-hour curtailment; the loader emits a typical wind shape (peak UTC 15) scaled to a 12.6 TWh/yr central estimate from NEA Monxi/Mongdong wind/PV utilisation × Huaon/NBS Inner Mongolia generation by fuel. NEA reports Monxi and Mongdong separately; the central value uses the simple wind-rate average because the public generation series is province-level. Uncertainty range 10.5–15.0 TWh, medium confidence. T3-modelled, ±40% envelope; see `docs/known-limitations.md` item 10 and `docs/methodology/china-provinces.md`.

## Links

- Loader source: [`inner-mongolia.json.ts`](../../src/data/inner-mongolia.json.ts)
- Backfill archive: `data/historical/backfill/*_inner-mongolia_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
