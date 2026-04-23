<div class="methodology-doc">

<header class="methodology-header">

<div class="methodology-eyebrow">Every Last Joule · Methodology</div>

# How the dashboard's numbers are built

<p class="methodology-deck">A public working model. This page documents the data sources, tiers, calibration, and limitations behind every figure shown on the dashboard — so any claim can be traced to a specific public publication from a grid operator or regulator.</p>

</header>

## Abstract

<div class="methodology-callout methodology-callout-abstract">

This dashboard estimates the fraction of current Bitcoin network electricity consumption that is already matched by renewable-energy curtailment and associated forms of electrical waste — measured or estimated across 110 regions. The estimate is a **lower bound on visible waste**, not an upper bound on available waste. All figures are calibrated against publicly reported 2024 curtailment from the relevant grid operator or regulator. Data, sources, assumptions, and known limitations are documented below.

</div>

## 1. Scope and definitions

**Curtailment** is defined here as electricity that could have been generated from a committed renewable asset but was not, owing to an instruction from a system operator, a market rule, or a transmission constraint. This encompasses four operationally distinct phenomena that the dashboard treats as a single class:

1. **Dispatch-down** — generation instructed below available output by a system operator (e.g., EirGrid SNSP curtailment, AEMO SEMIDISPATCHCAP).
2. **Constrained-off** — generation prevented by a transmission limit (e.g., ONS Brazil `restricao_coff`, Eskom Northern Cape constraints).
3. **Spill** — hydroelectric inflow exceeding dispatch or reservoir absorption (e.g., Itaipu flood-stage, Sichuan monsoon).
4. **Steam venting** — geothermal generation exceeding overnight demand (e.g., Kenya Olkaria, per EPRA 2025).

Flared natural gas is tracked separately and excluded from the headline ratio. See §6 for the flare treatment.

**Regional units** are chosen to match the smallest unit at which the responsible grid operator publishes dispatch data. For large interconnections, that is the ISO (CAISO, ERCOT-West/East, MISO, etc.). For ENTSO-E members, it is the bidding zone. For Brazil it is the sub-state constraint region. For countries without public hourly dispatch data, it is the national grid.

**Time resolution** is hourly UTC, aggregated to 24 values representing a 30-day trailing time-of-day average. Where a grid operator publishes at finer cadence (ENTSO-E at 15 minutes, Elexon BMRS at 30 minutes), the finer cadence is used for input and averaged to hourly output.

## 2. Method

### 2.1 Three-tier data taxonomy

Each region is assigned to one of three tiers, determined by the form of its upstream data:

**Tier A — Direct measurement.** The grid operator publishes dispatch-down, constrained-off, or spill volumes at hourly or finer resolution. Curtailment is summed from the published values without a rate-proxy step. Regions in this tier include Brazil NE's six sub-state clusters (ONS, 2025), Belgium (Elia Open Data ODS086/ODS087), Denmark (Energinet ProductionConsumptionSettlement), the UK North Sea (Elexon BMRS AGWS), New Zealand (Electricity Authority EMI), and the five AEMO states (NEMWeb Next_Day_Dispatch SEMIDISPATCHCAP).

**Tier B — Calibrated proxy.** The grid operator publishes hourly generation by fuel type but does not expose per-hour curtailment. Hourly generation is multiplied by a region-specific calibrated rate anchored to the region's publicly reported 2024 annual curtailment total. This preserves the real diurnal shape of the generation mix while scaling the magnitude to match the published annual figure. Tier B regions include CAISO (EIA HEGM, 2024 rate 4.25% anchored to CAISO's published 3.4 TWh solar + 0.5 TWh wind), ERCOT (6.15% wind + 4% solar anchored to 8 TWh), the 16 ENTSO-E zones, and several additional Tier-B-via-ISO feeds.

**Tier C — Modelled fallback.** No hourly dispatch data is public. A typical-shape profile is computed for the region's dominant renewable technology and scaled to the region's published 2024 annual curtailment total. Solar regions use a cosine-like midday bump centred on local solar noon; wind regions use a 65%–100% broad overnight-weighted shape; hydro regions use a flat 24-hour shape with a monthly seasonal multiplier (see §2.3). Tier C is used where the underlying annual figure is confidently reported but no hourly upstream exists — for example, Egypt (NREA 2024), Morocco (ANRE 2024), Kazakhstan (KEGOC / Qazaq Green 2024), Honduras (ODS 2023), Jordan (NEPCO), and the Middle East solar regions (ECRA, DEWA, OPWP, Noga). Kenya's geothermal venting uses a specialised overnight-concentrated profile (§2.3).

The tier for each region is labelled in the region metadata (`tier: "live"` for Tier A and B; `tier: "static"` for Tier C).

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

**Last 24h** — the most recent complete UTC day of hourly observations for each region where the upstream feed supports it. Regions without a recoverable 24-hour raw sequence (Tier C, some ENTSO-E zones with sparse reporting) retain their 30-day profile in this mode to preserve global completeness. This mode is noisier than the 30-day mode and reflects recent grid-specific events (wind lulls, transmission maintenance, holiday demand patterns).

## 5. Flared gas: treatment and exclusion from headline

The dashboard also tracks four major gas-flaring basins — Permian (USA), W. Siberia (Russia), S. Iraq, E. Saudi Arabia — using the World Bank Global Gas Flaring Reduction Partnership's 2024 VIIRS-derived flare volumes (World Bank GGFR, 2024). Flared gas volumes are converted to electrical-equivalent energy using the assumption that 1 bcm of natural gas contains 10.55 TWh_th of thermal energy and a reciprocating-engine generator operates at 35% net electrical efficiency, yielding approximately 3.7 TWh_e per bcm flared. This conversion is consistent with the modular-generator fleet operated in the field by companies such as Crusoe Energy.

**Flare is excluded from the headline ratio.** The dashboard's primary story concerns *renewable* curtailment — a diurnal and seasonal phenomenon whose structure matters to any off-take solution. Flared gas is a continuous 24/7 base-load waste, operationally and physically distinct from dispatch-down. Including it would flatten the diurnal signal and conflate two different mitigation pathways. The flare total is reported as a single continuous-GW baseline in a footnote below the primary statistics, so it remains visible as context.

## 6. Known limitations

The following limitations are inherent to the available upstream data and should be considered by any reader interpreting the ratio:

1. **Self-curtailment is invisible.** Asset owners throttling their own output during negative-price hours do not appear in dispatch-down statistics. True curtailment is therefore systematically higher than the sum of system-operator figures.

2. **Geographic completeness.** Coverage is 110 regions across every inhabited continent. Low-dispatch-data regions (parts of Central Africa, Central Asia beyond Kazakhstan, Russia beyond the tracked Volga basin and W. Siberia flare) remain estimated rather than observed. This understates the true global total.

3. **Rate-proxy uncertainty.** Tier-B calibrated rates are anchored to a single year's published total. Where 2024 was anomalous (drought-driven hydro scarcity, unusual wind patterns), 2025's observed volumes may diverge from the implied rate. The rate is reviewed annually.

4. **Tier-C profile assumption.** Tier-C fallbacks use typical-shape profiles for the region's dominant technology. These reproduce the correct magnitude at annual scale but do not capture local transmission events or weather anomalies. Regions still on Tier C (see `tier: "static"` in regional metadata) are flagged visually and labelled in hotspot tooltips.

5. **ASIC efficiency sensitivity.** The headline ratio at 16 J/TH is higher than at 28.5 J/TH by approximately 78%, because the Bitcoin network denominator scales linearly with the efficiency assumption. Both readings are exposed in the UI.

6. **Flare estimation uncertainty.** GGFR's VIIRS-derived volumes and national self-reporting diverge by 10–25% in some basins. The 35% generator efficiency is representative of modular reciprocating-engine deployments; larger combined-cycle plants would reach 55–60%. The flare footnote is a conservative estimate in electrical-equivalent terms.

7. **Bitcoin-network denominator methodology.** mempool.space is used because CBECI's API is not server-side accessible in the current build environment; the two sources agree within 3% as of this writing. The 16 J/TH efficiency reflects 2024–2025 fleet averages; the 2026 and 2027 roadmap implies lower values, which would raise the displayed ratio proportionally.

8. **30-day window boundary effects.** Months with strong mid-window transitions (e.g., monsoon onset, seasonal demand changes) produce a representative rather than current figure. The explicit "Last 24h" mode is provided for users who prefer recent-day sensitivity.

## 7. References

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
- **PJM** (2024). *2024 Renewable Integration Study*; Monitoring Analytics *State of the Market Report*.
- **REE** (2024). *Informe del Sistema Eléctrico 2024*. Red Eléctrica de España.
- **RTE** (2024). *Bilan Électrique 2024*. Réseau de Transport d'Électricité.
- **SAREM** (2025). *South African Renewable Energy Masterplan 2025*.
- **SPP** (2024). *State of the Market Report 2024*. Monitoring Analytics.
- **Terna** (2024). *Rapporto Mensile sul Sistema Elettrico*. Terna S.p.A.
- **World Bank GGFR** (2024). *Global Gas Flaring Reduction Partnership Annual Report*. https://www.worldbank.org/en/programs/gasflaringreduction

## 8. Versioning and reproducibility

The dashboard source code and this methodology are versioned at https://github.com/honeybeesquad/every-last-joule-dashboard. Every loader is pure with respect to its upstream data inputs, and cached "last-known-good" snapshots are committed for each region so that any reader can reproduce the current displayed figure from a clean build with `npm install && npm run build`. Per-region annual TWh anchors, calibrated rates, fuel-mix overrides, and seasonal multipliers are all source-visible in `src/data/` and `src/lib/`.

---

*This methodology accompanies the author's forthcoming book* Every Last Joule: How Bitcoin Meets Energy Where It Is *(Collins, forthcoming). Technical corrections and source suggestions are welcome via GitHub issues.*

</div>
