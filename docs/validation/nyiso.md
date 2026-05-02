# Validation — NYISO (whole ISO) (`nyiso`)

Last updated: 2026-05-02 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `nyiso`
- **Country:** USA
- **Tier:** live
- **Kind:** mixed
- **Source:** EIA NYIS wind+solar (whole-ISO aggregate; dashboard splits into Zones D/E + rest)
- **Source URL:** [https://www.eia.gov/opendata/browser/electricity/rto/fuel-type-data](https://www.eia.gov/opendata/browser/electricity/rto/fuel-type-data)
- **Loader:** [`nyiso.json.ts`](../../src/data/nyiso.json.ts)
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** yes (per HB methodology §"Rate application over time")

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| 2020 | 8,723 | 0.132 | — | — | eia |
| 2021 | 8,714 | 0.122 | — | — | eia |
| 2022 | 8,741 | 0.143 | — | — | eia |
| 2023 | 8,730 | 0.138 | 0.162 | -14.7% | eia |
| 2024 | 8,774 | 0.181 | — | — | eia |
| 2025 | 8,753 | 0.211 | — | — | eia |
| 2026 | 2,716 | 0.078 | — | — | eia |

## Published anchors

- **TSO annual curtailment (latest published):** NYISO 2023 statewide wind curtailment ~0.162 TWh (NYISO Power Trends 2024). Solar curtailment not separately reported.
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** NYISO Power Trends 2024 / Unbottling Wind report

## Discrepancy analysis

The 2023 backfill annual total of 0.138 TWh, representing combined wind and solar curtailment, is 14.7% lower than the NYISO-published 2023 statewide wind curtailment of 0.162 TWh. This discrepancy suggests an under-calibration of the applied curtailment rate within our model for the given year.

A contributing factor is a definitional difference: the published NYISO anchor specifically reports wind curtailment, with solar curtailment not separately reported. This impacts direct comparison with our combined wind and solar backfill estimates.

The observed underreporting across the combined wind and solar figure relative to the TSO's wind-only figure implies that our current rate may not fully capture the magnitude of wind curtailment as reported by NYISO, or that the TSO's methodology for aggregating wind curtailment is more expansive than what is captured by our EIA-derived inputs.

## Known limitations

*   The backfill for NYISO commences in 2020. This start year aligns with an EIA definitional shift from BA-level to sub-BA detail reporting in 2019, necessitating the exclusion of pre-2020 data to maintain data regime consistency.
*   A single, uniform calibration rate is applied across all backfilled years for NYISO. This approach does not explicitly account for potential year-over-year drift in actual TSO curtailment rates, which may fluctuate due to evolving capacity mixes or operational policies.
*   NYISO explicitly reports statewide wind curtailment but does not provide separate figures for solar curtailment. This definitional difference affects direct comparison with our combined wind and solar backfill estimates and complicates the validation of solar-specific curtailment.

## Links

- Loader source: [`nyiso.json.ts`](../../src/data/nyiso.json.ts)
- Backfill archive: `data/historical/backfill/*_nyiso_*.parquet` (7 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
