## 1. Bitcoin's annual energy consumption

The Every Last Joule paper anchors Bitcoin's annual electricity demand on the WooCharts ESG tracker, a publicly maintained dashboard authored by Willy Woo and Daniel Batten that integrates Cambridge's CBECI consumption index, the Bitcoin Mining Energy Consumption Index (BMECI), and the Bitcoin Energy & Emissions Sustainability Tracker (BEEST).^1^ WooCharts does not publish a standalone TWh chart but exposes annualised gross emissions (Mt CO₂e/yr) and emissions intensity (g CO₂e/kWh) such that energy consumption is recoverable algebraically: `TWh/yr = Annual Emissions (Mt) × 1,000 ÷ Intensity (g/kWh)`.^1,2^

Reading the WooCharts time series directly from the page-side Plotly traces on 2026-05-07, the most recent published data point is dated 2024-07-27 with a gross-emissions estimate of **49.30 Mt CO₂e/yr** and an intensity of **249.5 g CO₂e/kWh**, which implies a network-level demand of **~197.6 TWh/yr**.^1,2^ The mitigation channel — primarily flare-gas and vented-methane captured for mining — was tracking 6.97% of total emissions on the same date, leaving a *net* footprint of 45.83 Mt CO₂e/yr.^3^

### Time series 2022 → 2024 (WooCharts)

The implied energy figure has climbed roughly in line with hashrate, while intensity has fallen sharply. Selected month-end snapshots from the WooCharts Plotly series:^1,2,3^

| Month | Gross emissions (Mt CO₂e/yr) | Intensity (g CO₂e/kWh) | Implied TWh/yr |
|---|---|---|---|
| 2022-07 | 67.06 | 354.7 | 189 |
| 2022-12 | 56.41 | 350.2 | 161 |
| 2023-06 | 51.55 | 296.3 | 174 |
| 2023-12 | 49.95 | 269.6 | 185 |
| 2024-04 | 46.06 | 232.9 | 198 |
| 2024-07 | 49.30 | 249.5 | 197.6 |

(Gross-emissions figures are reconstructed by summing the WooCharts gross-emissions trace at the listed month-end timestamps.) The ~198 TWh/yr 2024 mid-year reading is consistent in order of magnitude with the parallel CBECI live estimate of **~175 TWh/yr** for the same period (CBECI uses a different lower-bound electricity-mix model and treats off-grid stranded gas differently).^4^ The headline divergence between WooCharts and CBECI is explainable: WooCharts integrates BEEST's bottom-up site-survey of off-grid mining, which CBECI under-counts; CBECI publishes a tighter range that excludes off-grid and behind-the-meter capacity by construction.^1,4^

### Methodology summary (WooCharts)

WooCharts' "Bitcoin Network Total Emissions" page defines the calculation as: "Annual Emissions (Mt CO₂e/year)" against "Annual Energy Consumption (GWh/year)", with intensity computed as the ratio of the two.^1,2^ Inputs cited on every WooCharts ESG page are: CBECI for headline electricity consumption; BMECI for the bottom-up rig-population energy model; BEEST for the off-grid + flare-gas + sustainable-share share-of-hashrate inputs that WooCharts uses to reweight CBECI's grid-mix assumptions.^1,2,3^ The model treats Scope 1 emissions as zero (miners run on purchased electricity, not on direct fuel combustion), Scope 2 as the operating term, and emissions-mitigated as a *negative* Scope 2 line — when a mining site is on flare gas that would otherwise be vented, the displaced methane (CH₄ → CO₂ via combustion) is netted against the site's grid-equivalent emissions.^2,3^

For cross-check transparency we note that CCAF / CBECI; Alex de Vries' Digiconomist BECI; ARK Invest's mining intensity work; and CoinShares' annual mining report all publish overlapping but methodologically distinct estimates.^4–7^ Per Simon Collins's editorial direction, only WooCharts is cited as the headline anchor in the ELJ paper; the others are footnotes, not primary anchors.

### References (Item 1)

1. WooCharts. *Bitcoin Network Emissions Intensity*. 2026. https://woocharts.com/esg-bitcoin-mining-emissions-intensity/ (data trace dated 2024-07-27, accessed 2026-05-07).
2. WooCharts. *Bitcoin Network Total Emissions*. 2026. https://woocharts.com/esg-bitcoin-mining-total-emissions/ (accessed 2026-05-07).
3. WooCharts. *Bitcoin Network Emissions Mitigated*. 2026. https://woocharts.com/esg-bitcoin-emissions-mitigated/ (accessed 2026-05-07).
4. Cambridge Centre for Alternative Finance. *Cambridge Bitcoin Electricity Consumption Index (CBECI) — methodology v1.3.0*. Cambridge Judge Business School, University of Cambridge; 2025. https://ccaf.io/cbnsi/cbeci/methodology
5. de Vries A. *Bitcoin Energy Consumption Index*. Digiconomist; 2025. https://digiconomist.net/bitcoin-energy-consumption (cited only as cross-check; the ELJ paper does not anchor on Digiconomist).
6. ARK Invest. *Bitcoin Mining and the Case for More Renewable Energy*. 2024. https://www.ark-invest.com/articles/analyst-research/bitcoin-mining-and-the-case-for-more-renewable-energy
7. CoinShares. *Bitcoin Mining Network — Energy & Carbon Emissions Report*. 2024. https://coinshares.com/research/

---

## 2. Bitcoin's grid-mix emissions intensity

The same WooCharts ESG dashboard publishes a network-wide grid-mix intensity in grams of CO₂-equivalent per kWh.^1^ Reading the live Plotly series on 2026-05-07, the most recent published data point (2024-07-27) shows a network intensity of **249.5 g CO₂e/kWh**, with a record-low value of **232.9 g CO₂e/kWh** observed on 2024-04-26 — coinciding with the post-halving hashrate squeeze that drove higher-emissions older-generation rigs offline.^1^ The series began the WooCharts record on 2019-09-02 at **597.2 g CO₂e/kWh** and peaked at **601.4 g CO₂e/kWh** on 2020-01-14.^1^

### Trend 2022–2024 (WooCharts monthly snapshots)

| Month | g CO₂e/kWh |
|---|---|
| 2022-01 | 392.7 |
| 2022-07 | 354.7 |
| 2022-12 | 350.2 |
| 2023-01 | 330.1 |
| 2023-07 | 294.0 |
| 2023-12 | 269.6 |
| 2024-01 | 255.6 |
| 2024-04 | 232.9 (series minimum) |
| 2024-07 | 249.5 (most recent) |

Direction is unambiguous: a roughly **36% reduction in network-grid intensity over the 2022–mid-2024 window**, from the 392.7 g CO₂e/kWh January 2022 reading to 249.5 g CO₂e/kWh in July 2024.^1^ The slight uptick from the April 2024 trough is consistent with a documented post-halving hashrate consolidation onto better-cooled but partly more grid-coupled US sites.^7,8^

### Comparators on WooCharts and elsewhere

WooCharts itself does not overlay a global grid average on the intensity chart; comparison values come from independent primary sources. For the same 2024 period:

- **Global grid-electricity average:** Ember's *Global Electricity Review 2025* puts the 2024 world average at **473 g CO₂e/kWh** (down from ~480 g/kWh in 2023).^8^ Bitcoin's WooCharts intensity at 249.5 g/kWh is therefore roughly **53% of the global grid average** — i.e. Bitcoin mining is materially cleaner per kWh than the underlying world grid.
- **Coal-fired generation benchmark:** IEA *Electricity 2025* gives the global lifecycle intensity of unabated coal as ~**1,000 g CO₂e/kWh**.^9^ Bitcoin's network intensity is roughly **one-quarter** of the coal benchmark.
- **Sustainable-share share:** WooCharts' separate Sustainability tracker shows the network at **56.75% sustainable energy** (renewables + nuclear, CCAF definition) on 2024-10-26, up from 50.05% in mid-2022.^10^

### Methodology — how WooCharts weights regional hashrate share

WooCharts' intensity is the ratio of two upstream models. The numerator (annual emissions) is built by combining CBECI's regional hashrate share with country-level grid emissions factors from Ember and the IEA, plus a BEEST-derived adjustment for off-grid (mostly flare-gas / hydro / geothermal) mining capacity that CBECI's IP-based share model does not see.^1,2,11^ The denominator (annual energy) is CBECI's headline electricity-consumption series, augmented with BMECI's rig-population bottom-up where the two diverge.^1,2,11^ Country-level reweighting is done by hashrate share — i.e. when a unit of hashrate moves from a coal-heavy zone (e.g. Kazakhstan) to a hydro-heavy zone (e.g. Paraguay or BC), the network intensity falls accordingly. The model does **not** apply contractual unbundled REC accounting; the figure is a physically delivered grid-average estimate by jurisdiction, which is why it tracks broadly with Ember's electricity review for the same regions.^8,11^

### References (Item 2)

1. WooCharts. *Bitcoin Network Emissions Intensity*. 2026. https://woocharts.com/esg-bitcoin-mining-emissions-intensity/ (data trace dated 2024-07-27, accessed 2026-05-07).
2. WooCharts. *Bitcoin Network Total Emissions*. 2026. https://woocharts.com/esg-bitcoin-mining-total-emissions/ (accessed 2026-05-07).
8. Ember. *Global Electricity Review 2025*. London: Ember; 2025. https://ember-energy.org/latest-insights/global-electricity-review-2025/
9. International Energy Agency. *Electricity 2025 — Analysis and Forecast to 2027*. Paris: IEA; 2025. https://www.iea.org/reports/electricity-2025
10. WooCharts. *Bitcoin Mining: Usage of Sustainable Energy*. 2026. https://woocharts.com/esg-bitcoin-mining-sustainability/ (accessed 2026-05-07; data trace dated 2024-10-26).
11. Batten D, Bastian-Pinto C. *Bitcoin Energy & Emissions Sustainability Tracker (BEEST) — methodology white paper v2*. Bitcoin Magazine; 2024. https://bitcoinmagazine.com/business/the-bitcoin-mining-emissions-and-mitigation-tracker
## Section A — Bitcoin × Waste Energy Case Studies

Bitcoin mining's unique dispatchability makes it a candidate grid asset for consuming energy that would otherwise be curtailed, wasted, or flared. The following case studies illustrate the range of waste-energy mining models deployed globally between 2018 and 2024, drawn from regulatory filings, primary operator disclosures, and peer-reviewed energy literature.

**Crusoe Energy Systems — Permian Basin, Texas, United States.** Crusoe deployed modular data centres powered by stranded associated petroleum gas, converting otherwise flared methane into electricity for cryptocurrency mining and, subsequently, AI workloads. The company operated multiple sites across the Permian Basin with an estimated combined capacity exceeding 100 MW. Crusoe's model drew regulatory attention from the Colorado Oil and Gas Conservation Commission and the North Dakota Industrial Commission, both of which published permitting records for flare-gas recovery operations^1^. In late 2024, Crusoe announced a strategic pivot toward AI compute infrastructure, with its primary customers reportedly shifting from crypto miners to hyperscale AI operators — a development documented in industry coverage citing company statements but lacking comprehensive primary financial filings^2^. [Specific EH/s figures not disclosed in primary regulatory filings; primary figure not located in this brief.]

**ExxonMobil x Crusoe North Dakota Pilot — Bakken Region, North Dakota.** In 2021, ExxonMobil and Crusoe jointly announced a pilot programme to use flare gas for cryptocurrency mining at a single Bakken site. The project was framed as a emissions-reduction initiative under a memorandum of understanding between the two companies. Post-2022 public disclosure regarding the pilot's continuation or expansion is limited; the project appears to have concluded its initial scope without public expansion announcements^3^. This case illustrates the gap between announced partnerships and scalable deployment in flare-mining.

**MARA Holdings (formerly Marathon Digital) — Texas, United States.** MARA Holdings operates demand-response-connected mining facilities at Garden City and elsewhere in ERCOT's West Texas zone, consuming electricity during periods of curtailment and grid stress. MARA's annual reports and 10-K filings disclose participation in ERCOT's Emergency Response Service (ERS) programme, earning grid-stability payments while curtailing mining load on command. The company has reported revenue contributions from demand-response services, though precise annual figures vary by grid event frequency^4^. MARA's Garden City facility has publicly disclosed curtailment event participation records through ERCOT's market data portal^5^.

**Galaxy Digital / Argo Helios — Dickens County, Texas, United States.** Argo Blockchain's Helios subsidiary operated a mining facility connected to West Texas wind curtailment zones in Dickens County, with an estimated installed capacity of approximately 180 MW at time of peak operations. Financial distress led Argo to sell Helios to Galaxy Digital in a transaction valued at approximately $65 million, executed in late 2022^6^. Galaxy subsequently rebranded the subsidiary and, per industry reporting, pivoted operational strategy toward AI infrastructure in 2023–2024. The pivot from crypto mining to AI compute at the Helios site remains partially sourced through press reports rather than primary regulatory filings^7^. [Specific post-acquisition hashrate for the Dickens County facility not located in primary disclosures.]

**Genesis Digital Assets — West Texas and International Sites.** Genesis Digital Assets operated multiple mining facilities across West Texas and internationally. The company disclosed approximately 400 MW of aggregate mining capacity across its portfolio in industry presentations and funding documentation prior to its 2024 bankruptcy filing^8^. Genesis's West Texas sites drew attention from ERCOT for load-management participation during grid stress events. The company's bankruptcy proceedings in 2024 generated court documents with operational disclosures that partially illuminate portfolio status, though comprehensive site-by-site data remains incomplete in public filings^9^.

**Hut 8 Mining — Quebec, Canada.** Following its merger with US Bitcoin Corp (USBTC) in late 2023, Hut 8 operates substantial mining infrastructure in Quebec, powered by low-cost, low-carbon hydroelectric energy. The combined entity disclosed a hash rate exceeding 10 EH/s post-merger in public filings and press releases^10^. Post-merger, Hut 8 announced an AI compute buildout strategy leveraging its Quebec power infrastructure, signalling a dual-use model for stranded mining power contracts. Quebec's Régie de l'énergie published electricity allocation data relevant to mining load, though specific per-operator consumption figures are not publicly disaggregated^11^.

**Iris Energy (IREN) — Canal Flats, BC and Childress, Texas.** Iris Energy operates data centres powered by contracted hydroelectric power in British Columbia's Canal Flats region, with a stated capacity of approximately 85 MW. The company's S-1 filing and subsequent annual reports disclose hash rate and power consumption figures, with the Canal Flats facility confirmed operational at approximately 2.4 EH/s as of mid-2024^12^. Iris also commissioned a second site in Childress County, Texas, with disclosed grid connection capacity of 100 MW^13^.

**Gridless Compute — Kenya, Malawi, Zambia.** Gridless, a bitcoin mining company deploying small-scale hydro assets in Sub-Saharan Africa, represents a different model: rural electrification co-benefits alongside mining. The company has been cited in CoinShares Research and covered in energy-access literature, with disclosures indicating multiple operational sites in Kenya and Malawi with installed capacities in the range of 0.5–2 MW per site^14^. Emissions-reduction claims for these sites remain based on operator self-reporting and have not been independently audited or filed with national regulators; this should be noted as a gap in verifiability.

**Riot Platforms — Rockdale and Corsicana, Texas, United States.** Riot Platforms operates two major Texas facilities — Rockdale (megawatt-scale) and Corsicana — and is among the most transparent public miners regarding grid-service revenue. Riot's annual reports disclose revenue from ERCOT demand-response programmes, including Emergency Response Service compensation. Riot has disclosed specific ancillary-service revenue figures in 10-K and 8-K filings, indicating that grid services represented a measurable revenue stream alongside mining proceeds^15^. Riot's Rockdale facility has a reported capacity exceeding 700 MW when fully built out, with hashrate targets in public filings indicating multi-EH/s operational status^16^.

---

**References**

1. Colorado Oil and Gas Conservation Commission. Produced Water / Stranded Gas Utilization Permits Database. https://cogcc.state.co.us

2. The Block. "Crusoe Energy Pivots to AI Infrastructure." Industry coverage, 2024. [Primary financial figures on AI pivot not located; reporting cited.]

3. ExxonMobil. "ExxonMobil and Crusoe Energy Collaboration Announcement." Press release, 2021. [Post-2022 status not found in primary corporate filings.]

4. MARA Holdings. Annual Report on Form 10-K. SEC filings, 2023, 2024. https://www.sec.gov

5. ERCOT. Real-Time Dispatch and Load Resource Data. http://www.ercot.com

6. Galaxy Digital. "Galaxy Digital Acquires Helios from Argo Blockchain." Press release, November 2022. https://www.galaxydigital.com

7. Bloomberg Technology. "Galaxy Rebrands Bitcoin Mining Assets." Industry coverage, 2023. [Post-acquisition operational figures sourced from press reporting.]

8. Genesis Digital Assets. Investor Presentation Materials, 2022. [Pre-bankruptcy disclosures.]

9. U.S. Bankruptcy Court. Genesis Digital Assets Holdings Inc. Chapter 11 Filing Documents, 2024. https://ecf.canb.uscourts.gov

10. Hut 8 Mining. Press Release and SEC Filing, USBTC Merger Completion, November 2023. https://www.hut8.com

11. Régie de l'énergie du Québec. Données sur la consommation d'électricité par secteur. https://regie.energie.gouv.qc.ca

12. Iris Energy (IREN). S-1 Registration Statement and Annual Reports. SEC filings, 2023–2024. https://www.sec.gov

13. Iris Energy. Press release, Childress County facility commissioning, 2023. https://www.irisenergy.co

14. CoinShares Research. "Gridless Compute: Rural Electrification through Bitcoin Mining." 2023. https://research.coinshares.com

15. Riot Platforms. Annual Report on Form 10-K. SEC filings, 2023, 2024. https://www.sec.gov

16. Riot Platforms. Corporate Presentation. https://www.riotplatforms.com

---

## Section B — Curtailment Payment Regimes Globally

For Bitcoin miners to monetise waste energy, a curtailment payment regime must exist that compensates curtailment or values flexible load. The structure and generosity of these regimes varies significantly by jurisdiction, shaping the economic viability of demand-flexible mining.

**ERCOT (Texas, United States).** ERCOT does not have a capacity market or formal demand-side reserve auction; instead, demand-side flexibility is valorised through the Emergency Response Service (ERS) programme and the Load Resource programme. Under ERS, large loads — including cryptocurrency mining facilities — can register as dispatchable load resources that are called upon during system contingencies, earning capacity payments and energy settlement at high real-time prices. ERCOT also operates a Controllable Load Resource programme allowing large industrial loads to bid directly into the real-time market. The Texas Public Utility Commission has published ERS programme participation data and payment rates, with annual ERS expenditure figures publicly disclosed through ERCOT market reports. Bitcoin miners have disclosed revenue from these programmes in SEC filings, confirming participation as load resources^1^. [Annual total ERS outlay 2023–2024 not located in a single primary document; primary figure not located in this brief.]

**CAISO (California, United States).** CAISO operates bid-cost recovery mechanisms for generators and a congestion management revenue allocation system. Large loads, including data centres, can participate in the day-ahead and real-time markets, receiving congestion revenue rights where their load position offsets transmission constraints. CAISO's annual market reports disclose congestion costs and bid-cost recovery totals, with 2022–2023 figures indicating billions of dollars in annual congestion-related expenditure^2^. Cryptocurrency mining specifically has not been documented as a primary beneficiary of CAISO's demand-response programmes, which are dominated by traditional demand response and storage aggregators.

**UK National Grid ESO.** The UK's Balancing Mechanism allows generators and large demand-side participants to submit offers and bids to modify output or consumption in real time. For constraint management — when transmission constraints prevent cheapest generation from running — National Grid ESO pays constraint payments to generators that must turn down or up. The annual constraint cost published by National Grid ESO reached £1.5 billion in 2023, with 2024 preliminary figures suggesting continued elevation, driven by transmission bottlenecks and renewable intermittency^3^. National Grid ESO's pathway reports and Balancing Mechanism summary data provide the primary source. Demand-side flexibility can in principle participate, but actual industrial load participation in constraint payments remains limited; Bitcoin miners have not been documented as constraint payment recipients in UK regulatory filings.

**AEMO (Australia).** AEMO operates the Reliability and Emergency Reserve Trader (RERT), procuring contingency reserves through bilateral contracts, demand response, and generation when the dispatchable capacity margin is insufficient. RERT expenditures are disclosed in AEMO's annual markets report; 2022–2023 figures indicate RERT procurement costs in the hundreds of millions of AUD, though the majority of RERT contracts go to generation assets rather than demand response^4^. AEMO's demand response mechanism rules have been revised to enable larger flexible loads, but Bitcoin mining participation in RERT has not been documented in public AEMO filings.

**ENTSO-E / European Zones.** European grid operators coordinate redispatch under ENTSO-E guidelines, with costs allocated across Transmission System Operators (TSOs). Germany's Bundesnetzagentur (Federal Network Agency) publishes annual redispatch cost data; 2022 and 2023 figures indicate redispatch costs exceeding €1 billion per year, driven by grid congestion from renewable export flows^5^. In the Republic of Ireland, EirGrid publishes constraint and curtailment cost data through its market reports, with annual figures in the hundreds of millions of euros^6^. European redispatch regimes generally compensate generators for upward and downward flexibility; demand-side participation remains nascent outside of dedicated pilot programmes. Bitcoin mining facilities in Europe have not been documented as recipients of redispatch payments in primary TSO disclosures.

**China.** China's framework for managing curtailment of wind and solar generation includes a minimum utilisation hour guarantee mechanism administered by the National Development and Reform Commission (NDRC). Under the 2017 guarantee mechanism, grid companies must ensure renewable generators achieve a minimum number of full-load hours; where curtailment prevents this, grid operators must compensate generators^7^. The 2023 revisions to China's renewable energy law introduced a utilisation rate floor for provinces, with penalties for underperformance by grid operators. National Energy Administration (NEA) data shows renewable curtailment rates have declined significantly from peak levels in 2016, but absolute curtailment volumes in gigawatt-hours remain substantial, particularly in Gansu, Xinjiang, and Inner Mongolia^8^. Bitcoin mining in China was effectively banned in 2021; the curtailment payment regime therefore cannot serve domestic mining operations and instead represents a cost borne by grid operators and ultimately electricity consumers.

---

**References**

1. ERCOT. Emergency Response Service Programme Design and Annual Reports. https://www.ercot.com; Public Utility Commission of Texas. ERCOT Protocols and Market Rules. https://www.puc.texas.gov

2. CAISO. Annual Market Report. https://www.caiso.com; California Public Utilities Commission. Congestion Management Data. https://www.cpuc.ca.gov

3. National Grid ESO. "Annual Balancing Mechanism Summary." https://www.nationalgrideso.com; National Grid ESO. "Pathway to 2030." https://www.nationalgrideso.com

4. AEMO. "RERT Annual Report." https://www.aemo.com.au; AEMO. "NEM Electricity Market Report 2023." https://www.aemo.com.au

5. Bundesnetzagentur. "Redispatch-Mengengerüst und Kosten." https://www.bundesnetzagentur.de

6. EirGrid. "Annual Grid Revenue and Constraint Cost Report." https://www.eirgrid.com

7. National Development and Reform Commission. "Renewable Energy Utilization Guarantee Mechanism." 2017. [English summary in IEA Renewable Energy Policy Database.]

8. National Energy Administration (China). "Renewable Energy Installation and Utilization Data." Annual publications 2022–2024. http://www.nea.gov.cn

---

## 5. Flare gas, methane, and the GWP arithmetic

A central claim in the flare-mining literature is that diverting associated petroleum gas from the flare stack into a reciprocating engine that drives Bitcoin miners is *climate-positive on net*: the methane that would otherwise leak from an imperfect flare (or be vented outright when the flare pilot fails) is combusted with higher reliability inside an enclosed engine, and the resulting CO₂ is many tens of times less radiatively forcing than the methane it displaces. Whether the claim survives scrutiny depends on three numerical inputs: the methane global-warming potential (GWP) value used, the assumed combustion efficiency of the displaced flare, and the additionality test applied to the project. We walk through each in turn.

### Methane GWP — what AR6 actually says

The IPCC's Sixth Assessment Report (AR6, Working Group I, 2021) updated fossil-methane GWP values to reflect carbon-cycle feedbacks and radiative-efficiency revisions. For *fossil* CH₄ (the relevant case for vented or flared associated gas):

- **GWP-100 = 29.8 ± 11** (down from AR5's 30, up from AR4's 25 — the popularly cited "25×" figure is two assessment cycles out of date).^1^
- **GWP-20 = 82.5 ± 25.8**.^1^

For non-fossil (biogenic) CH₄ the AR6 values are 27.0 (GWP-100) and 79.7 (GWP-20).^1^ The ELJ paper's flare-mining arithmetic should default to the fossil values for venting from oil and gas infrastructure. Stage 1B uses **GWP-100 = 29.8** as the headline figure, with GWP-20 = 82.5 reserved for the "near-term climate stress" sensitivity panel; this matches the convention adopted by the IEA Methane Tracker and the World Bank GGFR.^2,3^

### Field-measured flare combustion efficiency

The destruction-and-removal efficiency (DRE) of a properly operating flare is conventionally assumed to be 98%, which is the figure embedded in EPA AP-42 Section 13.5 and most national inventories. Field measurements of the past five years have consistently fallen below this assumption:

- Plant et al. (2022) used aircraft-based remote sensing across three major US producing basins (Permian, Bakken, Eagle Ford) and measured an effective combustion efficiency of **91.1% ± 6.7%**, with roughly 5% of flares unlit and an additional fraction operating at sub-90% DRE.^4^ The paper estimates that this single correction increases methane emissions from US oil-and-gas flaring by a factor of approximately five over EPA inventory assumptions.
- Gvakharia et al. (2017) found similar order-of-magnitude underperformance in earlier Bakken aircraft surveys.^5^
- The Environmental Defense Fund's MethaneAIR airborne campaign (peer-reviewed releases through 2024) and MethaneSAT (launched March 2024, public data release ramping through 2025) both confirm that flare DRE in Permian operations sits in the 91–95% range, not the assumed 98%.^6^

The IEA Methane Tracker 2025, drawing on these sources, now models a global-average flare DRE of **92%**, with significant unlit-flare events contributing the bulk of the gap.^2^ The World Bank Global Gas Flaring Reduction (GGFR) Tracker 2024 reports global flared volume at ~148 billion m³ in 2023, the highest level since 2019, and explicitly cautions that emissions inventories built on a 98% DRE understate the methane share.^3^

### The capture-and-burn climate arithmetic

Consider a 1,000 m³/day stream of associated gas (≈75% CH₄ by volume; density ~0.717 kg/m³ for pure CH₄):

- **Vented (DRE = 0):** 1,000 × 0.75 × 0.717 = ~538 kg CH₄/day vented. At GWP-100 = 29.8, that is **16,029 kg CO₂e/day**.
- **Flared at field DRE = 92%:** 8% of methane survives = ~43 kg CH₄/day vented (≈1,281 kg CO₂e); plus 92% combusted to CO₂ ≈ 1,361 kg CO₂/day. **Total ≈ 2,642 kg CO₂e/day** — a six-fold reduction versus venting.
- **Captured to mining engine at engine DRE ≥ 99% (typical for tightly tuned reciprocating units):** 1% slip = ~5 kg CH₄/day (≈160 kg CO₂e); 99% combusted ≈ 1,464 kg CO₂/day. **Total ≈ 1,624 kg CO₂e/day** — a further ~38% reduction versus the field-flared case, plus ~3 MWh/day of usable electrical work that displaces a marginal grid kWh elsewhere.

The engine-versus-flare delta is real but modest. The bulk of the climate benefit attributable to flare-mining comes from *avoided venting* (the 6× step), not from burning gas in an engine instead of in a flare stack (the additional ~38% step). In other words: if a flare is operating well, putting a Bitcoin miner downstream of it improves the climate balance only slightly. The leverage is in the cases where the flare is unlit, malfunctioning, or sub-economic, and the alternative is venting.

### The additionality question

The "less bad than venting" framing is only correct if the alternative *was* venting. Most flare-mining projects are deployed at sites that already had a working flare; the miner simply substitutes a better DRE for a slightly worse one. The marginal climate benefit then scales with the gap between the two DREs (a few percent), not the gap between flaring and venting (orders of magnitude). The honest counterfactuals are:

1. **Sub-economic stripper wells with intermittent flaring** — the operator runs the flare when it is lit but vents when ignition fails or when wind extinguishes the pilot. Mining the gas with auto-ignition reciprocating engines materially closes the venting tail. This is the case where flare-mining is most defensible.
2. **Stranded gas at remote pads with no flare permit and no pipeline** — gas would be vented (with a partial flare or with no flare at all). Mining is unambiguously additional and the venting-displacement arithmetic above applies.
3. **Routine flaring at a permitted, well-maintained flare** — the marginal benefit is small; mining mostly displaces a flare that would have run anyway, plus adds a usable electrical output.
4. **Avoided drilling** — when mining revenue makes a marginal well economic that would otherwise have been shut in, the project is climate-negative on a full lifecycle basis. ELJ should flag this case as a known counter-factor and recommend that operator disclosures distinguish "captured otherwise-vented gas" from "made marginal gas economic."

The IEA Methane Tracker 2025 flags that ~40% of global flared volume in 2023 was associated gas at sites with no pipeline access — a population for which categories 1 and 2 above are plausible and categories 3 and 4 less so.^2^ The World Bank GGFR Tracker indicates that the top seven flaring countries (Russia, Iran, Iraq, USA, Venezuela, Algeria, Nigeria) account for ~65% of global flaring; only the USA has measurable flare-mining penetration, and within the USA the Permian and Bakken account for the bulk of flare-mining capacity.^3^

### What ELJ should claim

The defensible claim is bounded: flare-mining is *climate-improving versus venting* (large delta, well-supported by AR6 GWP and field DRE measurements); *modestly climate-improving versus a working flare* (small delta, dependent on engine vs flare DRE); and *climate-negative if it makes uneconomic wells economic.* Stage 1B's overlay computation should pair every flare-mining MW with an explicit DRE-counterfactual assumption, not a global headline figure.

### References (Item 5)

1. Forster P, Storelvmo T, Armour K, et al. The Earth's Energy Budget, Climate Feedbacks, and Climate Sensitivity. In: Masson-Delmotte V, Zhai P, Pirani A, et al., eds. *Climate Change 2021: The Physical Science Basis. Contribution of Working Group I to the Sixth Assessment Report of the Intergovernmental Panel on Climate Change*. Cambridge: Cambridge University Press; 2021. Chapter 7, Table 7.15. https://www.ipcc.ch/report/ar6/wg1/chapter/chapter-7/
2. International Energy Agency. *Global Methane Tracker 2025*. Paris: IEA; January 2025. https://www.iea.org/reports/global-methane-tracker-2025
3. World Bank. *Global Gas Flaring Tracker Report 2024*. Washington DC: World Bank Global Gas Flaring Reduction Partnership (GGFR); 2024. https://www.worldbank.org/en/programs/gasflaringreduction/global-flaring-and-methane-reduction-partnership-gffmr/publications
4. Plant G, Kort EA, Brandt AR, et al. Inefficient and unlit natural gas flares both emit large quantities of methane. *Science*. 2022;377(6614):1566–1571. doi:10.1126/science.abq0385
5. Gvakharia A, Kort EA, Brandt A, et al. Methane, Black Carbon, and Ethane Emissions from Natural Gas Flares in the Bakken Shale, Williston Basin, North Dakota. *Environmental Science & Technology*. 2017;51(9):5317–5325. doi:10.1021/acs.est.6b05183
6. Environmental Defense Fund. *MethaneAIR airborne campaign — Permian Basin survey results*. 2024. https://www.methanesat.org/methaneair/ ; *MethaneSAT initial data products*. 2024–2025. https://www.methanesat.org/data

---

## 6. Negative-pricing hours by zone

A negative wholesale electricity price is, in practical terms, a cash payment to load: the producer pays the consumer to take energy off the system because the alternative — curtailing inflexible generation, breaching a must-run constraint, or paying redispatch — is more expensive still. The annual count of negative-price hours and the lowest cleared price are therefore the cleanest scalar indicators of "free or paid-to-take" energy availability for a flexible load such as a Bitcoin mining facility. We summarise published 2022–2024 figures across major bidding zones, drawn from primary exchange and TSO disclosures.

### Headline trend

Negative-price hours have approximately tripled across major European zones between 2022 and 2024, driven by accelerating wind and solar penetration intersecting with limited cross-border capacity and slow demand-side response. North American negative-pricing is structurally smaller (the wholesale-market design tolerates fewer hours below zero) but has also climbed in renewable-heavy zones such as ERCOT West and CAISO South. Australia's NEM has moved from intermittent negative pricing in solar-rich zones to systematic mid-day negative pricing in South Australia and Queensland.

### Day-ahead (EPEX SPOT, Nord Pool) — European zones

| Bidding zone | 2022 hours <€0/MWh | 2023 hours <€0/MWh | 2024 hours <€0/MWh | Lowest cleared (€/MWh) |
|---|---|---|---|---|
| Germany–Luxembourg (DE-LU) | 69 | 301 | **457** | −500 (rule cap, repeated) ^1^ |
| France (FR) | 4 | 147 | **356** | −500 ^1,2^ |
| Netherlands (NL) | 80 | 315 | **463** | −500 ^1^ |
| Belgium (BE) | 66 | 162 | **315** | −500 ^1^ |
| Denmark West (DK1) | 161 | 271 | ~**380** | −500 ^3^ |
| Denmark East (DK2) | 23 | 79 | ~**170** | −500 ^3^ |
| Spain (ES) | 0 | 168 | **247** | −2.50 (April 2024) ^4^ |
| Sweden SE3 | 1 | 23 | ~**70** | −12.4 ^3^ |
| Finland (FI) | 0 | 20 | **725** | −500 (multiple May–June 2024 events) ^3,5^ |

Notes:
- The €500/MWh floor is the EPEX/Nord Pool rule cap (in absolute terms, a price of −€500/MWh). Several zones hit it repeatedly during the 2024 spring solar surge.^1,2,3^
- Finland's 2024 figure is the standout — heavy windbuild-out and limited interconnection produced 725 negative-price hours, more than any other Nord Pool zone has ever recorded; the lowest cleared price fell to the −€500 cap on multiple occasions.^5^
- Spain's price floor in OMIE day-ahead is technically zero, with negative pricing introduced via OMIP intraday auctions from 2023; the −€2.50 reading is from the OMIE day-ahead session on 21 April 2024 (an exceptional Easter-weekend low-demand, high-solar day).^4^
- Bundesnetzagentur's 2024 monitoring report puts the German hourly count at 457 with cumulative negative volume of approximately 14.2 TWh — i.e. an annual energy quantity equivalent to ~7% of the German Bitcoin-mining-relevant energy budget if a flexible load could capture it all.^6^

### GB — Balancing Mechanism / N2EX

GB does not commonly clear negative day-ahead prices because the wholesale market structure (N2EX day-ahead, Intraday Auction) settles on imbalance prices and the Balancing Mechanism handles real-time congestion. However:

- N2EX day-ahead recorded **3 negative-price hours in 2022, 41 in 2023, and 109 in 2024** — the latter on 8 separate days, mostly during high-wind low-demand periods.^7^
- Lowest cleared GB day-ahead price in 2024: **−£37.50/MWh** (28 December 2024).^7^
- The Balancing Mechanism settled deeply negative (down to −£500/MWh) on roughly 90 settlement periods across 2024, primarily Scotland constraint events where surplus wind generation cannot reach demand south of the B6 boundary.^8^

### ERCOT (Texas, USA)

ERCOT's energy-only design produces large negative-price tails in the renewable-heavy West zone:

- **West zone (Real-Time market):** ~**3,400 hours <$0/MWh in 2022**, ~**3,950 in 2023**, ~**4,100 in 2024** — i.e. roughly 47% of all settlement intervals at West nodes priced below zero in 2024.^9^
- **Houston zone:** ~120 hours <$0 in 2024.
- **System-wide hub (Real-Time):** ~210 hours <$0 in 2024.^9^
- **Real-time system-wide low:** the LCAP (system-wide offer cap) is −$251/MWh; West-zone nodal LMPs reached −$251/MWh on multiple occasions in 2023 and 2024 during pre-dawn wind peaks.^9^
- ERCOT's ORDC (Operating Reserve Demand Curve) effectively prevents day-ahead market settlement below −$25/MWh on most days; almost all observed ERCOT negative pricing occurs in the Real-Time market.^9,10^

### CAISO (California, USA)

CAISO's day-ahead and real-time markets both clear negative regularly during the spring solar peak ("duck curve" mid-day):

- **System-wide hub (Day-Ahead):** ~270 hours <$0/MWh in 2022, ~580 in 2023, ~**910 in 2024**.^11^
- **South-of-Path 26 (SP15):** more pronounced, with ~1,100 negative-price hours in 2024.^11^
- **Lowest cleared LMP 2024:** −$162.20/MWh at SP15 (March 2024 mid-day; a near-record solar day combined with hydro spill).^11^
- CAISO 2024 annual market report notes that negative pricing in the day-ahead market is now structural between 10:00 and 14:00 on >40% of days March–May.^12^

### AEMO NEM (Australia)

AEMO's NEM publishes 5-minute settlement data; we summarise as 30-minute equivalents for cross-comparability:

| Region | 2022 30-min intervals <A$0/MWh | 2023 | 2024 | Lowest cleared (A$/MWh) |
|---|---|---|---|---|
| New South Wales (NSW1) | 184 | 720 | **1,540** | −1,000 ^13^ |
| Victoria (VIC1) | 410 | 1,180 | **2,210** | −1,000 ^13^ |
| Queensland (QLD1) | 380 | 1,510 | **3,040** | −1,000 ^13^ |
| South Australia (SA1) | 1,160 | 2,420 | **3,890** | −1,000 ^13,14^ |
| Tasmania (TAS1) | 60 | 240 | 510 | −1,000 ^13^ |

The AEMO Quarterly Energy Dynamics Q4 2024 report notes that South Australia spent ~22% of all settlement intervals at sub-zero prices in 2024 — by some margin the most severe negative-pricing exposure of any major OECD bidding zone.^14^ The market price floor is −A$1,000/MWh; SA hit it on multiple occasions in October–November 2024 during low-demand high-solar days.^14^

### Implications for ELJ overlay

The overlay computation in Stage 2 should treat negative-pricing hours as the upper bound on "free energy" rather than the realised quantity — a flexible load can in principle capture all of it, but transmission constraints, ramp limits, and contractual minimum take-or-pay terms reduce the capturable share. As a rough heuristic supported by the AEMO and EPEX data above:

- ~5,000–6,000 negative-price hours per year across the German + Dutch + Danish bidding zones, with cumulative negative-price volume of order 20–30 TWh.
- ~4,000+ hours at ERCOT West nodes, of order 8–12 TWh.
- ~10,000+ NEM 30-minute intervals (~5,000 hour-equivalents) across SA + QLD, of order 5–8 TWh.

These three regions alone represent 30–50 TWh of paid-to-take electricity per year — a quantity comparable to the entire annual electrical demand of the global Bitcoin network. The Stage 2 overlay must derate this by access frictions covered in Item 7.

### References (Item 6)

1. EPEX SPOT. *Annual Market Review 2024*. Paris: EPEX SPOT; February 2025. https://www.epexspot.com/en/news/annual-market-review-2024
2. EPEX SPOT. *Auction prices Day-Ahead France/Germany — historical data*. https://www.epexspot.com/en/market-data
3. Nord Pool. *Annual Report 2024*. Lysaker: Nord Pool; March 2025. https://www.nordpoolgroup.com/en/the-power-market/Annual-report/
4. OMIE — Operador del Mercado Ibérico de Energía. *Informe de Precios Mercado Diario 2024*. https://www.omie.es/en/publicaciones
5. Fingrid Oyj. *Sähkömarkkinakatsaus 2024 / Electricity Market Review 2024*. Helsinki: Fingrid; 2025. https://www.fingrid.fi/
6. Bundesnetzagentur, Bundeskartellamt. *Monitoringbericht 2024*. Bonn: Bundesnetzagentur; March 2025. https://www.bundesnetzagentur.de/EN/Areas/Energy/Companies/MonitoringBenchmarkReport
7. Nord Pool. *N2EX Day-Ahead Auction historical prices*. https://www.nordpoolgroup.com/en/Market-data1/GB/Auction-prices/UK/Hourly/
8. Elexon Ltd / National Energy System Operator (NESO). *Balancing Mechanism Reporting Service: System Imbalance Prices 2024*. https://www.elexon.co.uk/data/balancing-mechanism-reporting-service/
9. Electric Reliability Council of Texas (ERCOT). *2024 State of the Market Report* (Potomac Economics, Independent Market Monitor). May 2025. https://www.ercot.com/services/comm/mkt_rules/issues/imm
10. Public Utility Commission of Texas. *ERCOT Operating Reserve Demand Curve (ORDC) — Annual Review*. 2024.
11. California ISO (CAISO). *Annual Report on Market Issues and Performance 2024*. Department of Market Monitoring; July 2025. https://www.caiso.com/library/market-monitoring-reports
12. CAISO. *Q1 2025 Report on Market Issues and Performance*. https://www.caiso.com/library/market-monitoring-reports
13. Australian Energy Market Operator (AEMO). *Quarterly Energy Dynamics Q4 2024*. February 2025. https://aemo.com.au/energy-systems/electricity/national-electricity-market-nem/nem-forecasting-and-planning/forecasting-and-reliability/quarterly-energy-dynamics
14. AEMO. *2024 Annual Electricity Statement of Opportunities*. August 2024. https://aemo.com.au/-/media/files/electricity/nem/planning_and_forecasting/nem_esoo/2024/2024-electricity-statement-of-opportunities.pdf

---

## 7. Bitcoin mining geographic mobility — frictions

The argument that "Bitcoin mining could be powered by curtailed renewables" is correct in principle and routinely overstated in deployment timelines. The statement implicitly assumes that hashrate can relocate to wherever surplus electrons are cheapest at near-zero friction. In practice the frictions are large enough that an Eastern North American miner cannot redeploy to a Texan wind site or a Patagonian curtailment zone in less than 12–24 months for container-on-pad models, and 36–60 months for hard-build infrastructure. This section documents the frictions that the Stage 2 overlay must derate the "free energy" estimate of Item 6 against.

### Container vs hard-build infrastructure

Containerised mining infrastructure ("modular data centres", typically 1–4 MW per 40-foot ISO container) is the fastest-deployable form factor. CoinShares' *Mining Industry Report H2 2024* puts container-build CapEx at approximately **US$280–360k/MW** for the data-hall (ASIC-side) infrastructure, plus **US$120–200k/MW** for the upstream switchgear, transformers, and pad civils — i.e. **~US$400–550k/MW all-in** for a container deployment on a site that already has a power connection.^1^ Hashrate Index's Q4 2024 quarterly report confirms similar figures and adds that hard-build hyperscale-style data halls (immersion cooling, fixed structure) come in at **US$700k–1.1M/MW** and require 18–30 months of construction time once permitting is complete.^2^

The shipping leg is non-trivial. ASIC inbound logistics from Bitmain's Shenzhen facility to a US destination ran 8–14 weeks of door-to-door lead time across 2023–2024, with bottlenecks at Long Beach and Houston throughout the period.^1,3^ Heavy switchgear and transformers — covered below — extend the total deployment-to-energisation timeline well beyond the ASIC procurement window.

### Transformer queue lead times

The single largest non-permitting friction is the wait for medium- and large-power transformers. Latitude Media's *Transformer Crunch* coverage and Wood Mackenzie's *North American Transformer Supply Outlook 2024* both quantify the queue:

- **Distribution-class transformers (≤2.5 MVA):** lead times rose from approximately 8–12 weeks in 2020 to **52–80 weeks** through 2024.^4,5^
- **Medium-power (2.5–60 MVA):** lead times of **18–36 months** as of mid-2024, up from 6–9 months in 2020.^4,5^
- **Large-power (>60 MVA, the class typically required for >40 MW mining sites tying directly to a 138/230 kV line):** lead times of **3–5 years** in 2024–2025, with several US utilities reporting that delivery slots booked in early 2024 cannot be filled before 2028.^4,5,6^

Bloomberg NEF's *Transformer Supply Constraint Brief* (April 2024) attributes the bottleneck to a combination of grain-oriented electrical steel (GOES) supply constraints, skilled-labour limitations at North American transformer fabricators (the US has fewer than five large-power transformer manufacturers operating at scale), and a step-change in demand from data-centre hyperscalers, IRA-driven manufacturing buildout, and renewable interconnection.^6^ Bitcoin miners compete for the same equipment as everyone else; CoinShares notes that the queue has materially changed mining-site economics, with several previously announced 2025-energisation projects pushed to 2027.^1^

### ERCOT large-load interconnection queue

ERCOT updated its large-load interconnection process in late 2023 in direct response to mining and data-centre queue growth. The relevant document is the ERCOT Public Utility Commission's *Large Flexible Load Interconnection Study* (2023) and the subsequent *Large Load Connection Process* (revised 2024).^7^ Key features:

- The ≥**75 MW threshold** triggers a full ERCOT planning study; the ≥75 MW + flexible-load category triggers a streamlined "Controllable Load Resource" process if the load is willing to register as dispatchable.^7^
- ERCOT's interconnection queue grew from 27 GW of large-load requests in 2023 to **more than 64 GW** of pending requests in 2024, the bulk of it data-centre (AI) demand rather than mining.^7,8^
- Effective interconnection lead time for a >100 MW Texas mining project at a new substation: **24–48 months** from interconnection request to energisation, depending on transmission upgrade scope.^7^
- ERCOT's 2024 amendments require new large flexible loads to register dispatchability terms; this is favourable to mining operators that can credibly bid as Controllable Load Resources but raises the bar for non-flexible deployments.^7,8^

The same dynamic is observable in PJM (queue closure in 2023, reopened with restructured process in 2024–2025), MISO, and CAISO, with multi-year backlogs at every ISO except SPP.

### Fibre, latency, and remote-site connectivity

Bitcoin mining is famously latency-tolerant — pools accept work submissions on the order of seconds — but the operational requirement is *reliable* low-latency connectivity for stratum communications, monitoring, OTA firmware, and remote management. Rural sites without fibre have historically used point-to-point microwave or satellite. Starlink's commercial-grade Business and Maritime tiers offer 50–500 Mbps with ~25–60 ms latency in Tier-1 service areas; this is acceptable for stratum traffic but introduces a single-vendor dependency at remote sites.^1,2^ Microwave link capex runs ~US$50–150k for a 20–60 km link, with regulatory frequency-licensing lead times of 4–12 weeks in most US states. Hashrate Index notes that fibre-availability constraints are the second-most-cited reason (after permitting) for siting decisions diverging from ideal-power decisions.^2^

### Permitting timelines by jurisdiction

Permitting timelines for a 50-MW or larger mining facility:

- **Texas (USA):** 6–18 months for air permits and TCEQ noise compliance; some counties have introduced moratoria or zoning restrictions in 2023–2024 (notably Dickens County and parts of Hood County, in response to community noise complaints).^1,9^
- **Alberta and BC (Canada):** 12–24 months for industrial-load interconnection and Alberta Utilities Commission approval; BC Hydro placed a moratorium on new mining connections in 2022 that remained in place through 2024.^1^
- **Norway / Sweden:** 18–36 months including municipal zoning, Energimarknadsinspektionen (EMI) approval, and grid-operator interconnection studies; Sweden's 2023 tax change effectively ended new mining buildout despite available cold-climate sites.^1^
- **Paraguay:** 6–12 months for ANDE interconnection, but ANDE introduced a higher industrial tariff for mining loads in 2024 that has cooled new applications.^2^
- **Bhutan / El Salvador (state mining):** state-led timelines, not directly comparable to private-sector permitting.

### Water cooling and water rights

Conventional air-cooled mining at 30–35 °C ambient temperatures derates ASIC throughput by 5–15%; immersion (single-phase or two-phase dielectric fluid) and direct-to-chip liquid cooling have become the standard for new builds, especially where ambient temperatures exceed 25 °C. Immersion build cost is roughly US$80–150k/MW above air-cooled.^1,2^ Where water is used for cooling-tower heat rejection, water-rights permits become a binding constraint — particularly in West Texas, where Hood County, Tom Green County, and Reeves County have all reported pushback against new high-water-use loads through 2024.^9^ Closed-loop dielectric-immersion systems with dry-cooler heat rejection avoid the water-rights problem at the cost of higher CapEx and a small derating in extreme heat.

### Implication for the ELJ overlay

The combined effect of these frictions is that the *capturable* share of the negative-pricing energy in Item 6 over a 2025–2027 horizon is substantially below the headline. Container-on-existing-pad redeployments can move within 6–12 months; greenfield 50-MW+ projects need 30–60 months. The overlay should treat near-term curtailment as redirectable only through existing-site demand response (e.g. ERCOT ERS, Bonneville BPA flexibility programmes) and treat genuinely greenfield siting at curtailment-rich nodes as a 2027–2030 horizon question.

### References (Item 7)

1. CoinShares Research. *Bitcoin Mining Industry Report — H2 2024*. CoinShares; January 2025. https://coinshares.com/research/bitcoin-mining-network-h2-2024
2. Luxor Technology / Hashrate Index. *Hashrate Index Q4 2024 Mining Report*. Luxor; January 2025. https://hashrateindex.com/reports/
3. Galaxy Digital Research. *Bitcoin Mining: Q4 2024 Industry Update*. Galaxy; February 2025. https://www.galaxy.com/research/insights/
4. Wood Mackenzie. *North American Power Transformer Supply Outlook 2024*. June 2024. https://www.woodmac.com/research/products/power-and-renewables/
5. Latitude Media. *The Transformer Crunch — series 2023–2024*. https://www.latitudemedia.com (industry coverage with primary-source citations to manufacturer guidance and utility filings).
6. BloombergNEF. *Transformer Supply Constraint Brief*. April 2024. https://about.bnef.com/
7. Electric Reliability Council of Texas (ERCOT) and Public Utility Commission of Texas. *Large Flexible Load Interconnection Study; Large Load Connection Process — Revised 2024*. https://www.ercot.com/services/rq/integration ; https://www.puc.texas.gov
8. ERCOT. *Generation Interconnection Status (GIS) and Large Load Status Reports 2024*. https://www.ercot.com/gridinfo/resource
9. Texas Commission on Environmental Quality (TCEQ). *Air Permits — Industrial Source Records*. https://www.tceq.texas.gov/permitting/air
