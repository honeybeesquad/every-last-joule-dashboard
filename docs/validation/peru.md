# Validation — Peru (`peru`)

Last updated: 2026-04-24 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `peru`
- **Country:** PER
- **Tier:** live
- **Kind:** mixed
- **Source:** COES-SINAC
- **Source URL:** [https://www.coes.org.pe/Portal/portalinformacion/generacion](https://www.coes.org.pe/Portal/portalinformacion/generacion)
- **Loader:** [`peru.json.ts`](../../src/data/peru.json.ts)
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** COES-SINAC 2024 solar curtailment ~0.2 TWh
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

No region-specific limitations recorded. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: [`peru.json.ts`](../../src/data/peru.json.ts)
- Backfill archive: `data/historical/backfill/*_peru_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
