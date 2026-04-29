# Validation — Uruguay (`uruguay`)

Last updated: 2026-04-29 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `uruguay`
- **Country:** URY
- **Tier:** live
- **Kind:** wind
- **Source:** ADME hourly Restricciones Operativas workbook
- **Source URL:** [https://www.adme.com.uy/panelControl/ro_excel.php](https://www.adme.com.uy/panelControl/ro_excel.php)
- **Loader:** [`uruguay.json.ts`](../../src/data/uruguay.json.ts)
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** ADME 2024 hourly renewable operating restrictions ~0.108 TWh
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

The prior T3 assumption of ~0.4-0.5 TWh/yr is not supported by the ADME hourly restriction workbook. Direct ADME rows resolve the annual-anchor conflict toward ~0.1 TWh for 2024 and near-zero 2025 restrictions.

## Known limitations

ADME publishes the current restriction-status table in quasi-real time, but the control-panel restriction workbook is month-complete DTE data. This is measured TSO data, not a modelled shape, but freshness is monthly rather than sub-hourly.

## Links

- Loader source: [`uruguay.json.ts`](../../src/data/uruguay.json.ts)
- Backfill archive: `data/historical/backfill/*_uruguay_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
