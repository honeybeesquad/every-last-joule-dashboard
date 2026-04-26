# Validation — Czech Republic (`czech-republic`)

Last updated: 2026-04-26 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `czech-republic`
- **Country:** CZE
- **Tier:** live
- **Kind:** mixed
- **Source:** ENTSO-E CEPS
- **Source URL:** [https://transparency.entsoe.eu/](https://transparency.entsoe.eu/)
- **Loader:** _(no single-file loader — see multi-region source)_
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** yes (per HB methodology §"Rate application over time")

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| 2020 | 14,553 | 0.050 | — | — | entsoe |
| 2021 | 14,527 | 0.050 | — | — | entsoe |
| 2022 | 14,555 | 0.054 | — | — | entsoe |
| 2023 | 14,542 | 0.063 | — | — | entsoe |
| 2024 | 14,488 | 0.085 | 0.050 | +70.2% | entsoe |
| 2025 | 14,322 | 0.100 | — | — | entsoe |
| 2026 | 4,276 | 0.026 | — | — | entsoe |

## Published anchors

- **TSO annual curtailment (latest published):** ČEPS 2024 RES curtailment statement: '<0.1 TWh' (no precise figure published). Anchor uses 0.05 TWh midpoint for Δ% calc but any parquet value up to 0.1 TWh is consistent with the published upper bound.
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

The backfill for 2024 reports 0.085 TWh of curtailment, which is +70.2% higher than the published ČEPS anchor of "<0.1 TWh" (treated as 0.05 TWh midpoint). This significant positive discrepancy primarily stems from the current rate under-calibration. The curtailment rates (solar 2.0%, wind 1.0%) applied in our model are estimated, as no publicly extracted annual curtailment figures from ČEPS or the ENTSO-E A77 API for Czechia were available at the time of this audit. Consequently, the modeled generation times rate may overestimate actual curtailment compared to the TSO's reported value, which may reflect a different scope of curtailment (e.g., only economic) or a more conservative reporting threshold.

## Known limitations

*   The curtailment rates for solar (2.0%) and wind (1.0%) are estimated due to the absence of publicly extracted annual curtailment data from ČEPS or ENTSO-E's A77 API for Czechia.
*   The primary published anchor for 2024, "<0.1 TWh" from ČEPS, is broad and treated as a 0.05 TWh midpoint for calculation, limiting precise validation.
*   The lack of a granular TSO anchor (e.g., split by fuel type) means our rates are applied uniformly, potentially obscuring different curtailment patterns between solar and wind.
*   This region is flagged as a "Measured-substitution candidate" in the ENTSO-E audit, indicating that more direct curtailment data might be available but has not yet been integrated.
*   See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_czech-republic_*.parquet` (7 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
