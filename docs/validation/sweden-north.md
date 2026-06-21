# Validation — Sweden North (`sweden-north`)

Last updated: 2026-06-21 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `sweden-north`
- **Country:** SWE
- **Tier:** live
- **Kind:** wind
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
| 2020 | 8,682 | 0.082 | — | — | entsoe |
| 2021 | 8,695 | 0.078 | — | — | entsoe |
| 2022 | 8,758 | 0.085 | — | — | entsoe |
| 2023 | 8,760 | 0.091 | — | — | entsoe |
| 2024 | 8,784 | 0.101 | — | — | entsoe |
| 2025 | 8,759 | 0.104 | — | — | entsoe |
| 2026 | 2,723 | 0.038 | — | — | entsoe |

## Published anchors

- **TSO annual curtailment (latest published):** Svk 2024 SE1+SE2 minimal curtailment — hydro baseload dominates
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

A direct quantitative discrepancy analysis against published TSO annual curtailment totals is not possible for `sweden-north`, as no such figures are available in the provided sources. The backfill annual totals are derived using an ungrounded, acknowledged placeholder wind curtailment rate of 1.0%, as detailed in the ENTSO-E Rate Audit (2026-04-24). This placeholder rate is used in the absence of a citable 2023/2024 annual curtailed-energy total for the region. Therefore, a year-over-year reconciliation against external references cannot be performed for this region.

## Known limitations

*   The curtailment rate (1.0% for wind) applied for `sweden-north` is an acknowledged placeholder. The ENTSO-E Rate Audit (2026-04-24) identified no citable 2023/2024 annual curtailed-energy total from official sources, and thus this rate should be considered an illustrative floor value.
*   The absence of public TSO annual curtailment figures prevents external validation of the backfill annual totals for this region.
*   See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes applicable to all regions.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_sweden-north_*.parquet` (7 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
