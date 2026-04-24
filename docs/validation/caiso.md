# Validation — California (`caiso`)

Last updated: 2026-04-24 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

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
| 2024 | 29,472 | 5.514 | 3.900 | +41.4% | eia |
| 2025 | 13,824 | 2.959 | — | — | eia |
| 2026 | 4,112 | 0.775 | — | — | eia |

## Published anchors

- **TSO annual curtailment (latest published):** CAISO ~3.4 TWh solar + ~0.5 TWh wind (2024, Ascend Analytics / CAISO daily reports)
- **Ember annual:** 3.4 (solar only, 2024)
- **IRENA annual:** —
- **Other:** Ascend Analytics, CAISO daily curtailment reports

## Discrepancy analysis

_Auto-generated placeholder. Backfill annual totals are populated above; compare against the TSO annual in the row for the matching year. Pending narrative pass to characterise any year-over-year drift and whether the discrepancy is definitional (e.g., we include spill, TSO doesn't) or methodological._

## Known limitations

No region-specific limitations recorded. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: [`caiso.json.ts`](../../src/data/caiso.json.ts)
- Backfill archive: `data/historical/backfill/*_caiso_*.parquet` (7 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
