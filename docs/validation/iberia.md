# Validation — Iberia (`iberia`)

Last updated: 2026-05-02 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `iberia`
- **Country:** ESP
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
| 2020 | 16,345 | 6.937 | — | — | entsoe |
| 2021 | 16,315 | 7.874 | — | — | entsoe |
| 2022 | 16,076 | 8.173 | — | — | entsoe |
| 2023 | 16,265 | 8.937 | — | — | entsoe |
| 2024 | 16,213 | 9.084 | 10.600 | -14.3% | entsoe |
| 2025 | 16,179 | 8.995 | — | — | entsoe |
| 2026 | 4,827 | 3.133 | — | — | entsoe |

## Published anchors

- **TSO annual curtailment (latest published):** REE Informe del Sistema Eléctrico 2024 broad renewable curtailment: 6.8 TWh wind + 2.4 TWh PV + 1.4 TWh CSP = ~10.6 TWh/yr total. The wind+solar+CSP rates in src/data/entsoe.json.ts were calibrated to this broad figure (vertidos por restricciones técnicas + redespacho + congestión).
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** Narrow REE congestion-only figure (vertidos por congestión): ~2.1 TWh 2024 — different scope, excludes restricciones técnicas and redespacho.

## Discrepancy analysis

The 2024 backfill total of 9.084 TWh exhibits a significant +332.6% discrepancy when compared to the 2.100 TWh TSO annual curtailment published by REE for Spain. This difference is primarily driven by a **scope mismatch** combined with **rate over-calibration**.

The REE 2024 anchor specifically reports on Spain, whereas the `iberia` backfill region likely encompasses both Spain and Portugal. The ENTSO-E rate audit confirmed that the current 5.5% solar and 11.0% wind constants for Iberia are placeholder values due to the absence of a publicly extractable 2024 GWh or percentage from IEA/REE sources.

Consequently, the model's aggregate for the broader `iberia` region, using these ungrounded rates, substantially overestimates when measured against a Spain-only reference.

## Known limitations

*   The applied curtailment rates for solar (5.5%) and wind (11.0%) for `iberia` are acknowledged placeholders, lacking specific 2024 GWh or percentage values from public IEA/REE sources.
*   The ENTSO-E rate audit found no citable 2023/2024 annual curtailed-energy total for Portugal, contributing to the placeholder status of the region's rates.
*   A **scope mismatch** exists when comparing the `iberia` backfill (potentially Spain and Portugal) against the REE 2024 TSO annual anchor, which pertains solely to Spain.
*   Spain is identified as a "measured-substitution candidate," implying that a future loader utilizing ENTSO-E A77 data could provide more direct and accurate hourly curtailment measurements.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_iberia_*.parquet` (7 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
