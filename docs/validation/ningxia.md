# Validation — Ningxia (`ningxia`)

Last updated: 2026-05-02 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `ningxia`
- **Country:** CHN
- **Tier:** static
- **Kind:** mixed
- **Source:** NEA 2024 / Huaon-NBS generation
- **Source URL:** [https://www.nea.gov.cn/20251113/cc1fb0298a2944f8bd5441f67c9be9b3/c.html](https://www.nea.gov.cn/20251113/cc1fb0298a2944f8bd5441f67c9be9b3/c.html)
- **Loader:** [`ningxia.json.ts`](../../src/data/ningxia.json.ts)
- **Structural gap:** yes

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** Ember China 2024 Ningxia ~2.5 TWh
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

No public hourly archive for Chinese provincial dispatch-down. The mechanism is balanced wind+PV curtailment on a smaller provincial grid with high renewable penetration and finite export/industrial absorption; the loader emits a 50/50 wind+solar mixed shape (solar peak UTC 4.5, wind peak UTC 15) scaled to a 2.0 TWh/yr central estimate from NEA 2024 wind/PV utilisation × Huaon/NBS Ningxia generation by fuel. Uncertainty range 1.5–2.6 TWh, medium confidence. T3-modelled, ±40% envelope; see `docs/known-limitations.md` item 10 and `docs/methodology/china-provinces.md`.

## Links

- Loader source: [`ningxia.json.ts`](../../src/data/ningxia.json.ts)
- Backfill archive: `data/historical/backfill/*_ningxia_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
