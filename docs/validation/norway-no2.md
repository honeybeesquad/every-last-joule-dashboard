# Validation — Norway NO2 (Kristiansand) (`norway-no2`)

Last updated: 2026-05-02 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `norway-no2`
- **Country:** NOR
- **Tier:** live
- **Kind:** mixed
- **Source:** ENTSO-E NO2 hydro+offshore wind (NorNed/NordLink/NSL cable zone)
- **Source URL:** [https://transparency.entsoe.eu/](https://transparency.entsoe.eu/)
- **Loader:** [`norway.json.ts`](../../src/data/norway.json.ts)
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** yes (per HB methodology §"Rate application over time")

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| 2020 | 17,559 | 3.947 | — | — | entsoe |
| 2021 | 17,518 | 3.858 | — | — | entsoe |
| 2022 | 17,517 | 2.972 | — | — | entsoe |
| 2023 | 17,520 | 3.440 | — | — | entsoe |
| 2024 | 17,563 | 3.766 | — | — | entsoe |
| 2025 | 17,518 | 3.703 | — | — | entsoe |
| 2026 | 5,448 | 1.280 | — | — | entsoe |

## Published anchors

- **TSO annual curtailment (latest published):** Statnett NO2 small curtailment; cable corridor mostly exports out
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

The multi-year backfill annual totals for Norway NO2 are presented without corresponding published TSO annual curtailment figures, thus preventing a direct quantitative comparison and calculation of annual percentage discrepancies. Qualitatively, the published anchor from Statnett describes NO2 as having "small curtailment," which is consistent with the backfill totals ranging from 2.972 TWh to 3.947 TWh for the period 2020-2025.

While year-over-year variations are evident in the backfill data (e.g., the 2022 total of 2.972 TWh being lower than 2020's 3.947 TWh), specific causes for this drift cannot be diagnosed against an external benchmark in the absence of a citable TSO annual curtailment series.

## Known limitations

-   No quantitatively published TSO annual curtailment anchor from Statnett for Norway NO2 is available in this validation document, which precludes direct, year-over-year cross-validation of the backfill against external benchmarks. This reflects a general challenge noted in the ENTSO-E rate audit for certain zones where specific annual curtailment totals were not found.
-   The curtailment rate applied by the `norway.json.ts` loader for `norway-no2` is not explicitly grounded by a public, audited 2023/2024 source within the `ENTSO-E Curtailment-Rate Audit`, and therefore functions as an acknowledged placeholder rate.
-   See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes on the backfill approach.

## Links

- Loader source: [`norway.json.ts`](../../src/data/norway.json.ts)
- Backfill archive: `data/historical/backfill/*_norway-no2_*.parquet` (7 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
