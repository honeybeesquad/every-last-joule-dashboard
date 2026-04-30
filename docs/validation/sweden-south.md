# Validation — Sweden South (`sweden-south`)

Last updated: 2026-04-30 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `sweden-south`
- **Country:** SWE
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
| 2020 | 8,642 | 0.086 | — | — | entsoe |
| 2021 | 8,776 | 0.079 | — | — | entsoe |
| 2022 | 14,254 | 0.120 | — | — | entsoe |
| 2023 | 14,848 | 0.149 | — | — | entsoe |
| 2024 | 15,982 | 0.168 | 0.200 | -16.2% | entsoe |
| 2025 | 17,157 | 0.164 | — | — | entsoe |
| 2026 | 5,427 | 0.051 | — | — | entsoe |

## Published anchors

- **TSO annual curtailment (latest published):** Svk 2024 SE3+SE4 ~0.2 TWh wind curtailment
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

The 2024 backfill total of 0.168 TWh for `sweden-south` underreports the published Svk 2024 SE3+SE4 wind curtailment anchor of 0.200 TWh by 16.2%. This discrepancy is within the 25% threshold for flagging material disagreements against published annual figures.

The ENTSO-E rate audit for `sweden-south` indicates that the applied solar (B16) and wind (B19) curtailment rates are currently acknowledged placeholders, as no citable 2023/2024 annual curtailed-energy total for Sweden was found. This lack of a grounded rate suggests the observed difference is primarily due to rate under-calibration.

## Known limitations

*   The curtailment rates applied for `sweden-south` (solar and wind) are acknowledged placeholders, as no citable 2023/2024 annual curtailed-energy total for Sweden has been extracted. These rates should be considered illustrative floor/ceiling values rather than measured annual calibration.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_sweden-south_*.parquet` (7 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
