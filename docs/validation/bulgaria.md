# Validation — Bulgaria (`bulgaria`)

Last updated: 2026-04-27 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `bulgaria`
- **Country:** BGR
- **Tier:** live
- **Kind:** mixed
- **Source:** ENTSO-E ESO
- **Source URL:** [https://transparency.entsoe.eu/](https://transparency.entsoe.eu/)
- **Loader:** _(no single-file loader — see multi-region source)_
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** yes (per HB methodology §"Rate application over time")

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| 2020 | 13,451 | 0.050 | — | — | entsoe |
| 2021 | 13,508 | 0.049 | — | — | entsoe |
| 2022 | 13,918 | 0.054 | — | — | entsoe |
| 2023 | 15,471 | 0.084 | — | — | entsoe |
| 2024 | 16,081 | 0.119 | 0.100 | +18.6% | entsoe |
| 2025 | 17,306 | 0.146 | — | — | entsoe |
| 2026 | 5,440 | 0.039 | — | — | entsoe |

## Published anchors

- **TSO annual curtailment (latest published):** ESO 2024 RES curtailment ~0.1 TWh
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

The backfill's 2024 annual total of 0.119 TWh for Bulgaria exceeds the published ESO TSO annual curtailment of ~0.1 TWh by 18.6%. This delta, while below the threshold for automatic flagging, is most plausibly attributed to rate under/over-calibration. The ENTSO-E Curtailment-Rate Audit confirmed that the rates applied for Bulgaria are acknowledged placeholders, lacking a citable 2023/2024 annual curtailed-energy total from the TSO. Consequently, the uniform application of these illustrative rates across all backfilled years, as detailed in the Historical Backfill methodology, can result in year-over-year drift against official TSO publications.

## Known limitations

*   **Rate under-grounding**: The curtailment rates applied for Bulgaria's solar (`B16`) and wind (`B19`) generation are acknowledged placeholders. The ENTSO-E Curtailment-Rate Audit confirmed that no citable 2023/2024 annual curtailed-energy total was found from the TSO (ESO), meaning the rates of 2.0% (solar) and 1.5% (wind) are illustrative and not directly derived from published annual figures.
*   The backfill methodology applies a single, static curtailment rate uniformly across all backfilled years. This approach can introduce minor year-over-year deviations when compared to published TSO annual totals, which reflect dynamic changes in capacity mix and operational practices.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_bulgaria_*.parquet` (7 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
