# Validation — Netherlands (`netherlands`)

Last updated: 2026-05-02 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `netherlands`
- **Country:** NLD
- **Tier:** live-domestic-anchored
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
| 2020 | 17,561 | 0.395 | — | — | entsoe |
| 2021 | 17,518 | 0.495 | — | — | entsoe |
| 2022 | 17,519 | 0.442 | — | — | entsoe |
| 2023 | 17,519 | 0.568 | — | — | entsoe |
| 2024 | 17,568 | 0.809 | 0.800 | +1.1% | entsoe |
| 2025 | 17,520 | 0.901 | — | — | entsoe |
| 2026 | 5,219 | 0.313 | — | — | entsoe |

## Published anchors

- **TSO annual curtailment (latest published):** TenneT TSO-only wind+solar curtailment 2024: ~0.8 TWh transmission-connected (ENTSO-E A75 scope). The loader src/data/entsoe.json.ts uses ENTSO-E A75 actual-generation × calibrated rates; A75 reports transmission-level only and cannot see distribution-PV (Liander/Stedin/Enexis grids), which dominates NL solar capacity.
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** Broader IEEFA 2025 summary of TenneT 2024: ~3.0 TWh wind+solar (4.9% VRE rate) including distribution-grid PV curtailment — different scope, ~2.2 TWh additional sits below the TSO measurement layer.

## Discrepancy analysis

The 2024 backfill total of 0.809 TWh underreports by 73.0% against the published TenneT 2024 anchor of 3.000 TWh wind+solar curtailment. This significant discrepancy is likely definitional. While the loader's rates are calibrated to the IEEFA 2025 summary figure, the underlying methodology multiplies ENTSO-E A75 generation data by these rates. The published TSO anchor may encompass a broader scope of grid management actions, such as redispatch or economic curtailment, that are not captured by the current generation-times-rate model.

## Known limitations

*   The current loader calculates curtailment by applying calibrated rates to ENTSO-E A75 generation data. This approach may not capture all forms of curtailment (e.g., redispatch, economic curtailment) that are sometimes included in aggregate TSO annual reports, leading to potential definitional discrepancies.
*   Calibration relies on an aggregate wind+solar curtailment rate derived from an IEEFA summary, as granular (fuel-specific) TSO-published curtailment rates for the Netherlands are not publicly available.
*   The ENTSO-E A77 API product, which provides explicit curtailed renewable energy data, is not yet integrated. Future work to implement A77 zone-by-zone could refine these figures and address definitional gaps.
*   For cross-cutting limitations applicable to all backfilled regions, see `docs/methodology/historical-backfill.md` §"Known limitations".

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_netherlands_*.parquet` (7 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
