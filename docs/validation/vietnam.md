# Validation — Vietnam (`vietnam`)

Last updated: 2026-06-18 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `vietnam`
- **Country:** VNM
- **Tier:** estimated
- **Kind:** solar
- **Source:** EVN/NLDC assessed 2026-05-09: NLDC (nldc.evn.vn) publishes daily dispatch reports as PDF only; no machine-readable CSV/JSON endpoint found. EVN open data portal does not expose curtailment data. EREA and World Bank USAID SAVE project cite 20–35% curtailment rates in Central/South-Central provinces 2023 (~2+ TWh/yr estimated), but only as PDF reports. T1 blocked: PDF-only, no programmatic endpoint.
- **Source URL:** [https://nldc.evn.vn/](https://nldc.evn.vn/)
- **Loader:** [`vietnam.json.ts`](../../src/data/vietnam.json.ts)
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** EVN 2024 solar curtailment ~3 TWh (2022 peak, tapering)
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

No region-specific limitations recorded. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: [`vietnam.json.ts`](../../src/data/vietnam.json.ts)
- Backfill archive: `data/historical/backfill/*_vietnam_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
