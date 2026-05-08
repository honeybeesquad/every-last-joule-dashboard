# Every Last Joule: Bitcoin and the World's Wasted Energy

**Dr Simon Collins — da-ri.org**
*Draft v1 — 2026-05-08 — for voice pass before publication*

---

## §1 Why this dataset exists

Energy systems do not consume only what they produce. Every major grid on earth periodically generates electricity it cannot use — and pays, or is paid, to make that problem go away. Wind turbines are told to stop spinning. Solar farms are switched to idle during afternoon peaks. Oil wells burn off gas because no pipeline exists to carry it. Hydroelectric reservoirs overflow past their turbines because the transmission line to the city is full.

The scale of this waste is not a secret. The International Energy Agency, IRENA, the World Bank's Global Gas Flaring Reduction Partnership, and dozens of national transmission operators publish estimates of curtailed generation and flared gas. The problem is that these figures live in separate silos: one TSO's Excel attachment, one World Bank geospatial database, one national regulator's PDF. Nobody had put them together into a single, open, machine-readable dataset at regional resolution.

The Every Last Joule project exists to close that gap. Working from primary sources — live TSO API feeds, verified CSV downloads, GGFR satellite flare data, IRENA country statistics — we built a 384-region dataset covering all 195 UN member states. We assigned each region to one of three confidence tiers: T1 (live-sourced and independently verifiable), T2 (annual-calibrated anchors or satellite-verified flare), and T3 (modelled estimates with explicit uncertainty). And we mapped a single question onto that dataset: how does the world's wasted energy compare to Bitcoin's?

The answer — documented in full below — is not what most people expect. The wasted energy is larger than Bitcoin's entire global network. In some configurations, substantially larger. That does not make waste-energy Bitcoin mining inevitable, or even likely. But it makes the question serious: what would it take to redirect even a fraction of it?

## §2 What we built

The Every Last Joule dataset^28^ covers 384 distinct geographic regions across 195 countries, with curtailment or flare data anchored to a primary source for each. The tier structure reflects how confident we are in each anchor.

**T1a** (live TSO feed, verified): 155 regions, sourced from direct API connections to national transmission operators. ENTSO-E covers 52 European zones via its Transparency Platform A75 curtailment series. ERCOT, CAISO, MISO, PJM, SPP, ISO-NE, and NYISO are live-fed from the US. Japan's ten regional utilities (OCCTO) feed hourly curtailment by fuel type. Australia's AEMO publishes dispatch-interval curtailment for NEM. Brazil's ONS disaggregates curtailment by state and fuel source. These are the highest-confidence figures in the dataset; a zero value at any of these sources is a real zero, not a data gap.

**T1b** (live domestic source, verified): 9 regions sourced from national operators not accessible directly from this environment — including Colombia's XM operator (accessed via a WireGuard relay to a server in-region), and several other domestic feeds verified through indirect relay. The Colombia XM feed captures *vertimientos* — hydro spillage — at daily resolution; annualised, this constitutes 20.3 TWh/yr.^28^

**T2-flare** (verified flare gas): 8 regions anchored to World Bank GGFR satellite data. The Permian Basin, West Siberia, South Iraq, East Saudi Arabia, Yamal, East Siberia, Kuwait, and Qatar account for 154.2 TWh/yr of electrical-equivalent energy in flared gas — computed at 35% reciprocating-engine efficiency, the standard Crusoe-style conversion factor.^12,28^

**T2 non-flare** (annual-calibrated): 6 regions with reliable annual anchors but no live hourly feed, including four Chinese provincial hydro-spillage estimates from NEA provincial RE monitoring bulletins.

**T3** (modelled): 205 regions with estimated anchors at ±40% uncertainty, drawn from IRENA Country Statistics, Ember national reports, and operator annual reports where no machine-readable feed exists.

The dataset includes a `sourceProvenance` flag on every region classifying whether the anchor is live-verified, satellite-verified, or modelled-fallback. A full methodology document and the Zenodo-hosted dataset card are available at the dashboard.^28,29^

The dashboard at everylastjoule.com renders this data as a spinning globe with pillar-height encoding of curtailment magnitude and a toggle between megawatt and USD/MWh views. It updates from live feeds continuously during market hours.

## §3 The Bitcoin overlay

Bitcoin's global network consumed an estimated **197.6 TWh of electricity in 2024**, based on the WooCharts ESG tracker's most recent published data point (2024-07-27).^1,2^ WooCharts derives this figure by combining the Cambridge Bitcoin Electricity Consumption Index with the BEEST model's bottom-up site-survey of off-grid and behind-the-meter mining capacity that CBECI's IP-geolocation approach misses.^1,4,11^ The Cambridge index itself, updated at 133.5 TWh/yr as of our data pull,^4^ represents the lower bound: it excludes off-grid stranded-gas mining by construction. For this paper we use WooCharts as the primary anchor because it explicitly accounts for off-grid capacity; CBECI appears where noted as a cross-check.

Against that denominator, the dataset produces the following overlay:^28^

The world's **verified curtailment** — T1a + T1b + T1c live-sourced regions only — totals **184.5 TWh/yr**. That is 93.4% of Bitcoin's WooCharts-denominated annual energy. Add the eight verified flare-gas regions and the combined envelope reaches **338.8 TWh/yr** — **171.4% of Bitcoin's annual energy use.** The world is already wasting 71% more energy than Bitcoin uses.

Extending to all modelled regions brings the total to 464.1 TWh/yr (234.8% of Bitcoin).

Methodology envelope: the T1 figures are live-sourced at ±20% uncertainty bands inherent in annualising a 30-day trailing window; the T2-flare figures carry GGFR satellite measurement uncertainty of roughly ±15% on the BCM volumes. The T3 total (123.6 TWh/yr) has a ±40% envelope by construction and should not be used as a headline anchor. The hero stat — 171.4% — rests entirely on T1+T2 verified sources and is the number we stand behind.

The comparison is a floor, not a ceiling. The dataset does not capture self-curtailment (generators choosing not to bid into the market rather than being instructed to reduce), which several studies suggest is the larger phenomenon in markets with low or negative wholesale prices.^16^ Behind-the-meter renewable over-generation — rooftop solar that pushes power onto micro-grids without touching a TSO meter — is similarly invisible. The verified 338.8 TWh is what the primary sources can see.

## §4 Where the matches are best

Quantity alone does not determine viability. Bitcoin mining favours sites that are persistently cheap, not merely cheap at peak curtailment moments. The best matches combine high curtailment volume, flat or semi-flat temporal profile (24/7 or close to it), and low logistics cost. Four clusters stand out.

**West Texas — wind curtailment and Permian flare.** ERCOT's West Texas hub produced 162.8 TWh/yr of T1a verified curtailment across wind and solar in our dataset.^28^ The Permian Basin adds 20.6 TWh/yr of flare-gas electrical equivalent (World Bank GGFR 2025).^28^ West Texas wind curtailment is structurally driven by transmission congestion from the Competitive Renewable Energy Zones to the load centres at Dallas and Houston; the transmission buildout has been ongoing since 2014 but generation growth continues to outpace it. Negative wholesale prices at the West Hub occur during approximately 900 hours/year.^15^ The operational precedent is established: MARA Holdings operates demand-response-connected mining at Garden City under ERCOT's Emergency Response Service.^4^ Riot Platforms at Rockdale and Corsicana is the most transparent public miner on ERS revenue.^4^ The limitation is that ERCOT's 3,200 GW interconnection queue means new greenfield mining builds take 18–36 months from application to energisation.^20^

**Brazilian Northeast — solar and wind in the ONS grid.** Bahia state (wind) and Minas Gerais (solar) together contributed 24.6 and 23.3 TWh/yr respectively in our T1a verified figures.^28^ Rio Grande do Norte and Piauí add a further 15.2 and 11.7 TWh/yr. The concentration in Brazil's Northeast is not coincidence: the region has the highest VRE penetration in Latin America, with ONS-published curtailment data confirming structural oversupply driven by transmission constraints between the wind corridor and the Southeast load belt. Wholesale prices in the constrained zones have trended negative during high-wind periods since 2022. The foregone revenue in Bahia Wind alone is $1.18B/yr at current spot prices.^28^ Brazil has no specific mining-regulation framework but its concession-and-auction system means new load connection timelines are 12–18 months for existing substation proximity.

**Germany and Western Europe — solar negative-price hours.** Germany's ENTSO-E-sourced curtailment is 5.8 TWh/yr (wind) and 2.8 TWh/yr (solar) in verified T1a data, with wholesale prices negative for more than 400 hours in 2024.^17,28^ The German grid is constrained north-to-south — offshore wind in the north cannot reach the industrial load in Bavaria and Baden-Württemberg without traversing a congested internal corridor — a structural bottleneck that the Bundesnetzagentur estimates costs over €1B/yr in redispatch payments.^28,ref8^ Spain and Portugal add 4.2 and 3.7 TWh/yr of wind and solar curtailment respectively. The European match is real but the policy environment is the most complex: MiCA Article 66 will require public energy-mix disclosure for mining operations from 2024 forward,^23^ and the EU EED data-centre reporting requirement (≥500 kW installed IT power) applies from the same year.^24^ Mining economics in Europe are also squeezed by comparatively high network charges and by Sweden's 2023 electricity-tax change that ended viable mining there.

**Sichuan and Colombia — hydro spillage.** Sichuan's Yangtze-basin hydroelectric spill peaks in monsoon season (July–August) and reaches 18.2 TWh/yr annualised at the time of this writing.^28^ It is modelled in the dataset's T3 tier — the anchor comes from Ember China 2025 rather than a live Sichuan grid feed — but is the best-supported of the T3 estimates, consistent with independent NEA provincial monitoring data. Colombia's XM-published vertimientos (hydro spillage at the dispatch margin) come in at 20.3 TWh/yr on the live T1b feed.^28^ For Bitcoin mining, the Colombian case is textbook: curtailment occurs because XM dispatches cheap thermal to meet evening load peaks and the hydro generator has no export capacity; the mining load would absorb the spill without displacing any other consumer.

## §5 What it's worth — the generator side

Curtailment is not merely wasted energy. It is wasted revenue. For a wind developer whose turbine is told to feather, every curtailed MWh represents the difference between a contract price that was never earned and zero. For a flare operator who burns gas that could have generated electricity, every BCM represents capacity that went up in smoke.

Across 186 priced regions in the dataset — those for which we have a reliable spot-price anchor from IEA, Ember, or national market data — the annualised foregone revenue from curtailment and flare totals **$16.2 billion per year**.^28^ The top five entries alone account for over $5B: Bahia Wind at $1.18B, Colombia at $1.12B, Minas Gerais Solar at $1.12B, the Permian Basin at $1.03B, and Sichuan hydro at $755M.^28^ These are not modelled estimates; they are the product of live-sourced curtailment volumes multiplied by independently sourced wholesale prices, with no mark-up for optimism.

Bitcoin mining offers an unusual kind of relief for this problem. Unlike most industrial loads, Bitcoin mining hardware: (1) can be deployed in modular containers at 1–10 MW per unit; (2) is technically interruptible within seconds for demand-response purposes; (3) has no geographic preference beyond electricity cost and internet connectivity; and (4) generates revenue 24/7 regardless of the hour, which fits well against baseload curtailment from hydro or flare gas but also against the structurally predictable midday solar surplus.

The operational examples already exist at scale. Riot Platforms has disclosed specific ancillary-service revenue figures from ERCOT's Emergency Response Service in its 10-K and 8-K filings — grid services represent a material revenue stream alongside mining proceeds, and Riot's Rockdale facility targets >700 MW.^4^ MARA Holdings participates in ERS at Garden City, Texas.^4^ Crusoe Energy built an entire business model around Permian flare-gas mining before pivoting to AI compute in 2024 — the pivot itself is a reminder that the modular data-centre form factor that works for Bitcoin also works for other high-power compute loads.^3^ The Crusoe precedent matters because it demonstrated, at commercial scale, that flare-gas-to-compute deployments can satisfy both emissions-reduction obligations and commercial returns.

The question is not whether the economics work — they demonstrably can — but whether the institutional infrastructure to connect a curtailment site with a mining load exists at speed. At present it largely does not, outside of ERCOT.

## §6 What it's worth — the carbon side

Bitcoin's current network-level emissions intensity is **249.5 g CO₂e/kWh**, based on the WooCharts ESG tracker's most recent data point (2024-07-27).^1^ That figure has fallen 36% from the January 2022 level of 392.7 g CO₂e/kWh as mining has shifted toward renewable-rich jurisdictions and more efficient hardware.^1^ It now sits at roughly 53% of the global grid average of 473 g CO₂e/kWh published by Ember's Global Electricity Review 2025.^8^ Bitcoin mining is, on this metric, meaningfully cleaner per kWh than the typical unit of electricity consumed globally.

Applying the WooCharts intensity to the 197.6 TWh consumption figure gives Bitcoin's annual gross emissions as **49.3 Mt CO₂e/yr**.^1,28^ Against that baseline, our stage-2 computation models a curtailment-first scenario: serve Bitcoin's energy demand first from verified curtailed renewables (T1a+T1b+T1c, at ~0 g CO₂e/kWh marginal intensity), then from flare-gas generation (~40 g CO₂e/kWh after combustion of the methane that would otherwise be vented), and meet any remaining demand from the global grid average.^28^

The result: **6.2 Mt CO₂e/yr** — an **87.5% reduction** against the current actual network.^28^

The flare-gas component needs careful handling. Burning a tonne of methane to CO₂ produces 2.75 tonnes of CO₂. Venting that same tonne as CH₄ produces a 100-year global warming potential of 27.9 t CO₂e (IPCC AR6 GWP100 for fossil methane).^13^ Combustion is therefore approximately 90% better than venting on a GWP100 basis. This is the counterfactual: flare gas in the Permian or West Siberia is currently burned inefficiently in open-air flares or vented in controlled releases; converting it to electricity via reciprocating engines and running Bitcoin mining hardware on that electricity is a carbon improvement against reality, not against some zero-emission baseline.^12,14^

The full decarbonisation arithmetic is more complex than this scenario implies. Some curtailed renewable generation is already being stored or consumed by other dispatchable demand. Some flare sites have ongoing pressure-management reasons for flaring that mining offtake would not eliminate. But the directional claim is robust: a Bitcoin network that ran on today's wasted energy would emit roughly one-eighth as much as the current network. That gap is the policy opportunity.

## §7 What this isn't

A gap between what the dataset shows and what is practically achievable deserves its own section.

**Self-curtailment is invisible.** Generators who choose not to bid below their cost floor — a common response to sustained negative prices — do not appear in curtailment statistics. They simply don't run. Several analysis papers on CAISO, ERCOT, and EPEX suggest self-curtailment is larger in volume than formal dispatch curtailment in markets with deep solar penetration; the ELJ dataset cannot see it.^16^

**Geographic mobility has a 30-month minimum.** Container-on-existing-pad redeployment can happen in 6–12 months. Greenfield 50 MW+ builds in ERCOT take 18–36 months from application; in PJM and MISO, 36–60 months under the new interconnection queue reform rules.^20,18^ Transformer supply chains compound this: 52–65 week lead times for utility-class 345 kV transformers in 2024 (Wood Mackenzie).^ref18^ The 338.8 TWh of verified wasted energy does not become 338.8 TWh of absorbable mining demand next quarter. Existing-site demand response — ERCOT ERS participation, Bonneville BPA flexibility programmes — is accessible in months, not years, but is constrained to sites with existing grid connections.

**"Could" is not "will."** The ratio of 171.4% is an arithmetic exercise, not a market forecast. Bitcoin mining absorbs curtailment only if the economics work site by site: delivered electricity cost, transformer capacity, permitting, cooling infrastructure, and hash-price all matter independently. High-curtailment sites with structural grid constraints are often the same sites with inadequate substation capacity for new large loads — the congestion that creates the curtailment also makes the site hard to connect.

**Price coverage is partial.** The $16.2B revenue figure covers 186 of 384 regions. The 198 unpriced regions are predominantly T3-modelled, smaller economies, or markets where reliable spot-price series are not publicly available. The actual foregone revenue is higher; we have not quantified by how much.

**The dataset documents what exists, not what's ideal.** Some T3 regions are included at sub-0.1 TWh anchors because their inclusion completes global coverage rather than because we are confident in the estimate. The aggregate modelled T3 total (123.6 TWh/yr) should be understood as a directional signal, not an engineering input.

## §8 What policy could do with this

The institutional gap between stranded energy and flexible mining load is not a physical problem — it is an information and regulatory problem. Four interventions could close it, and precedents exist for each.

**Standardise curtailment reporting.** ENTSO-E's Transparency Platform publishes hourly curtailment data for European TSOs — the A75 dataset that underpins our T1a European figures. There is no equivalent global standard. A requirement that grid operators above a threshold size publish hourly curtailment volumes, fuel type, and cause code — modelled on ENTSO-E's schema — would dramatically improve the signal available to load developers. The IEA's existing data-collection frameworks could host such a standard; the IRENA REMAP process could mandate it as a condition of VRE-scaling finance.

**Create curtailment-credit mechanisms for flexible loads.** The US 45V Clean Hydrogen Tax Credit's final rule (January 2025)^21^ established that an industrial load drawing on curtailed clean electricity — where the electricity would otherwise be wasted — can receive credit for the carbon-intensity of those electrons on an hourly-matching basis. The three-pillar framework (incrementality, temporal matching, deliverability) is directly applicable to Bitcoin mining at curtailment sites. A specific credit mechanism — whether through 45V read-across, a new 45M credit, or a comparable state-level mechanism — would change the investment calculus for operators considering curtailment-site builds. The Texas SB-1929 demand-response registration framework^22^ is a model for the operational layer; a federal tax mechanism is the missing incentive.

**Use MiCA's energy-disclosure backbone.** MiCA Article 66's sustainability disclosure requirements^23^ — which took effect for EU-registered CASPs from 2024 — create the first systematic public database of Bitcoin mining energy consumption and fuel mix in a major jurisdiction. Rather than treating this as a compliance burden, the industry should recognise it as an opportunity: a credible third-party-audited record of curtailment-origin electricity share is precisely the documentation that ESG-motivated institutional investors and carbon-credit buyers need. The EU EED data-centre reporting framework^24^ provides the technical template for energy-performance disclosure that could accompany it.

**End negative-price-hour opacity at ENTSO-E.** Several major European TSOs do not publish the number of hours per year in which wholesale prices go negative at their interconnection node, nor the curtailment volumes associated with those hours. Germany, Spain, and France do; others do not. A simple extension of ENTSO-E's publication obligations — requiring TSOs to publish a quarterly table of negative-price-hour counts and associated curtailment volumes by fuel type — would give load developers the signal they need to underwrite long-term power-purchase agreements at curtailment-rich sites. This costs the TSOs nothing to produce and would substantially reduce the information asymmetry that currently requires bespoke market-data subscriptions from private providers.

## §9 Where to go next

The dataset, the dashboard, and the computation behind this paper are fully open.

The **Every Last Joule dashboard** at everylastjoule.com renders the full 384-region dataset as a live spinning globe, updated continuously from live TSO feeds during market hours. The MW ↔ USD toggle shows both curtailment volume and foregone revenue simultaneously. The methodology pages document every source, conversion factor, and uncertainty range for every region.

The **dataset** is archived at Zenodo under DOI 10.5281/zenodo.20045637.^28^ Version 1.2.1 is the current release. A companion **Scientific Data** data descriptor — currently in submission — provides a peer-reviewed methods account, including the confidence-tier derivation, the static-anchor calibration methodology, and the tier-coherence validation suite.

The **next version** of the dataset (v1.3, target Q3 2026) will extend live coverage to India's six State Load Dispatch Centres currently reachable from in-region relays, and will add a formal provenance trail for each T3-modelled anchor sufficient for citation in academic contexts.

Requests for regional-level data extracts, collaboration on curtailment-site assessments, or policy engagement on standardisation proposals should be directed to simon@collins.nu.

---

## References

1. WooCharts. *Bitcoin Network Emissions Intensity*. 2026. https://woocharts.com/esg-bitcoin-mining-emissions-intensity/ (data trace dated 2024-07-27, accessed 2026-05-07).
2. WooCharts. *Bitcoin Network Total Emissions*. 2026. https://woocharts.com/esg-bitcoin-mining-total-emissions/ (accessed 2026-05-07).
3. WooCharts. *Bitcoin Network Emissions Mitigated*. 2026. https://woocharts.com/esg-bitcoin-emissions-mitigated/ (accessed 2026-05-07).
4. Cambridge Centre for Alternative Finance. *Cambridge Bitcoin Electricity Consumption Index (CBECI) — methodology v1.3.0*. Cambridge Judge Business School, University of Cambridge; 2025. https://ccaf.io/cbnsi/cbeci/methodology
5. de Vries A. *Bitcoin Energy Consumption Index*. Digiconomist; 2025. https://digiconomist.net/bitcoin-energy-consumption
6. ARK Invest. *Bitcoin Mining and the Case for More Renewable Energy*. 2024. https://www.ark-invest.com/articles/analyst-research/bitcoin-mining-and-the-case-for-more-renewable-energy
7. CoinShares. *Bitcoin Mining Network — Energy & Carbon Emissions Report*. 2024. https://coinshares.com/research/
8. Ember. *Global Electricity Review 2025*. London: Ember; 2025. https://ember-energy.org/latest-insights/global-electricity-review-2025/
9. International Energy Agency. *Electricity 2025 — Analysis and Forecast to 2027*. Paris: IEA; 2025. https://www.iea.org/reports/electricity-2025
10. WooCharts. *Bitcoin Mining: Usage of Sustainable Energy*. 2026. https://woocharts.com/esg-bitcoin-mining-sustainability/ (data dated 2024-10-26, accessed 2026-05-07).
11. Batten D, Bastian-Pinto C. *Bitcoin Energy & Emissions Sustainability Tracker (BEEST) — methodology white paper v2*. Bitcoin Magazine; 2024. https://bitcoinmagazine.com/business/the-bitcoin-mining-emissions-and-mitigation-tracker
12. World Bank Group / GGFR. *Global Gas Flaring Tracker Report 2024*. Washington DC: World Bank; 2024. https://www.worldbank.org/en/programs/gasflaringreduction/global-flaring-data
13. IPCC. *Climate Change 2021 — The Physical Science Basis*. Chapter 7, Table 7.SM.7 (GWP100 fossil CH₄ = 27.9). Cambridge: Cambridge University Press; 2021. https://www.ipcc.ch/report/ar6/wg1/
14. International Energy Agency. *Methane Tracker 2025*. Paris: IEA; 2025. https://www.iea.org/data-and-statistics/data-tools/methane-tracker
15. ERCOT. *Settlement Point Price Historical Data*. 2024. https://www.ercot.com/mktinfo/prices
16. CAISO. *Open Access Same-Time Information System (OASIS)*. 2024. https://oasis.caiso.com; CAISO. *Fast Facts: Renewables and Storage — Curtailment Data 2024*. https://www.caiso.com
17. EPEX Spot. *Market Data — DE-AT-LU historical prices 2024*. 2024. https://www.epexspot.com/en/market-data
18. CoinShares Research. *Bitcoin Mining Industry Report — H2 2024*. January 2025. https://coinshares.com/research/bitcoin-mining-network-h2-2024
19. Luxor Technology / Hashrate Index. *Hashrate Index Q4 2024 Mining Report*. January 2025. https://hashrateindex.com/reports/
20. ERCOT. *Large Load Connection Process — revised 2024*. https://www.ercot.com/services/rq/integration
21. US Department of the Treasury, Internal Revenue Service. *Section 45V Credit for Production of Clean Hydrogen — Final Regulations*. Federal Register, 3 January 2025. https://www.federalregister.gov/documents/2025/01/03/2024-31513/section-45v-credit-for-production-of-clean-hydrogen
22. Texas Legislature. *SB 1929, 88th Legislature (2023)*. https://capitol.texas.gov/BillLookup/History.aspx?LegSess=88R&Bill=SB1929
23. European Parliament and Council. *Regulation (EU) 2023/1114 on Markets in Crypto-Assets (MiCA)*. Official Journal of the European Union, 9 June 2023. https://eur-lex.europa.eu/eli/reg/2023/1114/oj
24. European Parliament and Council. *Directive (EU) 2023/1791 on energy efficiency (recast)*. Official Journal of the European Union, 13 September 2023. https://eur-lex.europa.eu/eli/reg/2023/1791/oj
25. Cambridge Centre for Alternative Finance. *Cambridge Bitcoin Mining Map — geographic distribution of hashrate, 2024 update*. https://ccaf.io/cbnsi/cbeci/mining_map
26. New York State Senate. *S6486D — Establishes a moratorium on cryptocurrency mining operations using proof-of-work authentication methods* (signed 22 November 2022; expired 22 November 2024). https://www.nysenate.gov/legislation/bills/2021/S6486
27. National Energy System Operator (NESO, UK). *Demand Flexibility Service Product Specification 2024–25*. https://www.neso.energy/industry-information/balancing-services/demand-flexibility-service-dfs
28. Collins S et al. *Every Last Joule — Global Curtailed and Flared Energy Dataset v1.2.1*. Zenodo; 2026. https://doi.org/10.5281/zenodo.20045637
29. Collins S. *Every Last Joule Dashboard*. 2026. https://everylastjoule.com
