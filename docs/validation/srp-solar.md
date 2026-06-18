# Validation — Salt River Project Solar (`srp-solar`)

Last updated: 2026-06-17 · EIA-930 second-tier balancing authority · Granularity survey 2026-06-10

## Source

- **Region id:** `srp-solar`
- **Country:** USA
- **Tier:** anchored
- **Kind:** solar
- **Source:** EIA-930 Hourly Electric Grid Monitor, respondent `SRP`, fuel-type `SUN`. Live hourly generation × a 1.5% literature/IRP-anchored curtailment rate. The BA publishes generation, not its own curtailment register, so per [`live-data-paths.md`](../methodology/live-data-paths.md) (Path B, Test 2) this is **T2-annual-calibrated**, not T1a.
- **Source URL:** [https://www.eia.gov/opendata/browser/electricity/rto/fuel-type-data](https://www.eia.gov/opendata/browser/electricity/rto/fuel-type-data)
- **Loader:** [`srp.json.ts`](../../src/data/srp.json.ts)
- **Structural gap:** no

## Calibration

- **Rate:** 1.5% of EIA-930 solar generation (conservative first-order anchor).
- **Anchor basis:** SRP Integrated System Plan 2023; Ember.

## Published anchors

- **BA-published annual curtailment:** —
- **Ember annual:** —
- **LBNL annual:** —
- **Other:** —

## Discrepancy analysis

_New region (granularity survey 2026-06-10). No multi-year backfill yet; magnitude is a conservative T2 anchor (±20% envelope) pending a BA-published curtailment figure._

## Known limitations

- The curtailment rate is a literature/IRP anchor applied to live EIA-930 generation, not a BA-published curtailment number — hence T2 (`anchored`), not T1a.
- A single territory centroid is a coarse globe placement for a multi-state balancing authority.

## Links

- Loader source: [`srp.json.ts`](../../src/data/srp.json.ts)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Methodology — live-data paths & tier rule: [`docs/methodology/live-data-paths.md`](../methodology/live-data-paths.md)
