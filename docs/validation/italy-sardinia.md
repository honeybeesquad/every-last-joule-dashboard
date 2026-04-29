# Validation — Sardinia (`italy-sardinia`)

Last updated: 2026-04-29 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `italy-sardinia`
- **Country:** ITA
- **Tier:** live-domestic-anchored
- **Kind:** mixed
- **Source:** ENTSO-E Terna (Sardinia)
- **Source URL:** [https://transparency.entsoe.eu/](https://transparency.entsoe.eu/)
- **Loader:** _(no single-file loader — see multi-region source)_
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** yes (per HB methodology §"Rate application over time")

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| 2020 | 13,242 | 0.071 | — | — | entsoe |
| 2021 | 13,450 | 0.078 | — | — | entsoe |
| 2022 | 13,536 | 0.090 | — | — | entsoe |
| 2023 | 13,578 | 0.102 | — | — | entsoe |
| 2024 | 13,810 | 0.116 | 0.062 | +87.6% | entsoe |
| 2025 | 13,758 | 0.127 | — | — | entsoe |
| 2026 | 4,178 | 0.041 | — | — | entsoe |

## Published anchors

- **TSO annual curtailment (latest published):** MODELLED: 20% of Terna 2024 national 0.31 TWh RES curtailment anchor = ~0.062 TWh. Modelled split (see italy-north-zone note). The Sardinia share assumption reflects island isolation (HVDC Sapei link capacity-limited) producing higher per-GWh curtailment rate; not a directly-published Terna Sardinia-specific figure.
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

The backfill for 2024 (0.116 TWh) significantly overreports curtailment by +87.6% against the TSO annual anchor (0.062 TWh). This discrepancy is primarily attributed to **Rate under/over-calibration**. The 2024 TSO annual curtailment figure for Sardinia is derived as an allocation (20% of Terna's national 0.31 TWh RES curtailment anchor), rather than a direct zonal measurement. Our applied rates for solar (4.7%) and wind (2.0%) are acknowledged placeholders due to the absence of a citable zonal denominator from Terna, leading to an overestimation when applied to hourly generation data.

For other backfill years (2020-2023, 2025-2026), no public TSO annual anchors are available for direct comparison.

## Known limitations

*   **Lack of Zonal Calibration Data:** The current curtailment rates for Sardinia are acknowledged placeholders, as Terna does not publish a 2023/2024 curtailed-energy table split by ENTSO-E bidding zone. The 2024 TSO annual anchor is an allocated figure based on national totals.
*   **Rate Under/Over-Calibration:** Without direct zonal curtailment data, the uniform application of placeholder rates across all backfilled years may lead to year-on-year discrepancies against any allocated TSO anchors, particularly as generation mix and curtailment drivers evolve.
*   **Potential for A77 Substitution:** As noted in the ENTSO-E rate audit, the `documentType=A77` API product for "Curtailed Renewable Energy" could potentially offer direct hourly curtailment data for Italian bidding zones. A future loader could test A77 coverage for Sardinia and replace the current rate-based proxy.
*   **ENTSO-E Reporting Latency:** While not specifically documented for Sardinia, ENTSO-E reporting-latency holes can occasionally lead to data gaps within the backfill archive, which are tolerated up to 10% per year.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_italy-sardinia_*.parquet` (7 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
