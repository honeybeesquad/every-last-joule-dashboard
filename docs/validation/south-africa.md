# Validation — South Africa (`south-africa`)

Last updated: 2026-04-26 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `south-africa`
- **Country:** ZAF
- **Tier:** live
- **Kind:** mixed
- **Source:** Eskom Data Portal total hourly renewable generation × MTSAO curtailment rate
- **Source URL:** [https://www.eskom.co.za/dataportal/renewables-performance/total-hourly-renewable-generation/](https://www.eskom.co.za/dataportal/renewables-performance/total-hourly-renewable-generation/)
- **Loader:** [`south-africa.json.ts`](../../src/data/south-africa.json.ts)
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** ESKOM 2024 RES curtailment modest; overshadowed by load-shedding mechanics
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** ESKOM Data Portal

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

**Tier-overstatement fix (2026-04-25):** demoted from `T1-live-TSO` to `T3-modelled`. The Eskom `south-africa.json.ts` loader is probe-only — it hits the Eskom Data Portal for reachability/freshness, then emits a calibrated wind+solar mixed typical-shape (`MIXED_SHAPE × 12% × 4150 MW` average renewable fleet) scaled to ~4.4 TWh/yr per SAREM 2025 / Eskom MTSAO Oct 2025 (4,363 GWh curtailed in 2024, 12% of renewable output, concentrated Northern+Western Cape transmission constraints). The Eskom Data Portal does not expose an hourly CSV / chart endpoint; the page-level reachability check is all the live source provides. `sourceStatus="live"` reflects probe reachability, not a measured-dispatch claim. See `docs/known-limitations.md` item 6.

See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: [`south-africa.json.ts`](../../src/data/south-africa.json.ts)
- Backfill archive: `data/historical/backfill/*_south-africa_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
