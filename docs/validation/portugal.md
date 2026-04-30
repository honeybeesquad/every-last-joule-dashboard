# Validation — Portugal (`portugal`)

Last updated: 2026-04-30 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `portugal`
- **Country:** PRT
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
| 2020 | 13,914 | 0.487 | — | — | entsoe |
| 2021 | 13,893 | 0.558 | — | — | entsoe |
| 2022 | 14,182 | 0.639 | — | — | entsoe |
| 2023 | 14,822 | 0.744 | — | — | entsoe |
| 2024 | 14,789 | 0.913 | 0.400 | +128.1% | entsoe |
| 2025 | 14,340 | 1.014 | — | — | entsoe |
| 2026 | 4,450 | 0.301 | — | — | entsoe |

## Published anchors

- **TSO annual curtailment (latest published):** REN 2024 renewable curtailment ~0.4 TWh
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** REN Dados Técnicos 2024

## Discrepancy analysis

The backfill's 2024 annual total of 0.913 TWh for Portugal substantially overreports the REN 2024 renewable curtailment of ~0.4 TWh by +128.1%. This material discrepancy is primarily due to **rate over-calibration**. The ENTSO-E rate audit (2026-04-24) identified that no citable 2023/2024 curtailment total was available from REN for either solar (B16) or wind (B19) generation. Consequently, the rates applied in the backfill are acknowledged placeholders rather than values derived from measured annual curtailment, leading to an upward bias in the reconstructed curtailment volume.

## Known limitations

*   The curtailment rates for solar (B16) and wind (B19) in Portugal are currently ungrounded placeholders. No citable 2023/2024 TSO annual curtailment total has been extracted from REN data for calibration.
*   As a result, the backfill annual totals are derived from illustrative floor/ceiling values rather than measured annual calibration.
*   See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes on the backfill approach.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_portugal_*.parquet` (7 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
