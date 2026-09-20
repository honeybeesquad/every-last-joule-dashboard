# Validation — Bangladesh (`bangladesh`)

Last updated: 2026-08-20 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `bangladesh`
- **Country:** BGD
- **Tier:** estimated
- **Kind:** solar
- **Source:** PGCB hourly solar generation (erp.powergrid.gov.bd). Waste unpublished — no national curtailment series. The previous 0.1 TWh/yr repo estimate was dropped.
- **Source URL:** [https://erp.powergrid.gov.bd/web/generations/view_generations_bn](https://erp.powergrid.gov.bd/web/generations/view_generations_bn)
- **Loader:** [`bangladesh.json.ts`](../../src/data/bangladesh.json.ts)
- **Structural gap:** no
- **Waste status:** unpublished. Missing ≠ zero. Live generation does not make waste T1a.

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** none. PGCB publishes hourly generation by fuel, not curtailment, and no Bangladeshi operator publishes a national curtailment total or rate. BPDB 2024 RES curtailment is described as minimal (coal-dominant grid) but is not quantified.
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

- **Waste is unpublished.** PGCB publishes hourly solar generation, not curtailment, and
  Bangladesh has no published national curtailment rate. The 0.1 TWh/yr figure this
  region used to carry was the repo's own estimate and has been dropped. Do not read a
  zero waste `profile` as a measured finding.
- **The window is short.** PGCB exposes roughly 48 hours of hourly rows. The 30-day
  generation total is annualised from the diurnal mean, not summed over two days.
- **TLS chain is broken upstream.** `erp.powergrid.gov.bd` serves only its leaf
  certificate. The loader relaxes chain verification and checks CN/issuer explicitly.

See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: [`bangladesh.json.ts`](../../src/data/bangladesh.json.ts)
- Backfill archive: `data/historical/backfill/*_bangladesh_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
