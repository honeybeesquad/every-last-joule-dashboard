# Validation — Malaysia (`malaysia`)

Last updated: 2026-05-05 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `malaysia`
- **Country:** MYS
- **Tier:** static
- **Kind:** solar
- **Source:** IRENA Malaysia 2024 + Suruhanjaya Tenaga (ST) 2024 anchor (~0.15 TWh/yr provisional). Gemini-3.1 research wave 2026-04-29: SEDA / ST policy classifies systemic renewable curtailment as a 'rising risk' for Peninsular Malaysia but reports current operations as stable; no published annual curtailment TWh figure exists yet. Live promotion attempt reverted (GSO real-time solar feed is generation-only, not curtailment). Held at T3 pending publication of a real curtailment figure.
- **Source URL:** [https://www.gso.org.my/](https://www.gso.org.my/)
- **Loader:** [`malaysia.json.ts`](../../src/data/malaysia.json.ts)
- **Structural gap:** yes

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

Region is a **structural gap**: no public hourly archive available, so backfill is not possible. Current live snapshot is populated from an annual anchor (Ember / IRENA / GGFR) and scaled by a typical-day profile where applicable. See `docs/known-limitations.md` for the full structural-gap list.

## Links

- Loader source: [`malaysia.json.ts`](../../src/data/malaysia.json.ts)
- Backfill archive: `data/historical/backfill/*_malaysia_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
