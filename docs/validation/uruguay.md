# Validation — Uruguay (`uruguay`)

Last updated: 2026-04-29 · Sprint: data-quality elevation · Paper section: Technical Validation §4.2

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

- **Rate source documented in:** ADME control-panel hourly "Energía no Suministrada (Restricciones Operativas)" workbook.
- **Uniform across backfill years:** n/a — the loader consumes measured hourly MWh restrictions directly.

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---:|---:|---:|---:|---|
| 2024 | 8,784 hourly rows | 0.108 | 0.108 | 0.0% | ADME `ro_excel.php` Jan-Dec 2024 |
| 2025 | 8,760 hourly rows | 0.0055 | 0.0055 | 0.0% | ADME `ro_excel.php` Jan-Dec 2025 |

## Published anchors

- **TSO annual curtailment (latest audited):** ADME 2024 hourly restrictions sum to ~0.108 TWh; 2025 is much lower at ~0.0055 TWh.
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

The prior T3 assumption of ~0.4-0.5 TWh/yr is not supported by the ADME hourly restriction workbook. Direct ADME rows resolve the annual-anchor conflict toward ~0.1 TWh for 2024 and near-zero 2025 restrictions.

## Known limitations

ADME publishes the current restriction-status table in quasi-real time, but the control-panel restriction workbook is month-complete DTE data. This is measured TSO data, not a modelled shape, but freshness is monthly rather than sub-hourly.

## Links

- Loader source: [`uruguay.json.ts`](../../src/data/uruguay.json.ts)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
