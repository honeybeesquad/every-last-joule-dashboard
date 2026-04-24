# Validation — UAE (`uae`)

Last updated: 2026-04-24 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `uae`
- **Country:** ARE
- **Tier:** static
- **Kind:** solar
- **Source:** DEWA/EWEC fallback
- **Source URL:** [https://www.dewa.gov.ae/](https://www.dewa.gov.ae/)
- **Loader:** [`uae.json.ts`](../../src/data/uae.json.ts)
- **Structural gap:** yes

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** DEWA/EWEC 2024 PV curtailment low
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

Structural gap for hourly.

## Links

- Loader source: [`uae.json.ts`](../../src/data/uae.json.ts)
- Backfill archive: `data/historical/backfill/*_uae_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
