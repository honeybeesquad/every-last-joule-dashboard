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
