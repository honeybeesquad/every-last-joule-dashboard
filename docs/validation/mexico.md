# Validation — Mexico (`mexico`)

Last updated: 2026-05-03 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `mexico`
- **Country:** MEX
- **Tier:** static
- **Kind:** solar
- **Source:** SENER PRODESEN 2024-2038 + CRE confiabilidad reports — ~1.2 TWh/yr solar+wind curtailment from northern-grid transmission saturation (Sonora/Chihuahua/Coahuila/Oaxaca). Excludes hydro vertimientos. Gemini-3.1 research wave 2 (2026-04-30).
- **Source URL:** [https://www.gob.mx/sener/documentos/programa-de-desarrollo-del-sistema-electrico-nacional-2024-2038](https://www.gob.mx/sener/documentos/programa-de-desarrollo-del-sistema-electrico-nacional-2024-2038)
- **Loader:** [`mexico.json.ts`](../../src/data/mexico.json.ts)
- **Structural gap:** yes

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** CENACE data portal offline; defer to Ember / IRENA anchor
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

Region is a **structural gap**: no public hourly archive available, so backfill is not possible. Current live snapshot is populated from an annual anchor (Ember / IRENA / GGFR) and scaled by a typical-day profile where applicable. See `docs/known-limitations.md` for the full structural-gap list.

## Links

- Loader source: [`mexico.json.ts`](../../src/data/mexico.json.ts)
- Backfill archive: `data/historical/backfill/*_mexico_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
