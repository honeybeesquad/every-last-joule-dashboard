# Validation — France (`france`)

Last updated: 2026-04-29 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `france`
- **Country:** FRA
- **Tier:** live
- **Kind:** mixed
- **Source:** RTE eco2mix wind+solar
- **Source URL:** [https://odre.opendatasoft.com/](https://odre.opendatasoft.com/)
- **Loader:** [`france.json.ts`](../../src/data/france.json.ts)
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| 2024 | — | — | 1.200 | — | — |

## Published anchors

- **TSO annual curtailment (latest published):** RTE Bilan prévisionnel 2024: wind+solar écrêtement ~1.2 TWh
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** RTE Bilan électrique 2024

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

No region-specific limitations recorded. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: [`france.json.ts`](../../src/data/france.json.ts)
- Backfill archive: `data/historical/backfill/*_france_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
