# Known limitations (v0)

Every dashboard of this kind is bounded by the quality of its upstream data and the honesty of its author. v0 carries these specific limitations, listed so they are not hidden:

### 1. Self-curtailment is invisible

Market-data curtailment captures system-operator dispatch-down instructions, but it does not capture asset owners privately throttling output in response to negative prices or local economics. The book research treats this as a material blind spot: observed curtailment is commonly only about 50 - 70% of true curtailment once self-curtailment behaviour in ERCOT and European markets is considered.

### 2. Geographic gaps

v1f closes several visible gaps by adding Japan, North India, Ethiopia, Southeast Asia, Latin America, Cyprus, Portugal, and Sweden. Coverage is still not a strict global total: much of Africa, the Middle East, Central Asia, and smaller island grids remain absent unless a renewable curtailment/spill proxy is documented.

### 3. ASIC efficiency divergence

Cambridge’s 2025 CBECI estimate implies a fleet average around 16 J/TH, while CoinMetrics’ field-weighted estimate is materially looser at about 28.5 J/TH. v0 uses 16 J/TH for the primary readout because it is the closest fit to the academic benchmark being cross-checked, but the methodology page keeps the wider range visible because the disagreement is real and load-bearing.

### 4. Flare estimation uncertainty

VIIRS-derived and GGFR-derived flare estimates do not line up perfectly, and basin-level divergence can be significant. v0 uses GGFR annual individual flare-location totals as the base, converts them to electrical-equivalent output at 35% generator efficiency, and labels the flare contribution as an annualised estimate rather than a live observation. A 2026-04-24 audit applies a +/-20% interpretation band and updates only regions outside that band; see `docs/methodology/flare-ercot-brazil.md#flare`.

### 5. 30-day time-of-day averaging smooths anomalies

A specific day’s curtailment can deviate sharply from the profile shown on the dashboard, particularly during weather events, outages, or acute transmission constraints. That smoothing is intentional in v0 because the aim is to show the recurring daily pattern rather than overfit to yesterday’s noise; a latest-24-hour mode belongs in a later release.

### 6. Direct-measured coverage remains partial

Brazil NE and Atacama now report native curtailment/reduction data through public files. Several other live renewable regions still estimate curtailment by applying calibrated 2024 rates to observed generation, which preserves shape usefully but remains one step removed from a native curtailment series.

A narrower subset — CAMMESA Argentina, COES SINAC Peru, ESKOM South Africa, and EirGrid Ireland (split 58/42 into `ireland-republic` and `northern-ireland` at consumption time) — does not even derive curtailment from observed hourly generation: the loader only probes the public endpoint for reachability and freshness, then emits a calibrated typical-shape profile scaled to a published annual anchor (Patagonia wind ~0.5 TWh/yr; Peru bimodal hydro-seasonal ~0.8 TWh/yr; South Africa wind+solar ~4.4 TWh/yr per SAREM 2025 / Eskom MTSAO Oct 2025; Ireland all-island wind ~2.18 TWh/yr per SONI/EirGrid 2024 Annual Renewable Constraint and Curtailment Report). All four are now classified `T3-modelled` (`tier: "static"` in `regions.ts`, ±40% envelope) — the 2026-04-25 tier-overstatement fix demoted Peru, South Africa (batch 1) and the Ireland split pair (batch 2) from `T1-live-TSO` to match the typical-shape reality. The `sourceStatus` field still surfaces "live" when the upstream probe succeeds (i.e. the dashboard can confirm the source is reachable), but that is a freshness signal, not a measured-dispatch claim.

### 7. Network consumption anchor

CBECI remains the canonical academic benchmark for Bitcoin electricity consumption, but its API is recaptcha-gated and not usable from the server-side loader. v0 therefore uses mempool.space’s 24-hour-average hashrate and derives annualised consumption at 16 J/TH, with quarterly cross-checks against Cambridge’s published dashboard value.

### 8. ERCOT remains on the EIA proxy after the B2 native attempt

ERCOT’s native developer API remains blocked behind the Incapsula WAF from this local environment, even with valid credentials. The B2 native probe acquired a token locally, then received HTTP 403 from `api.ercot.com`. Vercel’s US build path acquired a token and bypassed Incapsula after the missing ERCOT env vars were added, but the SCED HDL/LDL artifact data call returned HTTP 404. v0.5 therefore keeps `ERCOT_NATIVE_ENABLED = false` and continues to use EIA hourly wind with calibrated wind/solar rates, split into ERCOT West and East. The 66/34 West/East split is illustrative and book-derived, not an ERCOT-published zonal curtailment statistic; see `docs/methodology/flare-ercot-brazil.md#ercot`. The inactive native loader remains in the repo for a future endpoint-discovery pass.

### 9. Atacama (Chile) daily reductions use monthly hourly shape

Coordinador Eléctrico Nacional publishes a documented developer portal with SIP and Operación API specs, including `/reduccion/v1/generacion`, but the public API requires a registered `user_key`; unauthenticated calls return `403 Authentication parameters missing`. The loader therefore does not use the API autonomously.

CEN also publishes daily `Resumen Ejecutivo de Operación` PDFs through the Informe de Novedades CDC directory. These PDFs include national daily solar and wind reduction totals from real-time operation, so the Atacama/Chile solar loader now uses the daily solar-reduction totals as the primary freshness source. The PDFs are daily but aggregate, not hourly; to avoid replacing measured data with a generic shape, the loader still parses the latest monthly `Reducciones-de-Energia-Eolica-Solar-Hidro-en-el-SEN_*_PE-PFV_Publicar.xlsx` workbook and uses its `Resumen-DiarioHorario-Solar` sheet as the measured hourly apportionment shape. If the daily PDF path or PDF text extraction fails, the loader uses the monthly XLSX directly. If both live paths fail, `withFallback` serves the last-good snapshot rather than a typical solar profile.

### 10. China provincial regions are calibrated annual estimates, not hourly observations

The 27 Chinese provincial regions in the dataset (8 calibrated provinces from phase 1 + 19 new provinces added in W2, 2026-05-02) are part of the `T3-modelled` tier (see `docs/methodology/uncertainty.md`): a published annual anchor combined with a typical diurnal/seasonal shape, envelope ±40% of `peakGW`. All provinces are calibrated against NEA 2024 wind/PV utilisation rates and public provincial generation data; see `docs/methodology/china-provinces.md`.

**Bottom-up sum vs. national ceiling.** The province-level estimates are derived independently for each province using per-province generation data and NEA-published provincial utilisation rates — they are not allocated from a national budget. The bottom-up sum of all 27 provinces is approximately 88.9 TWh/year (65.4 TWh original 8 + 23.5 TWh W2 19), compared to the NEA-implied 2024 national total of about 84.7 TWh. The ~4 TWh apparent excess is within the uncertainty range of the Sichuan hydro estimate alone (20–36 TWh, LOW confidence), which is the largest single source of imprecision in the block. The bottom-up total is therefore consistent with the national figure once Sichuan uncertainty is taken into account. No double-counting exists: all 27 provinces are geographically non-overlapping and each derives its anchor from independent source data.

The province-level uncertainty range for the full block is roughly 65–110 TWh/year, dominated by hydro-spill uncertainty in Sichuan, Yunnan, and Tibet/Xizang.

Hourly shape remains synthetic. Xinjiang uses a typical solar shape even though the annual source chain includes both wind and solar. Sichuan, Yunnan, and Tibet/Xizang use hydro-seasonal profiles because the public data identifies annual or seasonal spill risk, not measured hourly curtailed output. These regions should be read as annual magnitude estimates with defensible source chains, not as measured dispatch traces.

### 11. Flare regions are flat because flare is flat (not a data gap)

Permian, W. Siberia, S. Iraq, and E. Saudi sit in the dataset's flare bucket — a presentational subdivision of `T2-annual-calibrated` shown separately on Figure 4 (the coverage map) so readers can visually distinguish flat 24/7 base-load heat from dispatch-down curtailment. The envelope model is the same ±20% of `peakGW`; `confidenceTier` returns the single label `T2-annual-calibrated` for both the flare bucket and the small handful of static-flat regions, with the split being purely a label for the figure. See `docs/methodology/uncertainty.md`.

Flare's flatness is methodologically correct: upstream oil production doesn't stop overnight, so the heat output is 24/7 base load. Their flat shape is the truth, not an absence of hourly data. On the dashboard surface, flare regions are excluded from the hotspot pillar globe (they are not dispatch-down events) and instead surface in the "flared-gas waste" footnote in bitcoin orange (`#f7931a`); renewable curtailment renders in teal.

### 11a. Brazil NE clustering uses ONS state codes, not plant-ID prefixes

Brazil NE wind and solar constrained-off rows are grouped by the ONS `id_estado` state field. This is intentionally not a manually curated `id_ons` prefix rule. ONS documents `id_estado`, `id_ons`, and ANEEL `ceg` fields in the constrained-off dictionaries; plant sets may carry `ceg = "-"`, so ANEEL SIGA remains a periodic cross-check rather than a row-by-row join for every constrained-off entry. See `docs/methodology/flare-ercot-brazil.md#brazil-ne`.

### 12. v1f regional expansion uses documented fallback shapes where live feeds were hostile

See `data/coverage-audit/2026-04-26-world.csv` and the digest at `docs/coverage-audit/2026-04-26-world.md` for the canonical operator-by-operator coverage state. Per-row caveats live in the `notes` column. Phase-2.6 round-1 outcomes (Japan promotion, North India/Vietnam STOP-conditions) are annotated in the round-1 dispatch brief at `docs/proposals/2026-04-26-phase-2-6-static-promotions-dispatch.md`.

### 13. Alaska is below the inclusion threshold, not omitted for lack of curtailment

See `data/coverage-audit/2026-04-26-world.csv` and the digest at `docs/coverage-audit/2026-04-26-world.md` for the canonical operator-by-operator coverage state. Per-row caveats live in the `notes` column.

### 14. v1k global expansion is coverage-first and fallback-labelled

See `data/coverage-audit/2026-04-26-world.csv` and the digest at `docs/coverage-audit/2026-04-26-world.md` for the canonical operator-by-operator coverage state. Per-row caveats live in the `notes` column.

### 15. Several ENTSO-E rates remain placeholders after the 2026-04-24 audit

The ENTSO-E loader now has cited 2024 anchors for Germany, the Netherlands, Poland, and Greece, documented in `docs/methodology/entsoe-rates.md`. The same audit did not find public 2023/2024 curtailed-energy totals for Portugal, Finland, Romania, Italy's north/south/Sardinia bidding-zone split, Sweden, Hungary, Bulgaria, or Lithuania/Baltics. Spain has public REE and IEA integration evidence but no exact annual curtailed-energy value extracted from an open source in this pass. Those constants remain illustrative rate proxies, not measured curtailment series.

ENTSO-E's A77 "Curtailed Renewable Energy" API product is the preferred upgrade path. Until each zone is tested for complete A77 coverage and reconciled to operator annual reports, these remaining ENTSO-E estimates should be read as floor/ceiling placeholders rather than publication-grade national statistics.

### 16. Phase-2.7 Pattern-D anchor-metadata sweep — Latin-America + Africa batches landed

**Latin-America (16 regions, ~2.9 TWh aggregate anchor).** Sixteen Caribbean, Central American, and small South American grids identified as `recommended_action: introduce-as-T3` in `data/coverage-audit/2026-04-26-latin-america.csv` are now present as `T3-modelled` static rows: Guatemala, El Salvador, Nicaragua, Costa Rica, Panama, Guatemala-SIEPAC corridor, Cuba, Dominican Republic, Jamaica, Trinidad & Tobago, Barbados, Bolivia, Ecuador, Guyana, Suriname, and French Guiana. Anchors are sourced primarily from IRENA Renewable Energy Statistics 2024 country tables, Ember Country Electricity 2024 totals where IRENA was thin, GGFR 2024-25 for the offshore-flare-anchored rows (Trinidad, Guyana, Suriname), and EDF SEI / EU GHG inventory references for French Guiana. None of these sixteen grids publish hourly renewable-curtailment dispatch series in a machine-accessible form at v0; each row carries a flat or solar-typical-shape profile under the ±40% T3-modelled envelope. Cuba's anchor reflects post-Hurricane-Ian grid-restoration mixed-fuel composite reporting. French Guiana sits at the inclusion threshold and is included for South-American Atlantic-coast completeness rather than because of a curtailment signal. Trinidad/Guyana/Suriname report a flare anchor lifted onto the country grid for coverage continuity rather than a renewable-curtailment series; their flat 24/7 profile is presented under the ±40% T3 envelope (not the ±20% T2-flare envelope used for the directly-observed Permian / W-Siberia / S-Iraq / E-Saudi flare bboxes) to keep the modelling-uncertainty signal honest.

**Africa (26 regions, ~11.7 TWh aggregate anchor).** Twenty-six new T3-modelled African static regions added on 2026-04-27, sourced from the `recommended_action: introduce-as-T3` subset of `data/coverage-audit/2026-04-26-africa.csv`. Anchors are drawn from IRENA Country Statistics 2024, Ember country reports, ERA Annual Performance 2024 (Uganda), STEG Annual Report (Tunisia), and GGFR 2024-25 Niger Delta data (Nigeria's flare component). All 26 regions land at T3-modelled (±40% envelope) per `src/lib/uncertainty.ts::deriveTier`. Six audit rows below the 0.05 TWh inclusion threshold (Burundi, Gambia, Lesotho, Liberia, Seychelles, Sierra Leone) were skipped per the brief's no-tiny-row rule and remain documented gaps.

These African regions do not carry hourly upstream feeds — `buildStaticRegion` in `src/data/statics.json.ts` generates a typical solar / wind / flat profile scaled to the published annual anchor. Hydro-dominant grids (Cameroon, DR Congo, Gabon, Ghana, Madagascar, Malawi, Mozambique, Tanzania, Uganda, Zambia, Zimbabwe) use a flat 24/7 profile because no curated `HYDRO_SEASONAL_SHARES` array exists for these basins yet; they still land at T3-modelled because the choice of "flat-as-typical" is itself a modelling assumption. Nigeria is treated as `kind: "mixed"` with a flat profile, citing both Ember 2024 (load-shed component) and GGFR 2024-25 (Niger Delta flare component) — its 7.0 TWh anchor is the largest single contributor to the Africa batch and is a composite phenomenon, not a single-source measurement.

Upgrade path for both batches: any of these 42 regions is eligible for promotion to Pattern-A (live loader) once the operator publishes hourly dispatch-down or generation data publicly. As of the 2026-04-26 audit, none had a parseable hourly endpoint. See `docs/proposals/2026-04-27-phase-2-7-pattern-d-dispatch.md` for the row-by-row mapping. Corrections / new operator data: simon@collins.nu.

Corrections welcome: simon@collins.nu.
