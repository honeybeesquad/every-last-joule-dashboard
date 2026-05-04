# Validation — BPA (`bpa`)

Last updated: 2026-05-04 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `bpa`
- **Country:** USA
- **Tier:** live
- **Kind:** mixed
- **Source:** EIA BPA wind+solar
- **Source URL:** [https://www.eia.gov/opendata/browser/electricity/rto/fuel-type-data](https://www.eia.gov/opendata/browser/electricity/rto/fuel-type-data)
- **Loader:** [`bpa.json.ts`](../../src/data/bpa.json.ts)
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** yes (per HB methodology §"Rate application over time")

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| 2020 | 12,886 | 0.449 | — | — | eia |
| 2021 | 13,076 | 0.450 | — | — | eia |
| 2022 | 13,318 | 0.369 | — | — | eia |
| 2023 | 13,961 | 0.371 | — | — | eia |
| 2024 | 13,752 | 0.416 | — | — | eia |
| 2025 | 13,179 | 0.403 | — | — | eia |
| 2026 | 3,813 | 0.126 | — | — | eia |

## Published anchors

- **TSO annual curtailment (latest published):** BPA hydro spill + minimal wind/solar curtailment; no single authoritative TWh figure — BPAT EIA proxy serves as best available
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

The Bonneville Power Administration (BPA) does not publish a single authoritative annual curtailment figure that can be directly reconciled with our reconstructed hourly data. We therefore rely on the EIA BPAT wind+solar generation curtailment as the best available proxy, as documented in the 'Published anchors' section above.

Our backfill annual totals reflect wind and solar curtailment, which aligns with the stated characteristic of "minimal wind/solar curtailment" alongside "BPA hydro spill." A direct quantitative comparison of our wind+solar curtailment against a comprehensive TSO figure for total curtailment (including hydro spill) is therefore not feasible, representing a definitional difference in scope rather than a discrepancy in reporting.

The backfill data for BPA commences in 2020. This is due to an EIA definitional shift prior to 2020, where reporting changed from BA-level to sub-BA detail. Consequently, pre-2020 data is not utilized to avoid mixing reporting regimes, limiting the historical depth of our backfill for this region.

## Known limitations

Beyond the cross-cutting limitations documented in `docs/methodology/historical-backfill.md`, the following region-specific limitations apply to BPA:

*   **Absence of authoritative TSO annual total:** No single, authoritative TSO-published annual curtailment total is available for direct reconciliation. Our analysis relies on EIA BPAT wind+solar data as a proxy.
*   **Definitional scope of proxy:** The EIA proxy specifically captures wind and solar curtailment, while general BPA curtailment may also include hydro spill. This constitutes a definitional scope mismatch with potentially broader TSO reporting.
*   **Historical depth restricted by EIA regime change:** The backfill for BPA begins in 2020 due to a definitional shift in EIA reporting from BA-level to sub-BA detail prior to this year. This restricts the available historical depth for multi-year variance analysis.

## Links

- Loader source: [`bpa.json.ts`](../../src/data/bpa.json.ts)
- Backfill archive: `data/historical/backfill/*_bpa_*.parquet` (7 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
