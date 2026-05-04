# Validation — Denmark DK1 (`denmark-west`)

Last updated: 2026-05-04 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `denmark-west`
- **Country:** DNK
- **Tier:** live
- **Kind:** mixed
- **Source:** Energinet wind+solar (DK1)
- **Source URL:** [https://api.energidataservice.dk/](https://api.energidataservice.dk/)
- **Loader:** [`denmark.json.ts`](../../src/data/denmark.json.ts)
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| 2024 | — | — | 0.800 | — | — |

## Published anchors

- **TSO annual curtailment (latest published):** Energinet 2024 DK1 wind+solar afkobling ~0.8 TWh
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

No region-specific limitations recorded. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: [`denmark.json.ts`](../../src/data/denmark.json.ts)
- Backfill archive: `data/historical/backfill/*_denmark-west_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
