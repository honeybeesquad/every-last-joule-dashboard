# Validation — Nepal (`nepal`)

Last updated: 2026-06-18 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `nepal`
- **Country:** NPL
- **Tier:** estimated
- **Kind:** hydro
- **Source:** World Bank Nepal Development Update 2024 — estimated >0.5 TWh/yr renewable energy spillage from monsoon-season run-of-river overgeneration vs transmission bottlenecks and limited India-export capacity. NEA confirms during FY2023/24. Same modelling treatment as Ethiopia/Iceland/Colombia hydro spillage. Himalayan summer-monsoon shape (peak Jul-Sep). Gemini-3.1 research wave 4 (2026-04-30, reliability 5/5).
- **Source URL:** [https://www.worldbank.org/en/country/nepal/publication/nepal-development-update](https://www.worldbank.org/en/country/nepal/publication/nepal-development-update)
- **Loader:** _(no single-file loader — see multi-region source)_
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** —
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

The 0.5 TWh anchor is a conservative baseline reflecting FY2023/24 Nepal hydrology + grid + export reality. Year-on-year variance is significant (monsoon-driven). Wet years could push this to 0.8–1.0 TWh; dry years closer to 0.2–0.3 TWh. T3 ±40% envelope (0.3–0.7 TWh) covers the typical year reasonably well.

## Known limitations

Nepal's grid is hydro-dominant (~95% of generation) with rapid solar+small-hydro IPP buildout post-2020. Spillage is concentrated in monsoon season (Jun-Sep) when run-of-river plants generate near rated capacity simultaneously, while domestic demand and India-export capacity (NEA-PGCIL cross-border lines) saturate. The phenomenon is methodologically identical to the spillage already modelled for Ethiopia (Blue Nile / Kiremt monsoon), Iceland (glacial melt), Sichuan (Yangtze monsoon), and Colombia (bimodal Andean precipitation).

A future T2-annual-calibrated promotion is straightforward: NEA publishes annual reports with monthly hydrology and dispatch data. Quarterly refresh against the latest NEA Annual Report would suffice. T1a-live would require either an NEA-published hourly feed (none currently exists) or modelling spillage from the published monthly hydrology.

T3-modelled, ±40% envelope. Himalayan summer-monsoon hydro-seasonal shape (`HYDRO_SEASONAL_SHARES.nepal`) — peak Jul-Sep, dry trough Dec-Feb.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_nepal_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
