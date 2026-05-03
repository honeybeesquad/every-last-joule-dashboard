# Validation — Namibia (`namibia`)

Last updated: 2026-05-03 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `namibia`
- **Country:** NAM
- **Tier:** static
- **Kind:** solar
- **Source:** NamPower ISB 2025
- **Source URL:** [https://www.nampower.com.na/](https://www.nampower.com.na/)
- **Loader:** [`namibia.json.ts`](../../src/data/namibia.json.ts)
- **Structural gap:** yes

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** NamPower 2024 RES curtailment minimal
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

Region is a **structural gap**: no public hourly archive available, so backfill is not possible. Current live snapshot is populated from an annual anchor (Ember / IRENA / GGFR) and scaled by a typical-day profile where applicable. See `docs/known-limitations.md` for the full structural-gap list.

## Links

- Loader source: [`namibia.json.ts`](../../src/data/namibia.json.ts)
- Backfill archive: `data/historical/backfill/*_namibia_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
