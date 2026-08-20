# Validation — Malaysia (`malaysia`)

Last updated: 2026-08-20 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `malaysia`
- **Country:** MYS
- **Tier:** estimated
- **Kind:** solar
- **Source:** GSO Malaysia live solar generation (gso.org.my, 10-min) × 1.0% calibrated curtailment rate (Suruhanjaya Tenaga / IRENA 2024 anchor ~0.15 TWh/yr Peninsular Malaysia solar curtailment). GSO publishes real-time solar generation in MW at 10-min cadence without authentication; the loader applies the published rate to estimate curtailment.
- **Source URL:** [https://www.gso.org.my/](https://www.gso.org.my/)
- **Loader:** [`malaysia.json.ts`](../../src/data/malaysia.json.ts)
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** TNB 2024 RES curtailment low
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

No region-specific limitations recorded. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: [`malaysia.json.ts`](../../src/data/malaysia.json.ts)
- Backfill archive: `data/historical/backfill/*_malaysia_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
