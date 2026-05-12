<nav class="page-back-nav"><a href="./">← Dashboard</a></nav>

<div class="methodology-doc">

<header class="methodology-header">

<div class="methodology-eyebrow">Every Last Joule · Methodology</div>

# How the dashboard's numbers are built

<p class="methodology-deck">A public working model. This page documents the data sources, tiers, calibration, and limitations behind every figure shown on the dashboard — so any claim can be traced to a specific public publication from a grid operator or regulator.</p>

</header>

## Abstract

<div class="methodology-callout methodology-callout-abstract">

This dashboard is a **wasted-energy database**: it estimates the fraction of current Bitcoin network electricity consumption that is already matched by renewable-energy curtailment, with associated-gas flaring tracked separately as a continuous base-load — measured or estimated across 384 regions. The renewable-curtailment figure is a **lower bound on visible waste**, not an upper bound on available waste. All figures are calibrated against publicly reported 2024 curtailment from the relevant grid operator or regulator. Data, sources, assumptions, and known limitations are documented below.

</div>

## 1. Scope and definitions

**Curtailment** is defined here as electricity that could have been generated from a committed renewable asset but was not, owing to an instruction from a system operator, a market rule, or a transmission constraint. This encompasses four operationally distinct phenomena that the dashboard treats as a single class:

1. **Dispatch-down** — generation instructed below available output by a system operator (e.g., EirGrid SNSP curtailment, AEMO SEMIDISPATCHCAP).
2. **Constrained-off** — generation prevented by a transmission limit (e.g., ONS Brazil `restricao_coff`, Eskom Northern Cape constraints).
3. **Spill** — hydroelectric inflow exceeding dispatch or reservoir absorption (e.g., Itaipu flood-stage, Sichuan monsoon).
4. **Steam venting** — geothermal generation exceeding overnight demand (e.g., Kenya Olkaria, per EPRA 2025).

Flared natural gas is tracked separately and excluded from the headline ratio. See §6 for the flare treatment.

Defensibility notes for the three recently audited assumptions are maintained separately: [flare regions](https://github.com/honeybeesquad/every-last-joule-dashboard/blob/main/docs/methodology/flare-ercot-brazil.md#flare), [ERCOT West/East split](https://github.com/honeybeesquad/every-last-joule-dashboard/blob/main/docs/methodology/flare-ercot-brazil.md#ercot), and [Brazil NE clustering](https://github.com/honeybeesquad/every-last-joule-dashboard/blob/main/docs/methodology/flare-ercot-brazil.md#brazil-ne).

**Regional units** are chosen to match the smallest unit at which the responsible grid operator publishes dispatch data. For large interconnections, that is the ISO (CAISO, ERCOT-West/East, MISO, etc.). For ENTSO-E members, it is the bidding zone. For Brazil it is the sub-state constraint region. For countries without public hourly dispatch data, it is the national grid.

**Time resolution** is hourly UTC, aggregated to 24 values representing a 30-day trailing time-of-day average. Where a grid operator publishes at finer cadence (ENTSO-E at 15 minutes, Elexon BMRS at 30 minutes), the finer cadence is used for input and averaged to hourly output.

## 2. Method

### 2.1 Confidence tiers

Every region carries an explicit `confidenceTier` so readers can filter or weight observations by source quality. The tiers, the underlying loader mechanics, and the published envelope are documented in full in [`docs/methodology/uncertainty.md`](https://github.com/honeybeesquad/every-last-joule-dashboard/blob/main/docs/methodology/uncertainty.md). The short version:

The live-feed tier was subdivided into three sub-tiers in CODEX-7 (locked 2026-04-25, see [`docs/proposals/b4-option-b-decision.md`](https://github.com/honeybeesquad/every-last-joule-dashboard/blob/main/docs/proposals/b4-option-b-decision.md)) once the post-B1 rerun made it clear that "live feed plus rate" hides three operationally distinct calibration provenances. The legacy `T1-live-TSO` label is retained as an alias for pre-2026-04-25 snapshots and reads as T1a for envelope sizing.

**T1a-live-tso (149 regions, ±15% peakGW envelope or ±2σ from 5-year backfill).** Live TSO/ISO/operator hourly feed *and* a calibration rate published by the same jurisdiction's TSO or regulator. Two loader mechanics fall here: *direct-measurement* loaders sum published dispatch-down / constrained-off / spill volumes (Brazil's eleven ONS state clusters — five named Northeast states plus six South/Centre-South states, with a catch-all bucket for unmapped rows; Belgium, Denmark, the UK North Sea, New Zealand, the five AEMO states; Japan-Tohoku via the direct 太陽光出力制御量+風力出力制御量 columns); *calibrated-proxy* loaders take published hourly generation and multiply by a region-specific 2024-anchored rate (CAISO at 4.25%, ERCOT West/East at 6.15% wind + 4% solar, WA-SWIS at 8% via AEMO WEM Facility SCADA, Japan — nine utilities at rates 1–10% per OCCTO FY2024 anchor — via per-utility juyo area-demand CSVs, most ENTSO-E bidding zones). Both mechanics start from a live grid feed and an own-jurisdiction anchor; they differ only in whether the operator publishes curtailment directly or whether we infer it from generation. The diurnal shape in both cases is real, not assumed. Default envelope is ±15% of peakGW; replaced with 2σ of annual peakGW from the 5-year backfill where the historical archive supports it.

**T1b-live-domestic-anchored (9 regions, ±50% peakGW envelope).** Live feed plus a calibration rate sourced from a *domestic statistical agency* or modelled share-split of a national anchor — i.e., the rate's scope and the live feed's scope do not coincide. The nine current zones are Italy-Sardinia wind/solar and Italy-North-Zone wind/solar (TERNA bidding-zone live feeds; rate from a national anchor split by zone-share), Italy-Sicily wind/solar (TERNA Sicily zone; rate from national anchor via zone-share), Netherlands wind/solar (TenneT live feed; rate modelled from the CBS national renewables share), and Colombia (XM SinerGox live hydro-spill via WireGuard Colombian egress; vertimientos daily series with bimodal seasonal shape). The ±50% envelope is empirical — the post-B1 rerun on 2026-04-26 measured a P67 fractional residual of 0.50 across these zones, reflecting systematic anchor-scope offset that 2σ on the live series cannot capture.

**T1c-live-neighbour-anchored (1 region, ±35.5% peakGW envelope).** Live feed plus a calibration rate *extrapolated from a neighbouring zone* (no domestic rate published). Switzerland uses Swissgrid's live curtailment feed multiplied by the Czech CEPS rate. The ±35.5% envelope is the empirical residual of Switzerland's reconstructed total against the Czech-rate-projected total over the post-B1 rerun window; it is wider than T1a but narrower than T1b because the neighbouring rate is a closer proxy than a domestic-stat-agency split, but still introduces cross-border generation-mix bias. T1c is a structural slot — additional zones may move into it as more domestic anchors are audited.

The ENTSO-E rate constants are tracked separately in [the ENTSO-E curtailment-rate audit](https://github.com/honeybeesquad/every-last-joule-dashboard/blob/main/docs/methodology/entsoe-rates.md). As of the 2026-04-24 audit, Germany, the Netherlands, Poland, and Greece have public 2024 anchors strong enough to set or revise loader rates; Spain, Portugal, Finland, Romania, Italy's bidding-zone split, Sweden, Hungary, Bulgaria, and the Baltic proxy remain explicitly labelled as placeholders until a national operator total or ENTSO-E A77 curtailed-renewable series is integrated.

**T2-annual-calibrated (6 regions, ±20% peakGW envelope).** A static flat-base profile anchored to a published annual total, with no diurnal modelling. Currently Austria APG, Russia Murmansk wind, and four Chinese provincial hydro-flat regions (Hunan, Hubei, Guizhou, Chongqing) whose hydroelectric spill is reported annually but without hourly or diurnal resolution. The eight flare regions carry the same envelope but appear as a separate "flare" bucket on Figure 4 because their flat 24/7 base-load shape is the *physical truth* of upstream gas flaring rather than a modelling concession.

**T3-modelled (211 regions, ±40% peakGW envelope).** A typical-shape profile (solar / wind / hydro-seasonal / mixed / overnight) scaled to a published annual anchor. Used where the annual total is confidently reported but no hourly upstream exists. The eight Chinese provincial regions are the largest T3 block, calibrated against NEA 2024 utilisation rates and public provincial generation data (65.4 TWh/yr, ~77% of NEA-implied national 2024 renewable curtailment/spill — the [China provincial methodology](https://github.com/honeybeesquad/every-last-joule-dashboard/blob/main/docs/methodology/china-provinces.md) carries the full audit). T3 also covers Ireland (Republic and Northern), Peru, South Africa (all reachability probes scaled to a published annual anchor — see [`docs/known-limitations.md`](https://github.com/honeybeesquad/every-last-joule-dashboard/blob/main/docs/known-limitations.md) item 6), most of South Asia, Africa, the Middle East outside flare, Latin America outside Brazil/Atacama, and Hawaii. Kenya's geothermal venting uses a specialised overnight-concentrated profile (§2.3).

The runtime classification is deterministic: `confidenceTier` is derived from `Region.tier` plus the loader's profile kind by [`src/lib/uncertainty.ts::deriveTier`](https://github.com/honeybeesquad/every-last-joule-dashboard/blob/main/src/lib/uncertainty.ts), and the live counts above are emitted by `scripts/tally-tiers.ts` so any reviewer can confirm them from the source repo.

### 2.2 Fuel-mix attribution (fuelShare)

Where a loader fetches multiple generation technologies, the per-region observation is stored together with a measured fuel-mix vector `fuelShare = { solar, wind, hydro }` derived from the ratio of observed wind to solar MWh over the same 30-day window. This is the preferred form of attribution because it uses actually observed dispatch data rather than a fixed assumption.

For regions with only one published technology feed (e.g., ENTSO-E Finland wind-only; Cyprus solar-only), a single-kind attribution is used. For regions where no technology breakdown is published but the generation mix is known from annual reports (e.g., Peru: 70% hydro / 20% solar / 10% wind), a fixed published-ratio attribution is applied.

This mechanism materially corrects bucketing errors that a uniform assumption would introduce. For example, Brazilian sub-state Ceará observes approximately 77% solar / 23% wind of its curtailment volume (ONS 2025), rather than the 100% wind that the region's historical reputation would suggest.

### 2.3 Seasonal corrections

Two renewable classes have strong sub-annual seasonality that a flat annual rate misrepresents:

**Hydroelectric spill** occurs during wet-season inflow exceeding reservoir and dispatch capacity. For five regions (Sichuan, Iceland, Paraguay, Ethiopia, European Russia), monthly-share vectors summing to 1.0 are derived from published hydrological reports and applied as a time-varying multiplier against the 30-day rolling window. The multiplier is the mean of the current 30 days' daily monthly shares, multiplied by 12 (so that a full-year integration recovers the published annual total). For Sichuan, this places approximately 52% of curtailment in June–August; for Paraguay (Southern Hemisphere) the peak shifts to December–February.

**Geothermal overnight venting** in Kenya is modelled as a raised-cosine bump centred on UTC 23:30 with half-width 2.5 hours, producing zero curtailment during daylight hours and concentrated output between UTC 21:00 and 02:00. This directly reflects EPRA's reported curtailment window of 0000–0500 local time (UTC+3) for Olkaria and Menengai geothermal fields. A monthly seasonal factor scales the overall magnitude, anchored to EPRA's 117.5 GWh July 2024 peak and 6.6 GWh June 2025 trough.

These treatments are specific to the physical phenomena cited, not generic. Other renewables (solar, wind) are represented by their diurnal shape alone; their weekly-to-annual variation emerges naturally from the 30-day rolling window of actual observed generation.

## 3. Comparison basis: Bitcoin network consumption

The numerator of the headline ratio is annualised curtailment in TWh_e. The denominator is current Bitcoin network electricity consumption, computed as:

`Network (TWh/yr) = hashrate (EH/s) × J/TH efficiency × 365.25 × 24 × 3600 × 10^-9`

The hashrate value is obtained from mempool.space's public 24-hour rolling average, refreshed hourly. The efficiency assumption is **16 J/TH**, the fleet-average figure implied by the Cambridge Centre for Alternative Finance *Cambridge Digital Mining Industry Report* (CCAF, 2025) and consistent with the Cambridge Bitcoin Electricity Consumption Index (CBECI) 2025 mid-estimate of approximately 138 TWh/yr at roughly 1,000 EH/s. The dashboard also exposes a secondary reading at 28.5 J/TH (field-weighted, CoinMetrics 2025) so that users can observe the efficiency-assumption sensitivity directly.

No claim is made that mempool.space's hashrate equals the "true" current hashrate; all hashrate measurements are proxies observing share chains, and they diverge by low-single-digit percentages across sources. The 24-hour rolling average was selected over instantaneous readings to smooth block-timing noise.

## 4. Dashboard modes

Two display modes are provided:

**30-day average** (default) — a trailing time-of-day average over 30 days of hourly observations, expressed as 24 hourly GW values. Each UTC hour is the mean of that hour across the window. This mode de-noises dispatch variability and reveals structural diurnal shape. It does not represent the most recent day.

**Last 24h** — the most recent complete UTC day of hourly observations for each region where the upstream feed supports it. Regions without a recoverable 24-hour raw sequence (T3-modelled regions by definition; some T1 ENTSO-E zones with sparse reporting in practice) retain their 30-day profile in this mode to preserve global completeness. This mode is noisier than the 30-day mode and reflects recent grid-specific events (wind lulls, transmission maintenance, holiday demand patterns).

## 5. Flared gas: treatment and exclusion from headline

The dashboard also tracks eight major gas-flaring basins — Permian (USA), W. Siberia (Russia), S. Iraq, E. Saudi Arabia, Qatar, Kuwait, Yamal (Russia), and E. Siberia (Russia) — using World Bank Global Gas Flaring Reduction Partnership VIIRS-derived flare-location volumes (World Bank GGFR, 2025). Flared gas volumes are converted to electrical-equivalent energy using the assumption that 1 bcm of natural gas contains 10.55 TWh_th of thermal energy and a reciprocating-engine generator operates at 35% net electrical efficiency, yielding approximately 3.7 TWh_e per bcm flared. This conversion is consistent with the modular-generator fleet operated in the field by companies such as Crusoe Energy. See the [flare audit note](https://github.com/honeybeesquad/every-last-joule-dashboard/blob/main/docs/methodology/flare-ercot-brazil.md#flare) for per-basin volumes and uncertainty bounds.

**Flare is excluded from the headline ratio.** The dashboard's primary story concerns *renewable* curtailment — a diurnal and seasonal phenomenon whose structure matters to any off-take solution. Flared gas is a continuous 24/7 base-load waste, operationally and physically distinct from dispatch-down. Including it would flatten the diurnal signal and conflate two different mitigation pathways. The flare total is reported as a single continuous-GW baseline in a footnote below the primary statistics, so it remains visible as context.

## 6. Known limitations

The following limitations are inherent to the available upstream data and should be considered by any reader interpreting the ratio:

1. **Self-curtailment is invisible.** Asset owners throttling their own output during negative-price hours do not appear in dispatch-down statistics. True curtailment is therefore systematically higher than the sum of system-operator figures.

2. **Geographic completeness.** Coverage is 384 regions across 195 countries. Low-dispatch-data regions (parts of Central Africa, Central Asia beyond Kazakhstan, Russia beyond the tracked Volga basin and W. Siberia flare) remain estimated rather than observed. Colombia is excluded until XM's documented public API is reachable from the build environment; it is not represented by a modelled fallback. This understates the true global total.

3. **Rate-proxy uncertainty (T1 calibrated-proxy regions).** Calibrated rates are anchored to a single year's published total. Where 2024 was anomalous (drought-driven hydro scarcity, unusual wind patterns), 2025's observed volumes may diverge from the implied rate. The rate is reviewed annually. The per-sub-tier envelopes (±15% of `peakGW` for T1a, ±50% for T1b, ±35.5% for T1c) cover this drift but do not eliminate it; T1b/T1c envelopes are larger because the rate's jurisdiction does not match the live feed's jurisdiction (see §2.1).

4. **Profile-shape assumption (T3-modelled regions).** T3 fallbacks use typical-shape profiles for the region's dominant technology. These reproduce the correct magnitude at annual scale but do not capture local transmission events or weather anomalies. The ±40% peakGW envelope is wider than T1/T2 precisely because of the shape-assumption layer. T3 regions are flagged visually and labelled in hotspot tooltips, and `confidenceTier` lets any downstream consumer filter them out if their analysis requires only measured hourly data.

5. **ASIC efficiency sensitivity.** The headline ratio at 16 J/TH is higher than at 28.5 J/TH by approximately 78%, because the Bitcoin network denominator scales linearly with the efficiency assumption. Both readings are exposed in the UI.

6. **Flare estimation uncertainty.** GGFR's VIIRS-derived volumes and national self-reporting diverge by 10–25% in some basins. The 35% generator efficiency is representative of modular reciprocating-engine deployments; larger combined-cycle plants would reach 55–60%. The flare footnote is a conservative estimate in electrical-equivalent terms. The current per-basin citation chain is documented in the [flare audit note](https://github.com/honeybeesquad/every-last-joule-dashboard/blob/main/docs/methodology/flare-ercot-brazil.md#flare).

7. **Bitcoin-network denominator methodology.** mempool.space is used because CBECI's API is not server-side accessible in the current build environment; the two sources agree within 3% as of this writing. The 16 J/TH efficiency reflects 2024–2025 fleet averages; the 2026 and 2027 roadmap implies lower values, which would raise the displayed ratio proportionally.

8. **30-day window boundary effects.** Months with strong mid-window transitions (e.g., monsoon onset, seasonal demand changes) produce a representative rather than current figure. The explicit "Last 24h" mode is provided for users who prefer recent-day sensitivity.

## 7. USD Conversion

The MW ↔ USD toggle converts curtailed energy to its estimated wholesale market value at the time of production. All values are in US dollars (USD).

### Live-tier regions (±10%)

For regions with live day-ahead price data (ENTSO-E, EIA Open Data, AEMO), we use **true hourly multiplication**: curtailment at each UTC hour h is multiplied by the day-ahead settlement price at that same hour h, then summed across the day. This captures the price/curtailment correlation that matters in renewable-heavy markets — wind curtailed at 3am when prices are near zero has a very different value from wind curtailed at 6pm during a demand peak.

**Sources:**
- **ENTSO-E** — Day-ahead prices via the ENTSO-E Transparency Platform (`transparency.entsoe.eu`). 37 EU bidding zones. Prices in EUR/MWh, converted to USD at the ECB daily noon rate.
- **EIA Open Data** — Day-ahead LMPs via `api.eia.gov`. 9 US ISO regions (CAISO, ERCOT, MISO, PJM, SPP, NYISO, ISO-NE, BPA, MISO). Prices natively in USD/MWh.
- **AEMO** — Spot prices via AEMO visualisations API. 5 NEM regions (NSW, VIC, QLD, SA, TAS). Prices in AUD/MWh, converted to USD at the ECB daily noon rate.

### Static-tier regions (±30%)

For regions where only annual average wholesale prices are available, we use **scalar multiplication**: a single $/MWh annual average × current curtailment MW. This does not capture the price/curtailment correlation — for renewable-heavy markets where curtailment peaks during low-price periods, the resulting figure may overstate the true value.

**Sources:** IEA *World Energy Prices 2024*, EIA *International Electricity Prices*, Ember *Global Electricity Review 2024*, and national regulatory reports. Prices converted to USD using IMF 2024 annual average exchange rates.

### Regions without price data

Approximately 200 regions have curtailment data but no citable wholesale electricity price (opaque subsidised markets, unreported grids, or regions without a functioning spot market). These regions appear as greyed pillars on the globe in USD mode and are excluded from USD totals. The global USD headline notes how many regions are excluded.

### FX conversion

All prices are stored in USD/MWh — conversion happens at data fetch time, not at display time:
- Live-tier prices in EUR or AUD are converted using the ECB daily noon rate fetched at loader run time.
- Static-tier prices in local currency are converted using IMF 2024 annual average rates, baked into the source data.

## 8. References

- **Brattle Group** (2024). *Quantifying Curtailment in the US ISO Markets*. Brattle Energy Policy Review.
- **BPA** (2024). *Oversupply Management Protocol Implementation Report 2024*. Bonneville Power Administration.
- **BNetzA** (2025). *Monitoringbericht 2025: Preliminary 2024 Figures*. Bundesnetzagentur / Bundeskartellamt.
- **Cambridge Centre for Alternative Finance** (2025). *Cambridge Digital Mining Industry Report: Global Operations, Sentiment, and Energy Use*. CCAF, University of Cambridge. https://www.jbs.cam.ac.uk/faculty-research/centres/alternative-finance/
- **Cambridge Blockchain Network Sustainability Index** (2025). *CBECI dashboard*. https://ccaf.io/cbnsi/cbeci
- **CBS / TenneT** (2025). *Renewables 2024 Report*. Statistics Netherlands / Transmission System Operator.
- **CoinMetrics** (2025). *Field-Weighted ASIC Efficiency Estimate*. https://coinmetrics.io/
- **Coordinador Eléctrico Nacional Chile** (2025). *Reducciones de Energía Eólica, Solar e Hidráulica en el SEN, Monthly Workbooks*. https://www.coordinador.cl/
- **EIA** (2025). *Hourly Electric Grid Monitor, fuel-type data API*. US Energy Information Administration. https://api.eia.gov/v2/electricity/rto/fuel-type-data/data/
- **EirGrid** (2024). *Annual Report 2024 — Dispatch-Down Statistics*. https://www.eirgridgroup.com/
- **Ember** (2025). *Global Electricity Review 2025*. https://ember-energy.org/
- **Ember India** (2025). *India Solar Curtailment Monitor, May–December 2025*.
- **ENTSO-E** (2025). *Transparency Platform, generation-per-type and redispatch datasets*. https://transparency.entsoe.eu/
- **EPRA Kenya** (2025). *Energy & Petroleum Statistics Report, Year Ended June 2025*. Energy and Petroleum Regulatory Authority.
- **Eskom** (2025). *Medium-Term System Adequacy Outlook October 2025*.
- **EVN / NLDC Vietnam** (2024). *Renewable Energy Curtailment Reports, Provincial Breakdown*.
- **IEA** (2025). *Renewables 2025*. International Energy Agency. https://www.iea.org/reports/renewables-2025/renewable-electricity
- **International Hydropower Association** (2024). *Country Reservoir Hydrology Reports*.
- **ISO-NE** (2024). *2024 Regional Electricity Outlook*.
- **Elexon** (2025). *Balancing Mechanism Reporting Service (BMRS), `AGWS` dataset*. https://data.elexon.co.uk/bmrs/api/v1/datasets/AGWS
- **MISO** (2024). *State of the Market Report 2024*. Potomac Economics (Independent Market Monitor).
- **NREA Egypt** (2025). *FY2024/25 Annual Renewable Energy Report*. New and Renewable Energy Authority.
- **NYISO** (2024). *Power Trends 2024; Gold Book 2024*.
- **ONS Brazil** (2025). *Constrained-off wind and solar open-data series*. https://www.ons.org.br/
- **ONS / ANEEL Brazil NE audit** (2026). *Brazil NE state-code clustering citation chain*. https://github.com/honeybeesquad/every-last-joule-dashboard/blob/main/docs/methodology/flare-ercot-brazil.md#brazil-ne
- **PJM** (2024). *2024 Renewable Integration Study*; Monitoring Analytics *State of the Market Report*.
- **Potomac Economics / ERCOT audit** (2026). *ERCOT West/East split limitation note*. https://github.com/honeybeesquad/every-last-joule-dashboard/blob/main/docs/methodology/flare-ercot-brazil.md#ercot
- **REE** (2024). *Informe del Sistema Eléctrico 2024*. Red Eléctrica de España.
- **RTE** (2024). *Bilan Électrique 2024*. Réseau de Transport d'Électricité.
- **SAREM** (2025). *South African Renewable Energy Masterplan 2025*.
- **SPP** (2024). *State of the Market Report 2024*. Monitoring Analytics.
- **Terna** (2024). *Rapporto Mensile sul Sistema Elettrico*. Terna S.p.A.
- **World Bank GGFR** (2025). *Global Gas Flaring Tracker Report and individual flare-location dataset*. https://www.worldbank.org/en/programs/gasflaringreduction/global-flaring-data

## 9. Versioning and reproducibility

The dashboard source code and this methodology are versioned at https://github.com/honeybeesquad/every-last-joule-dashboard. Every loader is pure with respect to its upstream data inputs, and cached "last-known-good" snapshots are committed for each region so that any reader can reproduce the current displayed figure from a clean build with `npm install && npm run build`. Per-region annual TWh anchors, calibrated rates, fuel-mix overrides, and seasonal multipliers are all source-visible in `src/data/` and `src/lib/`.

## 10. Recent corrections

A peer review on 2026-04-25 surfaced a small set of corrections, landed 2026-04-26:

- **PT15M aggregation overcount (B1).** ENTSO-E publishes most zones at 15-minute resolution. The `totalTWh30d` aggregator was multiplying every interval by one hour, overstating ENTSO-E zone totals by a factor of four. After the fix, Germany's 30-day total moves from ~3.7 TWh to ~0.92 TWh (annualized ~11 TWh/yr, matching BNetzA's 9.34 TWh published 2024 curtailment within ±15%). All ENTSO-E-derived figures on this dashboard reflect the corrected aggregation.
- **splitRegion uncertainty propagation (S5).** Zones derived by proportional split of a parent (e.g., Italy sub-zones, Switzerland-via-Czech) now scale `observedStdGW` proportionally to the child's share rather than inheriting the parent's absolute value. Tightens uncertainty envelopes on small derived zones.
- **Probe-only `sourceNote` honesty (N3).** Iran, UAE, and Saudi-solar previously reported "live feed unavailable (timeout)" — misleading, since none of these regions publish a live feed. Now reported as "no public hourly curtailment feed" with the anchored typical-shape model disclosed inline.
- **`sourceStatus` enum (S2).** Added a third value, `degraded`, distinguishing fresh-cache (under 24h) from stale-cache (over 24h since last successful upstream fetch). Each region also now carries a `lastSuccessAt` timestamp for transparency.
- **T2 constant-rate disclosure (S6).** The methodology page now explicitly states that T2 zones use a constant `MW_curtailed / MW_generated` rate per region (vs the time-of-day rate available in T1). This is a documented limitation, not a hidden one.

- **T1 sub-tier subdivision (CODEX-7).** The T1 live-feed tier was subdivided into T1a-live-tso (63 regions, own-jurisdiction rate, ±15% / 2σ), T1b-live-domestic-anchored (4 regions, domestic stat-agency or modelled-split rate, ±50% empirical), and T1c-live-neighbour-anchored (1 region, neighbour-extrapolated rate, ±35.5% empirical) per the empirical anchor-coverage analysis at `scripts/calibration/empirical_tier_bands.py --by-derivation` and the post-B1 rerun on 2026-04-26. The locked envelopes (±50% for T1b, ±35.5% for T1c) replace the original ±20–25% / ±30–40% provisional bands because the rerun's per-zone residual against published anchors was wider than the pre-rerun analytic estimate. Pre-2026-04-25 snapshots retain the legacy `T1-live-TSO` label as an alias of T1a for envelope sizing.

---

*This methodology accompanies the author's forthcoming book* Every Last Joule: How Bitcoin Meets Energy Where It Is *(Collins, forthcoming). Technical corrections and source suggestions are welcome via GitHub issues.*

</div>
