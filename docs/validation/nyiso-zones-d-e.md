# Validation — NYISO Zones D+E (`nyiso-zones-d-e`)

Last updated: 2026-06-07 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `nyiso-zones-d-e`
- **Country:** USA
- **Tier:** live
- **Kind:** wind
- **Source:** EIA NYISO wind (Zones D+E share, ~75% of statewide curtailment)
- **Source URL:** [https://www.nyiso.com/documents/20142/2223020/2024-Power-Trends.pdf](https://www.nyiso.com/documents/20142/2223020/2024-Power-Trends.pdf)
- **Loader:** [`nyiso.json.ts`](../../src/data/nyiso.json.ts)
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| 2023 | — | — | 0.122 | — | — |

## Published anchors

- **TSO annual curtailment (latest published):** NYISO statewide ~0.162 TWh wind (2023); Zones D+E ~75% share
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

No region-specific limitations recorded. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: [`nyiso.json.ts`](../../src/data/nyiso.json.ts)
- Backfill archive: `data/historical/backfill/*_nyiso-zones-d-e_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
