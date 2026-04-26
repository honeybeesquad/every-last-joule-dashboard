# Validation — Baltic states (`baltics`)

Last updated: 2026-04-26 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `baltics`
- **Country:** EST
- **Tier:** live-domestic-anchored
- **Kind:** wind
- **Source:** ENTSO-E Litgrid
- **Source URL:** [https://transparency.entsoe.eu/](https://transparency.entsoe.eu/)
- **Loader:** _(no single-file loader — see multi-region source)_
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** yes (per HB methodology §"Rate application over time")

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| 2020 | 8,769 | 0.038 | — | — | entsoe |
| 2021 | 8,750 | 0.031 | — | — | entsoe |
| 2022 | 8,727 | 0.037 | — | — | entsoe |
| 2023 | 8,742 | 0.060 | — | — | entsoe |
| 2024 | 8,767 | 0.082 | 0.200 | -58.9% | entsoe |
| 2025 | 8,756 | 0.096 | — | — | entsoe |
| 2026 | 2,723 | 0.044 | — | — | entsoe |

## Published anchors

- **TSO annual curtailment (latest published):** Litgrid 2024 Baltic states combined wind curtailment ~0.2 TWh
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

The 2024 backfill annual total of 0.082 TWh for the Baltic states significantly underreports the Litgrid 2024 published combined wind curtailment of ~0.200 TWh, showing a discrepancy of -58.9%. This material divergence exceeds the 25% flagging threshold specified in the historical backfill methodology.

This discrepancy is primarily attributed to rate under-calibration. As documented in the ENTSO-E Curtailment-Rate Audit, no citable 2023 or 2024 annual curtailed-energy total was found for Lithuania/Baltics, meaning the applied 2.5% wind curtailment rate is an acknowledged placeholder rather than a measured annual calibration.

## Known limitations

- The curtailment rate for `baltics` is an acknowledged placeholder. No citable 2023 or 2024 annual curtailed-energy total has been identified for Lithuania/Baltics against which to ground the rate.
- Consequently, the rates used in the backfill should be treated as illustrative floor/ceiling values rather than direct annual calibration figures, as detailed in the ENTSO-E Curtailment-Rate Audit.
- See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes applicable to all backfilled regions.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_baltics_*.parquet` (7 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
