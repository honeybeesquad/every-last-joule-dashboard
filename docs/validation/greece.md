# Validation — Greece (`greece`)

Last updated: 2026-04-27 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `greece`
- **Country:** GRC
- **Tier:** live
- **Kind:** mixed
- **Source:** ENTSO-E
- **Source URL:** [https://transparency.entsoe.eu/](https://transparency.entsoe.eu/)
- **Loader:** _(no single-file loader — see multi-region source)_
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** yes (per HB methodology §"Rate application over time")

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| 2020 | 13,871 | 0.410 | — | — | entsoe |
| 2021 | 14,212 | 0.493 | — | — | entsoe |
| 2022 | 13,868 | 0.562 | — | — | entsoe |
| 2023 | 14,222 | 0.648 | — | — | entsoe |
| 2024 | 14,087 | 0.802 | 0.350 | +129.1% | entsoe |
| 2025 | 13,907 | 0.790 | — | — | entsoe |
| 2026 | 4,243 | 0.268 | — | — | entsoe |

## Published anchors

- **TSO annual curtailment (latest published):** HAEE/IPTO 2024 RES curtailment officially published (see docs/data-source-log.md)
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** Ember 2024 Greece report

## Discrepancy analysis

The 2024 backfill annual total for Greece is 0.802 TWh, which overreports by 129.1% against the published HAEE/IPTO TSO annual curtailment of 0.350 TWh. This substantial discrepancy indicates a definitional difference between our calculated curtailment and the TSO's published anchor. The applied aggregate rate of 3.6% for Greece, while derived from an official HAEE/IPTO 2024 RES curtailment figure (860 GWh, as detailed in the ENTSO-E rate audit), likely captures a broader scope of curtailment events than the 0.350 TWh value reported as the TSO annual. This suggests that the published TSO annual figure may exclude certain categories of curtailment that our generation-times-rate model includes, leading to an overestimation in our backfill. For other years in the backfill, the absence of published TSO annuals prevents a direct year-over-year comparison of annual totals.

## Known limitations

*   **Definitional Mismatch for 2024**: The backfill significantly overreports for 2024 compared to the TSO published annual total, likely due to a definitional difference in what constitutes "curtailment" between our model and the official TSO figure.
*   **Aggregate Rate Application**: Due to the absence of a public wind/solar split from HAEE/IPTO, a single aggregate curtailment rate of 3.6% is applied uniformly across both wind and solar generation. This may obscure technology-specific curtailment dynamics.
*   **Uniform Rate Across Years**: The 3.6% aggregate rate is applied uniformly across all backfilled years (2020–2026). While this is consistent with the backfill methodology for regions without documented per-year rate variants, it can lead to year-over-year drift compared to actual TSO figures as capacity mixes and operational conditions change.
*   **Potential Reporting Latency**: As an ENTSO-E region, Greece may be subject to reporting-latency holes (1–3 month lag), which the backfill tolerates up to 10% per year.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_greece_*.parquet` (7 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
