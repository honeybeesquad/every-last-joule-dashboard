# Validation — India East (`india-east`)

Last updated: 2026-08-20 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `india-east`
- **Country:** IND
- **Tier:** estimated
- **Kind:** solar
- **Source:** CEA gen-re.cea.gov.in daily Excel residual — Eastern Region solar excluding Odisha (Bihar + West Bengal + Jharkhand + Sikkim) × Ember India 2024 1% rate (≈0.006 TWh/yr at ~0.57 TWh/yr solar). Odisha is its own region and is not counted here. ERLDC still has no public curtailment series. Hourly shape is synthetic. Not a measured TSO series.
- **Source URL:** [https://gen-re.cea.gov.in/](https://gen-re.cea.gov.in/)
- **Loader:** [`india-east.json.ts`](../../src/data/india-east.json.ts)
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
- **CEA residual generation (trailing 365 days):** ~0.57 TWh solar (Bihar-dominated; WB/Jharkhand/Sikkim ~0)
- **Dashboard modelled curtailment:** ≈0.006 TWh/yr (Ember 1%). The previous 0.2 TWh/yr ERLDC stub double-counted Odisha.
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

The previous 0.2 TWh/yr stub treated Odisha and West Bengal as one ERLDC aggregate. Odisha is now its own region. This row is CEA Eastern residual solar excluding Odisha (almost entirely Bihar) × Ember 1%. ERLDC still publishes no curtailment series.

## Known limitations

No region-specific limitations recorded. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: [`india-east.json.ts`](../../src/data/india-east.json.ts)
- Backfill archive: `data/historical/backfill/*_india-east_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
