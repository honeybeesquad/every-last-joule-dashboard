# Validation — Sichuan (`sichuan`)

Last updated: 2026-04-24 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `sichuan`
- **Country:** CHN
- **Tier:** static
- **Kind:** hydro
- **Source:** NEA 2024 / Sichuan hydro-spill proxy
- **Source URL:** [https://www.nea.gov.cn/20251113/cc1fb0298a2944f8bd5441f67c9be9b3/c.html](https://www.nea.gov.cn/20251113/cc1fb0298a2944f8bd5441f67c9be9b3/c.html)
- **Loader:** _(no single-file loader — see multi-region source)_
- **Structural gap:** yes

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** Ember China 2024 Sichuan ~8 TWh hydro spill
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

No public hourly archive for Chinese provincial dispatch-down. The mechanism is wet-season hydro spill (Dadu, Yalong, Jinsha river basins) plus occasional local transmission/export limits; the loader emits a hydro-seasonal shape (no diurnal peak — spill is monthly, not hour-of-day) scaled to a 30 TWh/yr central estimate from NEA 2024 river-basin utilisation, Huaon/NBS Sichuan generation, and a public July 2024 report citing 3.37 TWh of dispatch-controlled hydro spill in that single month. Annualising one monsoon month is inherently uncertain — uncertainty range 20–36 TWh, low confidence. T3-modelled, ±40% envelope; see `docs/known-limitations.md` item 10 and `docs/methodology/china-provinces.md` for the basin-to-province mapping and full source chain.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_sichuan_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
