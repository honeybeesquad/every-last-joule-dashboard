# Validation — Gansu (`gansu`)

Last updated: 2026-05-05 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `gansu`
- **Country:** CHN
- **Tier:** static
- **Kind:** mixed
- **Source:** NEA 2024 / Gansu MIIT generation
- **Source URL:** [https://www.nea.gov.cn/20251113/cc1fb0298a2944f8bd5441f67c9be9b3/c.html](https://www.nea.gov.cn/20251113/cc1fb0298a2944f8bd5441f67c9be9b3/c.html)
- **Loader:** [`gansu.json.ts`](../../src/data/gansu.json.ts)
- **Structural gap:** yes

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** Ember China 2024 Gansu wind+solar curtailment ~12 TWh
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

No public hourly archive for Chinese provincial dispatch-down. The mechanism is mixed Jiuquan/Wuwei wind and solar export congestion; the loader emits a typical wind+solar mixed shape (60% wind / 40% solar, peaks at UTC 5 / 15) scaled to a 6.1 TWh/yr 2024 central estimate from NEA wind/PV utilisation rates (94.0% wind, 91.3% PV) applied to Gansu's own 2024 power-production release (45.789 TWh wind generation, 33.704 TWh PV generation). T3-modelled, ±40% envelope; see `docs/known-limitations.md` item 10 and `docs/methodology/china-provinces.md` for the full source chain.

The published TSO annual line above (~12 TWh) is the older Ember-era rough cut superseded by the NEA 2024 calibration, kept only as a historical anchor.

## Links

- Loader source: [`gansu.json.ts`](../../src/data/gansu.json.ts)
- Backfill archive: `data/historical/backfill/*_gansu_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
