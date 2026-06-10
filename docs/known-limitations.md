# Known limitations (v1.3.1)

Every dashboard of this kind is bounded by the quality of its upstream data and the honesty of its author. v1.3.1 carries these specific limitations, listed so they are not hidden:

### 1. Self-curtailment is invisible

Market-data curtailment captures system-operator dispatch-down instructions, but it does not capture asset owners privately throttling output in response to negative prices or local economics. The book research treats this as a material blind spot: observed curtailment is commonly only about 50 - 70% of true curtailment once self-curtailment behaviour in ERCOT and European markets is considered.

### 2. Geographic gaps

Coverage is broad but still not a strict global total: low-dispatch-data regions remain estimated unless a renewable-curtailment or spill proxy is documented, and structural gaps are documented rather than filled with uncited numbers.

### 3. ASIC efficiency divergence

Cambridge’s 2025 CBECI estimate implies a fleet average around 16 J/TH, while CoinMetrics’ field-weighted estimate is materially looser at about 28.5 J/TH. The dashboard uses 16 J/TH for the primary readout because it is the closest fit to the academic benchmark being cross-checked, but the methodology page keeps the wider range visible because the disagreement is real and load-bearing.

### 4. 30-day time-of-day averaging smooths anomalies

A specific day’s curtailment can deviate sharply from the 30-day profile shown on the dashboard, particularly during weather events, outages, or acute transmission constraints. That smoothing is intentional because the default view shows the recurring daily pattern rather than overfitting to yesterday’s noise. The Last 24h mode is available where the upstream loader can recover a complete recent UTC day; regions without a reliable daily curve fall back to the 30-day profile for display continuity.

### 5. Direct-measured coverage remains partial

Brazil NE and Atacama report native curtailment/reduction data through public files. Several other renewable regions still estimate curtailment by applying calibrated annual rates to observed generation, which preserves hourly shape usefully but remains one step removed from a native dispatch-down series.

Regions that only have a published annual anchor and a typical-shape profile are classified `T3-modelled` (`tier: "estimated"` in `regions.ts`, ±40% envelope). Regions with annual anchors but no modelled shape layer are `T2-annual-calibrated` (`tier: "anchored"`). The `sourceStatus` field is only a freshness signal (`live`, `cached`, or `degraded`); it is not a claim that the value is direct-measured curtailment. Use `confidenceTier` and `sourceProvenance` for source-quality filtering.

### 6. Network consumption anchor

CBECI remains the canonical academic benchmark for Bitcoin electricity consumption, but its API is recaptcha-gated and not usable from the server-side loader. The dashboard therefore uses mempool.space’s 24-hour-average hashrate and derives annualised consumption at 16 J/TH, with quarterly cross-checks against Cambridge’s published dashboard value.

### 7. ERCOT remains on the EIA proxy after the B2 native attempt

ERCOT’s native developer API remains blocked behind the Incapsula WAF from this local environment, even with valid credentials. The B2 native probe acquired a token locally, then received HTTP 403 from `api.ercot.com`. Vercel’s US build path acquired a token and bypassed Incapsula after the missing ERCOT env vars were added, but the SCED HDL/LDL artifact data call returned HTTP 404. v0.5 therefore keeps `ERCOT_NATIVE_ENABLED = false` and continues to use EIA hourly wind with calibrated wind/solar rates, split into ERCOT West and East. The 66/34 West/East split is illustrative and book-derived, not an ERCOT-published zonal curtailment statistic; see `docs/methodology/ercot-brazil.md#ercot`. The inactive native loader remains in the repo for a future endpoint-discovery pass.

### 8. Atacama (Chile) daily reductions use monthly hourly shape

Coordinador Eléctrico Nacional publishes a documented developer portal with SIP and Operación API specs, including `/reduccion/v1/generacion`, but the public API requires a registered `user_key`; unauthenticated calls return `403 Authentication parameters missing`. The loader therefore does not use the API autonomously.

CEN also publishes daily `Resumen Ejecutivo de Operación` PDFs through the Informe de Novedades CDC directory. These PDFs include national daily solar and wind reduction totals from real-time operation, so the Atacama/Chile solar loader now uses the daily solar-reduction totals as the primary freshness source. The PDFs are daily but aggregate, not hourly; to avoid replacing measured data with a generic shape, the loader still parses the latest monthly `Reducciones-de-Energia-Eolica-Solar-Hidro-en-el-SEN_*_PE-PFV_Publicar.xlsx` workbook and uses its `Resumen-DiarioHorario-Solar` sheet as the measured hourly apportionment shape. If the daily PDF path or PDF text extraction fails, the loader uses the monthly XLSX directly. If both live paths fail, `withFallback` serves the last-good snapshot rather than a typical solar profile.

### 9. China provincial regions are calibrated annual estimates, not hourly observations

The 27 Chinese provincial regions in the dataset (8 calibrated provinces from phase 1 + 19 new provinces added in W2, 2026-05-02) are part of the `T3-modelled` tier (see `docs/methodology/uncertainty.md`): a published annual anchor combined with a typical diurnal/seasonal shape, envelope ±40% of `peakGW`. All provinces are calibrated against NEA 2024 wind/PV utilisation rates and public provincial generation data; see `docs/methodology/china-provinces.md`.

**Bottom-up sum vs. national ceiling.** The province-level estimates are derived independently for each province using per-province generation data and NEA-published provincial utilisation rates — they are not allocated from a national budget. The bottom-up sum of all 27 provinces is approximately 88.9 TWh/year (65.4 TWh original 8 + 23.5 TWh W2 19), compared to the NEA-implied 2024 national total of about 84.7 TWh. The ~4 TWh apparent excess is within the uncertainty range of the Sichuan hydro estimate alone (20–36 TWh, LOW confidence), which is the largest single source of imprecision in the block. The bottom-up total is therefore consistent with the national figure once Sichuan uncertainty is taken into account. No double-counting exists: all 27 provinces are geographically non-overlapping and each derives its anchor from independent source data.

The province-level uncertainty range for the full block is roughly 65–110 TWh/year, dominated by hydro-spill uncertainty in Sichuan, Yunnan, and Tibet/Xizang.

Hourly shape remains synthetic. Xinjiang uses a typical solar shape even though the annual source chain includes both wind and solar. Sichuan, Yunnan, and Tibet/Xizang use hydro-seasonal profiles because the public data identifies annual or seasonal spill risk, not measured hourly curtailed output. These regions should be read as annual magnitude estimates with defensible source chains, not as measured dispatch traces.

### 10. Brazil NE clustering uses ONS state codes, not plant-ID prefixes

Brazil NE wind and solar constrained-off rows are grouped by the ONS `id_estado` state field. This is intentionally not a manually curated `id_ons` prefix rule. ONS documents `id_estado`, `id_ons`, and ANEEL `ceg` fields in the constrained-off dictionaries; plant sets may carry `ceg = "-"`, so ANEEL SIGA remains a periodic cross-check rather than a row-by-row join for every constrained-off entry. See `docs/methodology/ercot-brazil.md#brazil-ne`.

### 11. v1f regional expansion uses documented fallback shapes where live feeds were hostile

See `data/coverage-audit/2026-04-26-world.csv` and the digest at `docs/coverage-audit/2026-04-26-world.md` for the canonical operator-by-operator coverage state. Per-row caveats live in the `notes` column. Phase-2.6 round-1 outcomes (Japan promotion, North India/Vietnam STOP-conditions) are annotated in the round-1 dispatch brief at `docs/proposals/2026-04-26-phase-2-6-static-promotions-dispatch.md`.

### 12. Alaska is below the inclusion threshold, not omitted for lack of curtailment

See `data/coverage-audit/2026-04-26-world.csv` and the digest at `docs/coverage-audit/2026-04-26-world.md` for the canonical operator-by-operator coverage state. Per-row caveats live in the `notes` column.

### 13. v1k global expansion is coverage-first and fallback-labelled

See `data/coverage-audit/2026-04-26-world.csv` and the digest at `docs/coverage-audit/2026-04-26-world.md` for the canonical operator-by-operator coverage state. Per-row caveats live in the `notes` column.

### 14. Several ENTSO-E rates remain placeholders after the 2026-04-24 audit

The ENTSO-E loader now has cited 2024 anchors for Germany, the Netherlands, Poland, and Greece, documented in `docs/methodology/entsoe-rates.md`. The same audit did not find public 2023/2024 curtailed-energy totals for Portugal, Finland, Romania, Italy's north/south/Sardinia bidding-zone split, Sweden, Hungary, Bulgaria, or Lithuania/Baltics. Spain has public REE and IEA integration evidence but no exact annual curtailed-energy value extracted from an open source in this pass. Those constants remain illustrative rate proxies, not measured curtailment series.

ENTSO-E's A77 "Curtailed Renewable Energy" API product is the preferred upgrade path. Until each zone is tested for complete A77 coverage and reconciled to operator annual reports, these remaining ENTSO-E estimates should be read as floor/ceiling placeholders rather than publication-grade national statistics.

### 15. Phase-2.7 Pattern-D anchor-metadata sweep — Latin-America + Africa batches landed

**Latin-America (13 regions, ~2.15 TWh aggregate anchor).** Caribbean, Central American, and small South American grids identified as `recommended_action: introduce-as-T3` in `data/coverage-audit/2026-04-26-latin-america.csv` are now present as `T3-modelled` static rows: Guatemala, El Salvador, Nicaragua, Costa Rica, Panama, Guatemala-SIEPAC corridor, Cuba, Dominican Republic, Jamaica, Barbados, Bolivia, Ecuador, and French Guiana. Anchors are sourced primarily from IRENA Renewable Energy Statistics 2024 country tables, Ember Country Electricity 2024 totals where IRENA was thin, and EDF SEI / EU GHG inventory references for French Guiana. None of these grids publish hourly renewable-curtailment dispatch series in a machine-accessible form at v0; each row carries a flat or solar-typical-shape profile under the ±40% T3-modelled envelope. Cuba's anchor reflects post-Hurricane-Ian grid-restoration mixed-fuel composite reporting. French Guiana sits at the inclusion threshold and is included for South-American Atlantic-coast completeness rather than because of a curtailment signal.

**Africa (26 regions, ~11.7 TWh aggregate anchor).** Twenty-six new T3-modelled African static regions added on 2026-04-27, sourced from the `recommended_action: introduce-as-T3` subset of `data/coverage-audit/2026-04-26-africa.csv`. Anchors are drawn from IRENA Country Statistics 2024, Ember country reports, ERA Annual Performance 2024 (Uganda), and STEG Annual Report (Tunisia). All 26 regions land at T3-modelled (±40% envelope) per `src/lib/uncertainty.ts::deriveTier`. Six audit rows below the 0.05 TWh inclusion threshold (Burundi, Gambia, Lesotho, Liberia, Seychelles, Sierra Leone) were skipped per the brief's no-tiny-row rule and remain documented gaps.

These African regions do not carry hourly upstream feeds — `buildStaticRegion` in `src/data/statics.json.ts` generates a typical solar / wind / flat profile scaled to the published annual anchor. Hydro-dominant grids (Cameroon, DR Congo, Gabon, Ghana, Madagascar, Malawi, Mozambique, Tanzania, Uganda, Zambia, Zimbabwe) use a flat 24/7 profile because no curated `HYDRO_SEASONAL_SHARES` array exists for these basins yet; they still land at T3-modelled because the choice of "flat-as-typical" is itself a modelling assumption. Nigeria is treated as `kind: "mixed"` with a flat profile, citing an Ember 2024 load-shed anchor; its 7.0 TWh anchor is the largest single contributor to the Africa batch and is a composite grid-stress estimate, not a single-source measurement.

Upgrade path for both batches: any of these 42 regions is eligible for promotion to Pattern-A (live loader) once the operator publishes hourly dispatch-down or generation data publicly. As of the 2026-04-26 audit, none had a parseable hourly endpoint. See `docs/proposals/2026-04-27-phase-2-7-pattern-d-dispatch.md` for the row-by-row mapping. Corrections / new operator data: simon@collins.nu.

Corrections welcome: simon@collins.nu.
