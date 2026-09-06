# Validation — Bangladesh (`bangladesh`)

Last updated: 2026-08-20 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `bangladesh`
- **Country:** BGD
- **Tier:** estimated
- **Kind:** solar
- **Source:** PGCB hourly generation-by-fuel dashboard (measured solar diurnal shape) scaled to an unattributed 0.1 TWh/yr repo curtailment estimate
- **Source URL:** [https://erp.powergrid.gov.bd/web/generations/view_generations_bn](https://erp.powergrid.gov.bd/web/generations/view_generations_bn)
- **Loader:** [`bangladesh.json.ts`](../../src/data/bangladesh.json.ts)
- **Structural gap:** no

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

- **The magnitude is modelled; only the shape is measured.** The loader reads PGCB's hourly solar
  generation column and uses it for the 24-hour profile, then rescales that curve so it integrates
  to a 0.1 TWh/yr annual curtailment anchor. That anchor is the repo's own estimate, carried over
  unchanged from the earlier BPDB fallback. It is not attributable to any published source, and it
  is the weakest link in this region.
- **The implied rate is the number to challenge.** Against the generation observed in the rolling
  window, the 0.1 TWh/yr anchor implies a curtailment rate near 9%. The loader recomputes and prints
  that rate in `sourceNote` on every build so it cannot drift out of sight. The only published
  figure found during the 2026-09-06 review was a secondary market-research claim of 15-20% midday
  curtailment in the northern divisions — regional, midday-only, and not a national annual rate, so
  it was not used.
- **The window is short.** PGCB exposes roughly 48 hours of hourly rows, not 30 days, so the profile
  is a two-day hour-of-day mean. `totalTWh` is derived from the anchored curve rather than summed
  over the points, because summing a 48-hour window into a field the dataset reads as 30 days would
  understate it by about 14x.
- **`latestProfile` is often null.** A complete UTC day needs all 24 hours present. PGCB drops the
  occasional hour and sometimes files a half-hour row, so many windows contain no gap-free UTC day.
- **TLS chain is broken upstream.** `erp.powergrid.gov.bd` serves only its leaf certificate and omits
  the intermediate, so strict clients cannot build a chain. The loader relaxes chain verification and
  checks the peer certificate's subject CN and issuer explicitly instead.

See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: [`bangladesh.json.ts`](../../src/data/bangladesh.json.ts)
- Backfill archive: `data/historical/backfill/*_bangladesh_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
