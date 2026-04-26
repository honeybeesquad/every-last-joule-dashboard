# Validation — ISO-NE (whole ISO) (`iso-ne`)

Last updated: 2026-04-26 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `iso-ne`
- **Country:** USA
- **Tier:** live
- **Kind:** mixed
- **Source:** EIA ISNE wind+solar (whole-ISO aggregate; dashboard splits into ME/VT + rest)
- **Source URL:** [https://www.eia.gov/opendata/browser/electricity/rto/fuel-type-data](https://www.eia.gov/opendata/browser/electricity/rto/fuel-type-data)
- **Loader:** [`iso-ne.json.ts`](../../src/data/iso-ne.json.ts)
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** yes (per HB methodology §"Rate application over time")

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| 2020 | 13,868 | 0.114 | — | — | eia |
| 2021 | 13,882 | 0.118 | — | — | eia |
| 2022 | 14,897 | 0.133 | — | — | eia |
| 2023 | 15,772 | 0.115 | — | — | eia |
| 2024 | 15,395 | 0.131 | 0.034 | +283.9% | eia |
| 2025 | 16,313 | 0.167 | — | — | eia |
| 2026 | 5,011 | 0.070 | — | — | eia |

## Published anchors

- **TSO annual curtailment (latest published):** ISO-NE 2024 renewable dispatch-down ~0.034 TWh (ISO-NE IMM 2024 Annual Markets Report). 93% concentrated in Maine/Vermont congestion pocket.
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** ISO-NE Internal Market Monitor 2024 Annual Markets Report

## Discrepancy analysis

The most pronounced discrepancy is observed in 2024, where the backfill's calculated annual total of 0.131 TWh for ISO-NE significantly overreports the 0.034 TWh figure for dispatch-down from the ISO-NE IMM 2024 Annual Markets Report by +283.9%. This substantial difference is primarily attributed to a **scope mismatch**: our backfill aggregates curtailment across the entire ISO-NE region, while the TSO's published dispatch-down is explicitly stated to be 93% concentrated in the Maine/Vermont congestion pocket.

Furthermore, a **definitional** difference may contribute. The TSO's "dispatch-down" could refer specifically to economic curtailment or re-dispatch actions, whereas our methodology aims to capture all forms of physical curtailment. For other years (2020-2023, 2025-2026), no directly comparable TSO annual curtailment anchors are available in this document.

## Known limitations

*   **Scope Divergence**: Our whole-ISO backfill values may show discrepancies against TSO anchors that are focused on specific sub-regions or congestion pockets, as observed with the 2024 ISO-NE IMM report for the Maine/Vermont area.
*   **Definitional Differences**: Discrepancies can arise from definitional variances between our derived curtailment and TSO-published figures (e.g., "dispatch-down"), which might exclude certain types of physical curtailment or focus exclusively on economic curtailment.
*   **Upstream Data Evolution**: While our backfill avoids EIA definitional shifts pre-2020, ongoing changes in EIA reporting methodologies or API structures could introduce future interpretation challenges.
*   **Cross-cutting Limitations**: General limitations affecting all backfilled regions, such as reporting-latency holes in upstream feeds, are detailed in `docs/methodology/historical-backfill.md` §"Known limitations".

## Links

- Loader source: [`iso-ne.json.ts`](../../src/data/iso-ne.json.ts)
- Backfill archive: `data/historical/backfill/*_iso-ne_*.parquet` (7 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
