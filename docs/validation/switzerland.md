# Validation — Switzerland (`switzerland`)

Last updated: 2026-05-10 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `switzerland`
- **Country:** CHE
- **Tier:** live-neighbour-anchored
- **Kind:** solar
- **Source:** ENTSO-E Swissgrid PV-only (hydro spill not in A75)
- **Source URL:** [https://transparency.entsoe.eu/](https://transparency.entsoe.eu/)
- **Loader:** _(no single-file loader — see multi-region source)_
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** yes (per HB methodology §"Rate application over time")

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| 2020 | 4,991 | 0.036 | — | — | entsoe |
| 2021 | 4,891 | 0.038 | — | — | entsoe |
| 2022 | 4,708 | 0.046 | — | — | entsoe |
| 2023 | 4,897 | 0.053 | — | — | entsoe |
| 2024 | 4,896 | 0.065 | 0.100 | -35.5% | entsoe |
| 2025 | 7,580 | 0.077 | — | — | entsoe |
| 2026 | 1,876 | 0.014 | — | — | entsoe |

## Published anchors

- **TSO annual curtailment (latest published):** Swissgrid 2024 PV curtailment ~0.1 TWh; hydro spill not in A75 (excluded from our figure)
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

The 2024 backfill annual total for Switzerland of 0.065 TWh significantly underreports against the published Swissgrid 2024 PV curtailment anchor of ~0.1 TWh, showing a discrepancy of -35.5%. As both our figure and the TSO's published figure are noted to exclude hydro spill, this discrepancy is not definitional concerning that aspect. Instead, it suggests an under-calibration of the applied curtailment rate for PV in Switzerland. The ENTSO-E rate audit did not identify a citable 2023/2024 curtailed-energy total for this region, implying the current rate is an illustrative value that requires further grounding.

## Known limitations

*   The curtailment rate applied for Switzerland PV is an illustrative estimate, as no citable 2023/2024 annual curtailed-energy total was identified and audited for this region.
*   The current loader derives curtailment from ENTSO-E A75 generation data multiplied by a rate. A future implementation should investigate the availability of ENTSO-E A77 "Curtailed Renewable Energy" data for Switzerland to potentially replace this rate-based estimation with directly measured curtailment.
*   ENTSO-E sources, including Swissgrid, may exhibit reporting-latency holes, where data publication can lag by 1–3 months, potentially leading to incomplete hourly profiles for certain periods. The backfill process tolerates gaps up to 10% per year for ENTSO-E regions.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_switzerland_*.parquet` (7 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
