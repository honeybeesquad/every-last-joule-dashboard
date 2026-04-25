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

A narrower subset — CAMMESA Argentina, COES SINAC Peru, and ESKOM South Africa — does not even derive curtailment from observed hourly generation: the loader only probes the public endpoint for reachability and freshness, then emits a calibrated typical-shape profile scaled to a published annual anchor (Patagonia wind ~0.5 TWh/yr; Peru bimodal hydro-seasonal ~0.8 TWh/yr; South Africa wind+solar ~4.4 TWh/yr per SAREM 2025 / Eskom MTSAO Oct 2025). All three are now classified `T3-modelled` (`tier: "static"` in `regions.ts`, ±40% envelope) — the 2026-04-25 tier-overstatement fix demoted Peru and South Africa from `T1-live-TSO` to match the typical-shape reality. The `sourceStatus` field still surfaces "live" when the upstream probe succeeds (i.e. the dashboard can confirm the source is reachable), but that is a freshness signal, not a measured-dispatch claim.

### 7. Network consumption anchor

CBECI remains the canonical academic benchmark for Bitcoin electricity consumption, but its API is recaptcha-gated and not usable from the server-side loader. v0 therefore uses mempool.space’s 24-hour-average hashrate and derives annualised consumption at 16 J/TH, with quarterly cross-checks against Cambridge’s published dashboard value.

### 8. ERCOT remains on the EIA proxy after the B2 native attempt

ERCOT’s native developer API remains blocked behind the Incapsula WAF from this local environment, even with valid credentials. The B2 native probe acquired a token locally, then received HTTP 403 from `api.ercot.com`. Vercel’s US build path acquired a token and bypassed Incapsula after the missing ERCOT env vars were added, but the SCED HDL/LDL artifact data call returned HTTP 404. v0.5 therefore keeps `ERCOT_NATIVE_ENABLED = false` and continues to use EIA hourly wind with calibrated wind/solar rates, split into ERCOT West and East. The 66/34 West/East split is illustrative and book-derived, not an ERCOT-published zonal curtailment statistic; see `docs/methodology/flare-ercot-brazil.md#ercot`. The inactive native loader remains in the repo for a future endpoint-discovery pass.

### 9. Atacama (Chile) daily reductions use monthly hourly shape

Coordinador Eléctrico Nacional publishes a documented developer portal with SIP and Operación API specs, including `/reduccion/v1/generacion`, but the public API requires a registered `user_key`; unauthenticated calls return `403 Authentication parameters missing`. The loader therefore does not use the API autonomously.

CEN also publishes daily `Resumen Ejecutivo de Operación` PDFs through the Informe de Novedades CDC directory. These PDFs include national daily solar and wind reduction totals from real-time operation, so the Atacama/Chile solar loader now uses the daily solar-reduction totals as the primary freshness source. The PDFs are daily but aggregate, not hourly; to avoid replacing measured data with a generic shape, the loader still parses the latest monthly `Reducciones-de-Energia-Eolica-Solar-Hidro-en-el-SEN_*_PE-PFV_Publicar.xlsx` workbook and uses its `Resumen-DiarioHorario-Solar` sheet as the measured hourly apportionment shape. If the daily PDF path or PDF text extraction fails, the loader uses the monthly XLSX directly. If both live paths fail, `withFallback` serves the last-good snapshot rather than a typical solar profile.

### 10. China provincial regions are calibrated annual estimates, not hourly observations

The eight Chinese provincial regions are part of the dataset's `T3-modelled` tier (see `docs/methodology/uncertainty.md`): a published annual anchor combined with a typical diurnal/seasonal shape, envelope ±40% of `peakGW`. They are now calibrated against NEA 2024 wind/PV utilisation rates, NEA river-basin hydro utilisation, and public provincial generation data; see `docs/methodology/china-provinces.md`.

The China block totals 65.4 TWh/year against an NEA-implied 2024 national renewable curtailment/spill total of about 84.7 TWh/year. The province-level uncertainty range is roughly 48-80 TWh/year, dominated by hydro-spill uncertainty in Sichuan, Yunnan, and Tibet/Xizang.

Hourly shape remains synthetic. Xinjiang uses a typical solar shape even though the annual source chain includes both wind and solar. Sichuan, Yunnan, and Tibet/Xizang use hydro-seasonal profiles because the public data identifies annual or seasonal spill risk, not measured hourly curtailed output. These regions should be read as annual magnitude estimates with defensible source chains, not as measured dispatch traces.

### 11. Flare regions are flat because flare is flat (not a data gap)

Permian, W. Siberia, S. Iraq, and E. Saudi sit in the dataset's flare bucket — a presentational subdivision of `T2-annual-calibrated` shown separately on Figure 4 (the coverage map) so readers can visually distinguish flat 24/7 base-load heat from dispatch-down curtailment. The envelope model is the same ±20% of `peakGW`; `confidenceTier` returns the single label `T2-annual-calibrated` for both the flare bucket and the small handful of static-flat regions, with the split being purely a label for the figure. See `docs/methodology/uncertainty.md`.

Flare's flatness is methodologically correct: upstream oil production doesn't stop overnight, so the heat output is 24/7 base load. Their flat shape is the truth, not an absence of hourly data. On the dashboard surface, flare regions are excluded from the hotspot pillar globe (they are not dispatch-down events) and instead surface in the "flared-gas waste" footnote in bitcoin orange (`#f7931a`); renewable curtailment renders in teal.

### 11a. Brazil NE clustering uses ONS state codes, not plant-ID prefixes

Brazil NE wind and solar constrained-off rows are grouped by the ONS `id_estado` state field. This is intentionally not a manually curated `id_ons` prefix rule. ONS documents `id_estado`, `id_ons`, and ANEEL `ceg` fields in the constrained-off dictionaries; plant sets may carry `ceg = "-"`, so ANEEL SIGA remains a periodic cross-check rather than a row-by-row join for every constrained-off entry. See `docs/methodology/flare-ercot-brazil.md#brazil-ne`.

### 12. v1f regional expansion uses documented fallback shapes where live feeds were hostile

Argentina, Uruguay, Paraguay, Mexico, Japan, Vietnam, Thailand, North India, Cyprus, and Ethiopia all sit in `T3-modelled`: typical solar/wind/hydro profiles scaled to documented annual curtailment or spill estimates after public live-data probes found no stable unauthenticated hourly feed. Envelope ±40% of `peakGW`. They keep geographic coverage visible, but `latestProfile` is intentionally `null` and the `sourceNote` labels each as a fallback.

Turkey was removed in v1f after ENTSO-E returned no usable A75 renewable generation signal and no stable unauthenticated TEIAS/EPIAS endpoint was integrated in the time-box. In the 2026-04-24 re-probe, the newer EPIAS electricity-service dashboard endpoint did return unauthenticated current-day wind and solar generation by hour, so Turkey is promoted back to `T1-live-TSO` as a conservative calibrated proxy. The endpoint is current-day dashboard data rather than a 30-day history API; `latestProfile` remains `null` until a complete Turkey day is available from the live response, and the source note labels this limitation.

### 13. Alaska is below the inclusion threshold, not omitted for lack of curtailment

Alaska's Railbelt grid (Chugach, Matanuska, GVEA) does see documented renewable curtailment — intermittent wind-spill at Fire Island and Eva Creek during low-load shoulder hours, plus asset-owner throttling at rural AVEC village microgrids when diesel-hybrid dispatch can't absorb peak solar. NREL's 2023 Railbelt integration study and subsequent KEA/AVEC rate-case testimony place the aggregate at well under 0.01 TWh/year, roughly three orders of magnitude below the smallest region currently tracked. There is also no public hourly feed: Railbelt operators publish monthly fuel-use summaries, not a SCADA-level dispatch stream. v0 therefore documents Alaska's absence rather than including it as a near-zero row. If a public Railbelt hourly feed becomes available, or if Fire Island/Eva Creek curtailment scales past the 0.05 TWh/year threshold used elsewhere, it will be added with the same fallback-profile treatment applied to other small grids.

### 14. v1k global expansion is coverage-first and fallback-labelled

Western Australia (SWIS), NT & Pilbara, Indonesia, Malaysia, South Korea mainland, Russia (European grid), Taiwan, Jordan, Saudi Arabia solar, UAE, Oman, and Israel all sit in `T3-modelled`: typical profiles after live probes failed to find stable unauthenticated hourly curtailment feeds. Envelope ±40% of `peakGW`. These are coverage-gap estimates, not measured curtailment series, and every loader labels the fallback in `sourceNote`.

- **Australia non-NEM:** WA-SWIS uses 0.4 TWh/yr mixed solar/wind; NT & Pilbara uses 0.2 TWh/yr captive solar.
- **South/Southeast Asia:** Indonesia uses 0.3 TWh/yr Java-Bali solar; Malaysia uses 0.15 TWh/yr Peninsular solar.
- **East Asia:** South Korea mainland remains a 0.5 TWh/yr solar-shaped fallback, excluding Jeju. A 2026-04-24 refresh found reachable KPX/EPSIS/KEEI portal pages and KPX generation APIs on Korea Open Data Portal, but the useful hourly solar/generation APIs require an approved `serviceKey` and no unauthenticated mainland curtailment feed was found. Taiwan uses 0.6 TWh/yr mixed offshore wind and solar.
- **Russia non-flare:** Russia (European grid) uses 1 TWh/yr seasonal hydro spill. W. Siberia remains the separate flare region and is not reclassified.
- **Middle East:** Jordan uses 0.35 TWh/yr mixed wind/solar calibrated to the 17% wind-curtailment headline; Saudi Arabia solar uses 0.3 TWh/yr and remains separate from `e-saudi` flare; UAE uses 0.2 TWh/yr; Oman uses 0.1 TWh/yr; Israel uses 0.15 TWh/yr.

### 15. Several ENTSO-E rates remain placeholders after the 2026-04-24 audit

The ENTSO-E loader now has cited 2024 anchors for Germany, the Netherlands, Poland, and Greece, documented in `docs/methodology/entsoe-rates.md`. The same audit did not find public 2023/2024 curtailed-energy totals for Portugal, Finland, Romania, Italy's north/south/Sardinia bidding-zone split, Sweden, Hungary, Bulgaria, or Lithuania/Baltics. Spain has public REE and IEA integration evidence but no exact annual curtailed-energy value extracted from an open source in this pass. Those constants remain illustrative rate proxies, not measured curtailment series.

ENTSO-E's A77 "Curtailed Renewable Energy" API product is the preferred upgrade path. Until each zone is tested for complete A77 coverage and reconciled to operator annual reports, these remaining ENTSO-E estimates should be read as floor/ceiling placeholders rather than publication-grade national statistics.

Corrections welcome: simon@collins.nu.
