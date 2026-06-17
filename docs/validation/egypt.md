# Validation — Egypt (`egypt`)

Last updated: 2026-06-17 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `egypt`
- **Country:** EGY
- **Tier:** estimated
- **Kind:** solar
- **Source:** NREA/EETC assessed 2026-05-09: Egypt's grid operator (EETC) does not publish public dispatch or curtailment data. NREA (nrea.gov.eg) publishes capacity statistics only — no curtailment MWh. Benban 1,650 MW solar complex has documented transmission-constrained curtailment (World Bank 2022–2024 reports cite significant curtailment due to grid constraints), but no machine-readable source found. T1 blocked: no public dispatch API.
- **Source URL:** [https://nrea.gov.eg/](https://nrea.gov.eg/)
- **Loader:** [`egypt.json.ts`](../../src/data/egypt.json.ts)
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** EETC 2024 RES curtailment ~0.2 TWh
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

No region-specific limitations recorded. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: [`egypt.json.ts`](../../src/data/egypt.json.ts)
- Backfill archive: `data/historical/backfill/*_egypt_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
