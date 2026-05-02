# Validation — Germany (`germany`)

Last updated: 2026-05-02 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `germany`
- **Country:** DEU
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
| 2020 | 17,555 | 8.944 | — | — | entsoe |
| 2021 | 17,519 | 8.039 | — | — | entsoe |
| 2022 | 17,520 | 8.731 | — | — | entsoe |
| 2023 | 17,520 | 9.054 | — | — | entsoe |
| 2024 | 17,568 | 9.417 | 9.000 | +4.6% | entsoe |
| 2025 | 17,520 | 9.586 | — | — | entsoe |
| 2026 | 5,448 | 3.612 | — | — | entsoe |

## Published anchors

- **TSO annual curtailment (latest published):** BNetzA 2024 narrow EEG-only Einspeisemanagement (the figure src/data/entsoe.json.ts rates are calibrated to): ~9 TWh wind+solar feed-in management. Excludes redispatch and distribution-grid curtailment — both invisible to ENTSO-E A75 transmission-level actual-generation feed.
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** Broad BNetzA Monitoringbericht 2024 figure (~23.2 TWh = ~19.5 onshore wind + ~3.1 offshore wind + ~0.6 solar) includes EEG + redispatch across all grid levels — different scope, ~14 TWh additional on top of the EEG-only figure the loader measures.

## Discrepancy analysis

The substantial discrepancy of -59.4% for 2024 (9.417 TWh backfill vs. 23.200 TWh published) is primarily a definitional mismatch. The backfill totals shown above reflect the historical loader logic, which prior to the `2026-04-24 ENTSO-E Curtailment-Rate Audit`, did not fetch offshore wind (`B18`) and used a materially different rate for onshore wind (`B19`).

BNetzA's 2024 published curtailment figures include approximately 19.5 TWh of onshore wind and 3.1 TWh of offshore wind. The backfill's volume more closely aligns with the onshore wind component, indicating a scope mismatch where a significant portion of the TSO's reported curtailment (offshore wind) was not included in the backfill's calculations at the time these figures were generated.

## Known limitations

*   The backfill annual totals presented in this document are derived from the loader logic *before* the `2026-04-24 ENTSO-E Curtailment-Rate Audit`. They do not yet incorporate the audited rates for onshore wind (3.0% vs. 8.0% previously) and, crucially, do not include offshore wind curtailment (17.8% rate applied to `B18`).
*   As an ENTSO-E based source, Germany is subject to reporting-latency holes where upstream data may be published with a 1–3 month lag during system outages. The backfill is designed to tolerate gaps up to 10% per year.
*   The current backfill relies on a generation-times-rate model for curtailment. While the rates for Germany are now grounded, a future enhancement could involve substituting this model with direct data from the ENTSO-E A77 "Curtailed Renewable Energy" API product, which may offer more direct measurement.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_germany_*.parquet` (7 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
