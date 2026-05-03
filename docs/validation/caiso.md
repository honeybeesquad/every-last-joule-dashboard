# Validation — California (`caiso`)

Last updated: 2026-05-03 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `caiso`
- **Country:** USA
- **Tier:** live
- **Kind:** mixed
- **Source:** CAISO OASIS / EIA (solar+wind)
- **Source URL:** [https://oasis.caiso.com/oasisapi](https://oasis.caiso.com/oasisapi)
- **Loader:** [`caiso.json.ts`](../../src/data/caiso.json.ts)
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** yes (per HB methodology §"Rate application over time")

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| 2020 | 13,476 | 1.856 | — | — | eia |
| 2021 | 13,336 | 2.175 | — | — | eia |
| 2022 | 14,498 | 2.264 | — | — | eia |
| 2023 | 14,164 | 2.281 | — | — | eia |
| 2024 | 14,736 | 2.757 | 3.900 | -29.3% | eia |
| 2025 | 13,824 | 2.959 | — | — | eia |
| 2026 | 4,112 | 0.775 | — | — | eia |

## Published anchors

- **TSO annual curtailment (latest published):** CAISO ~3.4 TWh solar + ~0.5 TWh wind (2024, Ascend Analytics / CAISO daily reports)
- **Ember annual:** 3.4 (solar only, 2024)
- **IRENA annual:** —
- **Other:** Ascend Analytics, CAISO daily curtailment reports

## Discrepancy analysis

For 2024, the backfill annual total of 2.757 TWh underreports the published CAISO anchor of 3.9 TWh (derived from Ascend Analytics / CAISO daily reports) by 29.3%. This discrepancy is primarily attributable to definitional differences in curtailment reporting. Our loader, which uses EIA data, focuses on physical curtailment derived from generation multiplied by a fixed rate. CAISO's broader public figures are understood to include additional categories such as economic curtailment or redispatch wind-down, which are not captured in the EIA feed.

## Known limitations

*   The backfill data for CAISO, derived from EIA reporting, only commences from 2020. This is a consequence of a definitional shift in EIA's methodology from BA-level to sub-BA detail in 2019, preventing a consistent backfill for earlier years.
*   As a T1-live-TSO region, CAISO's uncertainty envelope currently defaults to ±15% of the current-snapshot `peakGW`. This temporary fallback is in place until the multi-year backfill archive is fully populated and stable, enabling a more robust 2σ calculation based on observed year-over-year variance.

## Links

- Loader source: [`caiso.json.ts`](../../src/data/caiso.json.ts)
- Backfill archive: `data/historical/backfill/*_caiso_*.parquet` (7 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
