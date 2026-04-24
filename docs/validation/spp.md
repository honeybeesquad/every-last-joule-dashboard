# Validation — SPP (`spp`)

Last updated: 2026-04-24 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `spp`
- **Country:** USA
- **Tier:** live
- **Kind:** mixed
- **Source:** EIA SPP wind+solar
- **Source URL:** [https://www.eia.gov/opendata/browser/electricity/rto/fuel-type-data](https://www.eia.gov/opendata/browser/electricity/rto/fuel-type-data)
- **Loader:** [`spp.json.ts`](../../src/data/spp.json.ts)
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** yes (per HB methodology §"Rate application over time")

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| 2020 | 13,289 | 3.311 | — | — | eia |
| 2021 | 13,412 | 3.729 | — | — | eia |
| 2022 | 13,288 | 4.316 | — | — | eia |
| 2023 | 13,368 | 4.283 | — | — | eia |
| 2024 | 13,945 | 4.417 | 3.000 | +47.2% | eia |
| 2025 | 14,421 | 4.511 | — | — | eia |
| 2026 | 3,961 | 1.627 | — | — | eia |

## Published anchors

- **TSO annual curtailment (latest published):** SPP ~3 TWh wind on ~75 TWh generation (2024 SoM)
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_Auto-generated placeholder. Backfill annual totals are populated above; compare against the TSO annual in the row for the matching year. Pending narrative pass to characterise any year-over-year drift and whether the discrepancy is definitional (e.g., we include spill, TSO doesn't) or methodological._

## Known limitations

No region-specific limitations recorded. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: [`spp.json.ts`](../../src/data/spp.json.ts)
- Backfill archive: `data/historical/backfill/*_spp_*.parquet` (7 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
