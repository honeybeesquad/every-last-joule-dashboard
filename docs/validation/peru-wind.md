# Validation — Peru Wind (`peru-wind`)

Last updated: 2026-05-04 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `peru-wind`
- **Country:** PER
- **Tier:** live
- **Kind:** wind
- **Source:** COES-SINAC live wind generation × 2% curtailment calibration (vertimiento anchor ~0.8 TWh/yr)
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

- **TSO annual curtailment (latest published):** —
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_No backfill and no child-level TSO anchor. Region relies on the live COES generation-by-fuel shape and the aggregate vertimiento calibration._

## Known limitations

The COES loader emits a calibrated generation proxy rather than direct dispatch-down telemetry. `sourceStatus="live"` means the COES generation endpoint was reachable and returned recent wind observations; the 2% curtailment multiplier and aggregate annual anchor remain the limiting assumptions.

## Links

- Loader source: [`peru.json.ts`](../../src/data/peru.json.ts)
- Backfill archive: `data/historical/backfill/*_peru-wind_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
