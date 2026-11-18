# Validation — Canary Islands Solar (`canary-islands-solar`)

Last updated: 2026-11-18 · Sprint: Spain island systems (REE REData) · Paper section: Technical Validation §4.2

## Source

- **Region id:** `canary-islands-solar`
- **Country:** ESP
- **Tier:** estimated
- **Kind:** solar
- **Source:** REE REData daily solar PV generation, Canary Islands electric system (token-free). Daily totals only; the 24-hour shape is a typical solar curve, not measured. Waste unpublished — REData has no curtailment series and no mainland Spain rate is applied. Measured island curtailment may sit in ESIOS behind a token. Not T1a.
- **Source URL:** [https://apidatos.ree.es/en/datos/generacion/estructura-generacion](https://apidatos.ree.es/en/datos/generacion/estructura-generacion)
- **Loader:** [`spain-islands.json.ts`](../../src/data/spain-islands.json.ts)
- **Structural gap:** no
- **Waste status:** unpublished. Missing ≠ zero. Collected generation does not make waste T1a.

## Calibration

- **Rate source documented in:** none. No curtailment rate is applied; in particular no mainland Spain rate is borrowed.
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** —
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

<!-- BEGIN MANUAL -->
The loader requests `time_trunc=day&geo_trunc=electric_system&geo_limit=canarias&geo_ids=8742` and reads the solar PV (series id 1458) row. The first run, on 2026-11-18, summed 28.2 GWh over the 30 settled days 2026-10-18 to 2026-11-16.

Only the 30-day generation total is REE's. REData serves this widget at day, month and year resolution; `time_trunc=hour` returned HTTP 400 on 2026-11-18, for the peninsula as well as the islands. The 24-hour `generationProfile` is therefore a typical solar curve centred on local solar noon (13:00 UTC), scaled so it integrates to the 30-day total. It is not a measured shape. Do not read the zero `profile` as a measured waste finding.

Asked for a range ending on the fetch date, REData returns a full-day figure for the day still in progress, which cannot be a measured total. The loader leaves out the fetch date and the day before it, and counts a day only if the system's "Total generation" row carries it. Whether REE later revises settled days was not tested.
<!-- END MANUAL -->

## Known limitations

<!-- BEGIN MANUAL -->
- Measured curtailment for this system, if REE publishes it, would sit in ESIOS behind `ESIOS_API_TOKEN` (see [`spain-esios.json.ts`](../../src/data/spain-esios.json.ts)). The ESIOS indicator list answered 403 without a token on 2026-11-18, so no island curtailment indicator has been looked for.
- `apidatos.ree.es` sits behind an Incapsula bot wall. From a datacentre address on 2026-11-18 it answered 403 to about a third of requests. A 403 is retried three times; a build still blocked serves the last-good snapshot, which reads `degraded` once it is over 24 hours old.
- The REData documentation page was blocked by the same wall, so the geo ids and series ids were confirmed from successful responses, not from the documentation.
<!-- END MANUAL -->

## Links

- Loader source: [`spain-islands.json.ts`](../../src/data/spain-islands.json.ts)
- Backfill archive: `data/historical/backfill/*_canary-islands-solar_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
