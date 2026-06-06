# Validation — Atacama (`atacama`)

Last updated: 2026-06-06 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `atacama`
- **Country:** CHL
- **Tier:** live
- **Kind:** solar
- **Source:** CEN Chile XLSX
- **Source URL:** [https://www.coordinador.cl/operacion/documentos/reducciones-de-generacion-renovable/](https://www.coordinador.cl/operacion/documentos/reducciones-de-generacion-renovable/)
- **Loader:** _(no single-file loader — see multi-region source)_
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** CEN 2024 Atacama solar curtailment ~2 TWh (MRE / central system dispatch restrictions)
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

Cloudflare-gated; live feed via Playwright-Chrome bypass (see src/data/atacama-chile.json.ts). Backfill not yet attempted — would require Playwright-driven archive scrape.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_atacama_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
