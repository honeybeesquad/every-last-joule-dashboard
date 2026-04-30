# Validation — Nepal (`nepal`)

Last updated: 2026-04-30 · Sprint: Gemini research wave 4 · Paper section: Technical Validation §4.2

## Source

- **Region id:** `nepal`
- **Country:** NPL
- **Tier:** static
- **Kind:** hydro
- **Source:** World Bank Nepal Development Update 2024 — estimated >0.5 TWh/yr renewable energy spillage from monsoon-season run-of-river overgeneration vs transmission bottlenecks and limited India-export capacity. Confirmed by NEA / Department of Electricity Development for FY2023/24 (5.4% of generation). Same modelling treatment as Ethiopia / Iceland / Colombia hydro spillage — wasted potential renewable energy when reservoirs and run-of-river plants exceed grid absorption.
- **Source URL:** [https://www.worldbank.org/en/country/nepal/publication/nepal-development-update](https://www.worldbank.org/en/country/nepal/publication/nepal-development-update)
- **Loader:** _(no single-file loader — emitted via `STATIC_REGIONS.nepal` in `src/data/statics.json.ts`)_
- **Structural gap:** no (NEA publishes annual reports; could be elevated to T2-annual-calibrated with periodic refresh)

## Calibration

- **Rate source:** n/a — anchor is direct annual spillage figure from World Bank, not generation × rate. The 5.4% rate is a derived percentage not a calibration input.
- **Uniform across backfill years:** No — varies with monsoon strength + India-export utilization. 0.5 TWh is a conservative recent-year baseline.

## Published anchors

- **World Bank Nepal Development Update 2024:** "Estimated annual renewable energy spillage exceeding 0.5 TWh (500 GWh) due to infrastructure limitations" — reliability 5/5, confidence high (Gemini-3.1 research wave 4, 2026-04-30)
- **NEA annual reports:** confirms the underlying mechanism (Kulekhani, Marshyangdi cascade run-of-river spillage during monsoon when domestic load + India export are saturated)
- **Ember annual:** —
- **IRENA annual:** Earlier IRENA Nepal 2024 cite was used for the prior 0.2 TWh/yr placeholder; superseded by the World Bank figure which is more specific.

## Discrepancy analysis

The 0.5 TWh anchor is a conservative baseline reflecting FY2023/24 Nepal hydrology + grid + export reality. Year-on-year variance is significant (monsoon-driven). Wet years could push this to 0.8–1.0 TWh; dry years closer to 0.2–0.3 TWh. T3 ±40% envelope (0.3–0.7 TWh) covers the typical year reasonably well.

## Known limitations

Nepal's grid is hydro-dominant (~95% of generation) with rapid solar+small-hydro IPP buildout post-2020. Spillage is concentrated in monsoon season (Jun-Sep) when run-of-river plants generate near rated capacity simultaneously, while domestic demand and India-export capacity (NEA-PGCIL cross-border lines) saturate. The phenomenon is methodologically identical to the spillage already modelled for Ethiopia (Blue Nile / Kiremt monsoon), Iceland (glacial melt), Sichuan (Yangtze monsoon), and Colombia (bimodal Andean precipitation).

A future T2-annual-calibrated promotion is straightforward: NEA publishes annual reports with monthly hydrology and dispatch data. Quarterly refresh against the latest NEA Annual Report would suffice. T1a-live would require either an NEA-published hourly feed (none currently exists) or modelling spillage from the published monthly hydrology.

T3-modelled, ±40% envelope. Himalayan summer-monsoon hydro-seasonal shape (`HYDRO_SEASONAL_SHARES.nepal`) — peak Jul-Sep, dry trough Dec-Feb.

## Links

- Loader: `src/data/statics.json.ts` (`STATIC_REGIONS.nepal`)
- Seasonal shape: `src/lib/typical-profiles.ts` (`HYDRO_SEASONAL_SHARES.nepal`)
- Research wave methodology: [`docs/methodology/2026-04-29-gemini-research-wave-1.md`](../methodology/2026-04-29-gemini-research-wave-1.md)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
