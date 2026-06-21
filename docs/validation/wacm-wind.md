# Validation — WAPA Rocky Mountain Wind (`wacm-wind`)

Last updated: 2026-06-21 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `wacm-wind`
- **Country:** USA
- **Tier:** anchored
- **Kind:** wind
- **Source:** EIA WACM wind
- **Source URL:** [https://www.eia.gov/opendata/browser/electricity/rto/fuel-type-data](https://www.eia.gov/opendata/browser/electricity/rto/fuel-type-data)
- **Loader:** [`wacm.json.ts`](../../src/data/wacm.json.ts)
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

_New region (granularity survey 2026-06-10). No multi-year backfill yet; magnitude is a conservative T2 anchor (±20% envelope) pending a BA-published curtailment figure._

## Known limitations

- The curtailment rate is a literature/IRP anchor applied to live EIA-930 generation, not a BA-published curtailment number — hence T2 (`anchored`), not T1a.
- A single territory centroid is a coarse globe placement for a multi-state balancing authority.

## Links

- Loader source: [`wacm.json.ts`](../../src/data/wacm.json.ts)
- Backfill archive: `data/historical/backfill/*_wacm-wind_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
