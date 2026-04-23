# Known limitations (v0)

Every dashboard of this kind is bounded by the quality of its upstream data and the honesty of its author. v0 carries these specific limitations, listed so they are not hidden:

### 1. Self-curtailment is invisible

Market-data curtailment captures system-operator dispatch-down instructions, but it does not capture asset owners privately throttling output in response to negative prices or local economics. The book research treats this as a material blind spot: observed curtailment is commonly only about 50 - 70% of true curtailment once self-curtailment behaviour in ERCOT and European markets is considered.

### 2. Geographic gaps

Japan, India, much of Africa, and most of the Middle East are not yet represented, aside from the four flare basins included here. The missing share is unlikely to overturn the headline direction of travel, but it does mean v0 is not yet a global total in the strict sense.

### 3. ASIC efficiency divergence

Cambridge’s 2025 CBECI estimate implies a fleet average around 16 J/TH, while CoinMetrics’ field-weighted estimate is materially looser at about 28.5 J/TH. v0 uses 16 J/TH for the primary readout because it is the closest fit to the academic benchmark being cross-checked, but the methodology page keeps the wider range visible because the disagreement is real and load-bearing.

### 4. Flare estimation uncertainty

VIIRS-derived and GGFR-derived flare estimates do not line up perfectly, and basin-level divergence can be significant. v0 uses GGFR annual totals as the base, converts them to electrical-equivalent output at 35% generator efficiency, and labels the flare contribution as an annualised estimate rather than a live observation.

### 5. 30-day time-of-day averaging smooths anomalies

A specific day’s curtailment can deviate sharply from the profile shown on the dashboard, particularly during weather events, outages, or acute transmission constraints. That smoothing is intentional in v0 because the aim is to show the recurring daily pattern rather than overfit to yesterday’s noise; a latest-24-hour mode belongs in a later release.

### 6. Brazil NE is direct-measured; other regions are calibrated proxies

Brazil NE is the only live renewable-curtailment region in v0 that reports native constrained-off data through its public feed. The other live renewable regions estimate curtailment by applying calibrated 2024 rates to observed generation, which preserves shape usefully but remains one step removed from a native curtailment series.

### 7. Network consumption anchor

CBECI remains the canonical academic benchmark for Bitcoin electricity consumption, but its API is recaptcha-gated and not usable from the server-side loader. v0 therefore uses mempool.space’s 24-hour-average hashrate and derives annualised consumption at 16 J/TH, with quarterly cross-checks against Cambridge’s published dashboard value.

### 8. ERCOT remains on the EIA proxy after the B2 native attempt

ERCOT’s native developer API remains blocked behind the Incapsula WAF from this local environment, even with valid credentials. The B2 native probe acquired a token locally, then received HTTP 403 from `api.ercot.com`. Vercel’s US build path acquired a token and bypassed Incapsula after the missing ERCOT env vars were added, but the SCED HDL/LDL artifact data call returned HTTP 404. v0.5 therefore keeps `ERCOT_NATIVE_ENABLED = false` and continues to use EIA hourly wind with a 6.15% calibrated rate, split into ERCOT West and East. The inactive native loader remains in the repo for a future endpoint-discovery pass.

### 9. Atacama (Chile) uses a typical solar shape after the B2 Playwright attempt

Coordinador Eléctrico Nacional’s public landing page can be reached by headless Chromium, but the specific renewable-reduction document path still returns Cloudflare bot-verification content. v0.5 therefore represents Atacama as a static-source, typical-shape solar profile using `solarProfile(16.5, 5.9)`: a daylight bump around UTC 16:30 scaled to the book’s 5.9 TWh/year baseline. It is not a native measured Chilean curtailment feed.

Corrections welcome: simon@collins.nu.
