# Validation — Réunion (`reunion`)

Last updated: 2026-11-18 · Sprint: EDF SEI island grids · Paper section: Technical Validation §4.2

## Source

- **Region id:** `reunion`
- **Country:** REU
- **Tier:** estimated
- **Kind:** mixed
- **Source:** EDF SEI La Réunion open data, real-time generation by source: solar + wind + hydro summed. Generation collected (EDF marks it estimated; rolling window, see sourceNote). No curtailment column: waste unpublished, no rate applied. EDF SEI's monthly PV limitation hours (to 2023-12) are not wired.
- **Source URL:** [https://opendata-reunion.edf.fr/datasets/prod-electricite-temps-reel-974](https://opendata-reunion.edf.fr/datasets/prod-electricite-temps-reel-974)
- **Loader:** `src/data/edf-sei.json.ts`
- **Structural gap:** no
- **Waste status:** unpublished unless the operator publishes a curtailment/spill series. Missing ≠ zero. Live generation does not make waste T1a.

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
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

Generation-only row. The loader reads EDF SEI's real-time mix, which EDF marks "Estimé" (telemetry and estimates, not metered), and sums the solar, wind and hydro columns this territory has. The feed is a rolling window (about 14 days at 15-minute steps for Corsica, about 24 hours at 5-minute steps for the other territories), so the 30-day generation total is the window's diurnal mean × 30 days, not 30 days of observations. Waste is unpublished: the feed has no curtailment column and no rate is applied. Do not read a zero `profile` as a measured finding.

EDF SEI does publish a monthly limitation indicator, [Limitations de production au titre de la sûreté système](https://opendata-reunion.edf.fr/datasets/deconnexion-maximale-des-installations-photovoltaiques-974): the maximum hours of PV disconnection or limitation per month and, from 2019, the share of power-electronics-interfaced renewables accepted. It runs 2016-01 to 2023-12 (checked 2026-11-18), is in hours and percent rather than energy, and is not wired here.

The consolidated hourly dataset (production par filière au pas horaire) ended at 2024-12-31 when checked on 2026-11-18, so it cannot supply a trailing 30-day window.

## Known limitations

See `docs/methodology/historical-backfill.md` and STATUS.md TSO-grid completeness.

## Links

- Backfill archive: `data/historical/backfill/*_reunion_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
