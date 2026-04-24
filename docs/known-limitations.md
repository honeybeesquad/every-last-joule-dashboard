# Known limitations (v0)

Every dashboard of this kind is bounded by the quality of its upstream data and the honesty of its author. v0 carries these specific limitations, listed so they are not hidden:

### 1. Self-curtailment is invisible

Market-data curtailment captures system-operator dispatch-down instructions, but it does not capture asset owners privately throttling output in response to negative prices or local economics. The book research treats this as a material blind spot: observed curtailment is commonly only about 50 - 70% of true curtailment once self-curtailment behaviour in ERCOT and European markets is considered.

### 2. Geographic gaps

v1f closes several visible gaps by adding Japan, North India, Ethiopia, Southeast Asia, Latin America, Cyprus, Portugal, and Sweden. Coverage is still not a strict global total: much of Africa, the Middle East, Central Asia, and smaller island grids remain absent unless a renewable curtailment/spill proxy is documented.

### 3. ASIC efficiency divergence

Cambridge’s 2025 CBECI estimate implies a fleet average around 16 J/TH, while CoinMetrics’ field-weighted estimate is materially looser at about 28.5 J/TH. v0 uses 16 J/TH for the primary readout because it is the closest fit to the academic benchmark being cross-checked, but the methodology page keeps the wider range visible because the disagreement is real and load-bearing.

### 4. Flare estimation uncertainty

VIIRS-derived and GGFR-derived flare estimates do not line up perfectly, and basin-level divergence can be significant. v0 uses GGFR annual totals as the base, converts them to electrical-equivalent output at 35% generator efficiency, and labels the flare contribution as an annualised estimate rather than a live observation.

### 5. 30-day time-of-day averaging smooths anomalies

A specific day’s curtailment can deviate sharply from the profile shown on the dashboard, particularly during weather events, outages, or acute transmission constraints. That smoothing is intentional in v0 because the aim is to show the recurring daily pattern rather than overfit to yesterday’s noise; a latest-24-hour mode belongs in a later release.

### 6. Direct-measured coverage remains partial

Brazil NE and Atacama now report native curtailment/reduction data through public files. Several other live renewable regions still estimate curtailment by applying calibrated 2024 rates to observed generation, which preserves shape usefully but remains one step removed from a native curtailment series.

### 7. Network consumption anchor

CBECI remains the canonical academic benchmark for Bitcoin electricity consumption, but its API is recaptcha-gated and not usable from the server-side loader. v0 therefore uses mempool.space’s 24-hour-average hashrate and derives annualised consumption at 16 J/TH, with quarterly cross-checks against Cambridge’s published dashboard value.

### 8. ERCOT remains on the EIA proxy after the B2 native attempt

ERCOT’s native developer API remains blocked behind the Incapsula WAF from this local environment, even with valid credentials. The B2 native probe acquired a token locally, then received HTTP 403 from `api.ercot.com`. Vercel’s US build path acquired a token and bypassed Incapsula after the missing ERCOT env vars were added, but the SCED HDL/LDL artifact data call returned HTTP 404. v0.5 therefore keeps `ERCOT_NATIVE_ENABLED = false` and continues to use EIA hourly wind with a 6.15% calibrated rate, split into ERCOT West and East. The inactive native loader remains in the repo for a future endpoint-discovery pass.

### 9. Atacama (Chile) direct XLSX is monthly and pattern-based

Coordinador Eléctrico Nacional’s listing pages still return Cloudflare bot-verification content from this environment, but the direct WordPress XLSX uploads are reachable. v1 therefore parses the latest predictable `Reducciones-de-Energia-Eolica-Solar-Hidro-en-el-SEN_*_PE-PFV_Publicar.xlsx` workbook and aggregates the `Resumen-DiarioHorario-Solar` sheet to hourly solar curtailment. This is direct measured Chilean curtailment, but monthly rather than near-real-time; if the upload naming pattern changes, the loader falls back to the prior `solarProfile(16.5, 5.9)` typical-shape profile.

### 10. Xinjiang uses a typical solar shape; Sichuan and Iceland stay flat

Three regions have no publicly accessible hourly feed reachable from this build environment. v0.5 treats each according to the physics of what it actually wastes:

- **Xinjiang (solar)** uses `solarProfile(6.33, 15)` - a daylight bump centred on local solar noon at 85°E (UTC 06:20), scaled to the 15 TWh/year S&P figure. This is illustrative, not measured, but it lets Xinjiang participate in the sun-following visual story instead of registering as a steady flat bar that the terminator passes over without effect.
- **Sichuan (hydro)** stays flat. Sichuan's "waste" is monsoon-season reservoir spill; the pattern is monthly-seasonal, not hourly. A flat annualised baseline is the honest shape for the daily view.
- **Iceland (hydro + geothermal)** stays flat for the same reason. Iceland's stranded generation is continuous, not diurnal.

The methodology page and this list label these three regions explicitly so readers can see where we're estimating a shape vs measuring one. v1 will upgrade Xinjiang, Sichuan, and Iceland to measured hourly data where a public source opens up.

### 11. Flare regions are flat because flare is flat (not a data gap)

Permian, W. Siberia, S. Iraq, and E. Saudi render as flat pillars. This is methodologically correct: flare is 24/7 base-load heat because upstream oil production doesn't stop overnight. Their flat shape is the truth, not an absence of hourly data. They are distinguishable from estimated regions (above) in the dashboard's colour coding - flare is orange, renewables are teal.

### 12. v1f regional expansion uses documented fallback shapes where live feeds were hostile

Argentina, Uruguay, Paraguay, Mexico, Japan, Vietnam, Thailand, North India, Cyprus, and Ethiopia are included through typical solar/wind/hydro profiles scaled to documented annual curtailment or spill estimates after public live-data probes found no stable unauthenticated hourly feed. They keep geographic coverage visible, but `latestProfile` is intentionally `null` and the `sourceNote` labels each as a fallback.

Turkey was removed in v1f after ENTSO-E returned no usable A75 renewable generation signal and no stable unauthenticated TEIAS/EPIAS endpoint was integrated in the time-box. In the 2026-04-24 re-probe, the newer EPIAS electricity-service dashboard endpoint did return unauthenticated current-day wind and solar generation by hour, so Turkey is promoted back to live as a conservative calibrated proxy. The endpoint is current-day dashboard data rather than a 30-day history API; `latestProfile` remains `null` until a complete Turkey day is available from the live response, and the source note labels this limitation.

### 13. Alaska is below the inclusion threshold, not omitted for lack of curtailment

Alaska's Railbelt grid (Chugach, Matanuska, GVEA) does see documented renewable curtailment — intermittent wind-spill at Fire Island and Eva Creek during low-load shoulder hours, plus asset-owner throttling at rural AVEC village microgrids when diesel-hybrid dispatch can't absorb peak solar. NREL's 2023 Railbelt integration study and subsequent KEA/AVEC rate-case testimony place the aggregate at well under 0.01 TWh/year, roughly three orders of magnitude below the smallest region currently tracked. There is also no public hourly feed: Railbelt operators publish monthly fuel-use summaries, not a SCADA-level dispatch stream. v0 therefore documents Alaska's absence rather than including it as a near-zero row. If a public Railbelt hourly feed becomes available, or if Fire Island/Eva Creek curtailment scales past the 0.05 TWh/year threshold used elsewhere, it will be added with the same fallback-profile treatment applied to other small grids.

### 14. v1k global expansion is coverage-first and fallback-labelled

Western Australia (SWIS), NT & Pilbara, Indonesia, Malaysia, South Korea mainland, Russia (European grid), Taiwan, Jordan, Saudi Arabia solar, UAE, Oman, and Israel are included through typical profiles after live probes failed to find stable unauthenticated hourly curtailment feeds. These are coverage-gap estimates, not measured curtailment series, and every loader labels the fallback in `sourceNote`.

- **Australia non-NEM:** WA-SWIS uses 0.4 TWh/yr mixed solar/wind; NT & Pilbara uses 0.2 TWh/yr captive solar.
- **South/Southeast Asia:** Indonesia uses 0.3 TWh/yr Java-Bali solar; Malaysia uses 0.15 TWh/yr Peninsular solar.
- **East Asia:** South Korea mainland uses 0.5 TWh/yr solar, excluding Jeju; Taiwan uses 0.6 TWh/yr mixed offshore wind and solar.
- **Russia non-flare:** Russia (European grid) uses 1 TWh/yr seasonal hydro spill. W. Siberia remains the separate flare region and is not reclassified.
- **Middle East:** Jordan uses 0.35 TWh/yr mixed wind/solar calibrated to the 17% wind-curtailment headline; Saudi Arabia solar uses 0.3 TWh/yr and remains separate from `e-saudi` flare; UAE uses 0.2 TWh/yr; Oman uses 0.1 TWh/yr; Israel uses 0.15 TWh/yr.

Corrections welcome: simon@collins.nu.
