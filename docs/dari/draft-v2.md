# Every Last Joule: Bitcoin and the World's Wasted Energy

**Dr Simon Collins — da-ri.org**
*Draft v2 — 2026-05-09 — for voice pass before publication*

---

## §1 — The wrong side of the meter

The world is building the clean energy infrastructure of the future at a pace that has few modern precedents. Solar and wind are now the cheapest sources of electricity ever built - cheaper than coal, cheaper than gas, cheaper in many places than existing nuclear or hydro. The energy transition is not a forecast anymore; it is a construction project underway on every inhabited continent. And every day, somewhere on that grid, a wind turbine is being told to stop.

The irony would be dark if it weren't so expensive. Grid operators across the world are paying generators to produce nothing. They order wind farms to feather their blades at the exact moment the wind is blowing hardest. They instruct solar arrays to idle at noon, when the sun is at its zenith. They watch hydroelectric reservoirs spill past their turbines - water that could turn a generator flowing over a dam wall - because there is no transmission line to carry the power to where it is needed. The energy exists. The electrons are there. There is simply no one to take them.

This is curtailment. It is not a rounding error, and it is not a temporary phase. It is a structural feature of the energy transition: clean energy is being built faster than the grids can absorb it, in locations the transmission infrastructure was never designed to serve. The wind blows hardest in places far from cities. The sun shines brightest on land that was cheap for a reason. The grid connects load centres to legacy power plants; it does not yet connect them to the best renewable resources. And until it does - a build-out that will take decades and trillions of dollars - curtailment will be the default outcome of any energy system that builds generation faster than it builds transmission.

The scale of this waste is not in dispute. The Every Last Joule project has assembled a dataset covering 384 regions across 195 countries, drawing on live transmission-system operator feeds, satellite data, and calibrated national statistics. The finding: the world generates 338.8 terawatt-hours per year of verified wasted energy - energy that exists as electricity or its direct equivalent but reaches no customer. That is the entire annual electricity consumption of Argentina, delivered to no one. The foregone revenue is $16.2 billion per year - money that renewable generators have already spent on turbines, panels, and debt service, and are not earning back.

This is the economic wound behind the energy transition's headline success story. The headlines celebrate record solar installations, falling LCOE curves, gigawatt-scale projects. They do not mention that many of those projects, in their first years of operation, spend a non-trivial fraction of their lives producing nothing because the market has no use for their output at that hour. The generators are on the right side of history - they are building the low-carbon future we need - but they are on the wrong side of the P&L.

There is a buyer for this energy. An unusual one - mobile, interruptible, indifferent to geography, hungry for cheap electrons. It has been buying some of this wasted energy already, not by design but by accident. Its name is Bitcoin.

## §2 — How we measured it

The Every Last Joule project was built to answer a single question: how much energy is the world wasting, and where? The answer required 18 months of source-by-source assembly, pulling from live transmission-system operator API feeds across the planet's major power markets - ENTSO-E in Europe, ERCOT in Texas, CAISO and MISO in the United States, ONS in Brazil, OCCTO in Japan, AEMO in Australia - and supplementing those with verified satellite data from the World Bank's Global Gas Flaring Tracker for flare-associated waste, plus calibrated national statistics from IRENA, Ember, and China's National Energy Administration where live feeds were not available.^1,2^

The resulting dataset covers 384 regions across 195 countries. Every region is assigned to one of three confidence tiers. Tier 1 regions - 164 of them - are live-sourced and independently verifiable: a zero value in the feed means a real zero, not a data gap. These are the electricity markets that publish hourly or sub-hourly curtailment data as a matter of operational practice, and they account for 184.5 TWh/yr of verified wasted renewable energy. Tier 2 regions add satellite-verified flare-gas waste: the eight World Bank-tracked flare regions that account for 154.2 TWh/yr of electrical-equivalent energy burned for nothing. Together, T1 and T2 sources account for the headline figure of 338.8 TWh/yr - every watt of which is documented, cross-checked, and auditable. Tier 3 provides modelled estimates for the remaining regions, at ±40% uncertainty, giving directional global coverage without being included in the verified total.

The 338.8 TWh is a floor, not a ceiling. It excludes self-curtailment - generators who choose not to bid into the market at all when prices fall below their cost floor - which several analyses of CAISO and ERCOT data suggest may exceed formal dispatch curtailment in volume. Behind-the-meter over-generation is similarly invisible. The verified number is what the primary sources can see. The live dashboard at everylastjoule.com renders the dataset in real time; the full archive is at Zenodo, DOI 10.5281/zenodo.20045637.^3,4^

## §3 — Bitcoin as accidental absorber

Bitcoin mining is, by market design, a buyer of last resort for electricity. Its economics are brutally simple: a miner will locate wherever the post-hashprice cost of electricity is lowest, and will relocate when a cheaper option appears. Miners are price-sensitive, mobile on timescales of months to years, and indifferent to location beyond power cost and internet connectivity. They do not care if the power comes from a baseload nuclear plant or a solar farm being curtailed at noon. They care about the price per kilowatt-hour. That single-minded focus on cheap electrons has, over the past decade, drawn mining operations toward the same places where curtailment is most severe.

This is not a coordinated strategy. It is not the result of any industry-wide plan to absorb surplus renewable energy. It is simply what happens when a mobile, price-sensitive industrial load drifts toward the cheapest electricity on the planet, and the cheapest electricity on the planet is increasingly the electricity no one else wants. When curtailment creates sustained periods of zero or negative wholesale prices at a location - as it does across the wind-rich regions of West Texas, the solar-baked plains of southern Spain, the hydro-abundant basins of Sichuan and Quebec - mining loads eventually show up.

The visible instances are now well-documented. MARA Holdings operates at Garden City in ERCOT, drawing power from wind-heavy West Texas when prices are low. Riot Platforms runs facilities at Rockdale and Corsicana, participating in ERCOT's Emergency Response Service to provide demand response while mining. Crusoe Energy built a business converting Permian Basin flare gas to compute - first Bitcoin, then AI - before their 2024 pivot to data centres. These are the flagship examples of a broader pattern: mining loads drawn to wasted energy by price signals that no other industrial customer finds attractive. None of these companies set out to solve the curtailment problem. They set out to find cheap power.

Verified curtailment from Tier 1 live sources alone totals 184.5 TWh/yr. Bitcoin's annual energy consumption, as tracked by the WooCharts ESG tracker, is 197.6 TWh/yr.^5^ That ratio - 93.4% - means the world's verified curtailed renewables alone nearly equal Bitcoin's entire energy appetite. Add the eight verified gas-flare regions and the total rises to 338.8 TWh/yr - 171.4% of Bitcoin's annual consumption.^5,2^ There is more wasted energy than Bitcoin needs. Bitcoin could, arithmetically, run entirely on energy that no one else wants.

The current relationship is accidental, however. Mining drifts toward cheap power; cheap power sometimes includes curtailed renewables and sometimes does not. There is no mechanism to ensure that Bitcoin mining absorbs the curtailment rather than just the cheapest available electricity wherever that happens to be. The industry has stumbled into a partial solution to a problem it did not set out to solve. The question is whether it can build the intentional infrastructure to make the relationship permanent.

## §4 — Buyer of first resort

Bitcoin mining should be redesigned from the ground up as a buyer of first resort for curtailed energy - the load of choice for the hours when no one else wants the electricity. This is not a charity case for struggling renewable generators. It is the economically rational structure for an industry uniquely suited to the properties of curtailed power.

The relevant properties are specific. Mining hardware is modular - a standard container delivers 1 to 10 megawatts of load capacity, deployable at existing grid connection points without the multi-year permitting timelines that accompany equivalent industrial loads. The load is technically interruptible within seconds, making miners the most flexible large loads on the grid. Mining has no geographic preference beyond power cost and internet connectivity: a container of ASICs is as happy in the Texas Panhandle as in rural Norway or the Chilean desert. And mining generates revenue continuously, which makes it a natural counterparty for baseload sources of curtailment - hydro spill in the spring melt, flare gas from oil wells producing around the clock - and for the structurally predictable midday solar surplus that characterises any grid with significant PV penetration.

In practice, a buyer-of-first-resort relationship means power purchase agreements written against curtailment-hour pricing: a wind farm and a mining operator agree that when the wholesale price at the interconnection node drops below a threshold - $10/MWh, or zero, or negative - the mining load ramps up to absorb whatever the wind farm would otherwise be forced to discard. The mining load ramps down when grid demand recovers, freeing that capacity for other customers. The closest existing template is the ERCOT Emergency Response Service, where Riot Platforms' Rockdale facility targets over 700 megawatts of demand-response capacity, earning ancillary-service revenue alongside mining proceeds.^6,7^ The infrastructure to generalise that model beyond ERCOT - which is a peculiar gap for an industry that has spent several years explaining its green credentials to sceptical journalists - does not yet exist at scale.

The generator economics are direct. A wind developer whose turbine is curtailed loses the difference between their contracted power price and zero. The $16.2 billion per year in foregone revenue we have documented represents real losses to real projects - projects financed on the assumption that the sun would shine, the wind would blow, and the grid would take their power. When it does not, those projects bleed cash. Bitcoin mining as a captive buyer of curtailment-hour electricity converts that loss into a revenue stream. The logic is the same as Amazon building warehouses near airports: not sentiment, but proximity economics applied to electrons.

Measured in carbon, the case is equally direct. If Bitcoin ran on today's wasted energy - curtailed renewables at roughly zero grams of CO₂ equivalent per kilowatt-hour at the margin, and flare gas at roughly 40 grams per kilowatt-hour post-combustion versus roughly 740 if vented as methane on a GWP100 basis - the network's total emissions would fall from 49.3 million tonnes of CO₂ equivalent per year to 6.2 million.^8,9,10^ An 87.5 percent reduction. Bitcoin's current network, at 249.5 grams of CO₂ equivalent per kilowatt-hour, already sits at 53 percent of the global grid average of 473.^5,1^ A curtailment-first network would be a fraction of that fraction.

As long as this is presented as an arithmetic exercise, the case holds. However, "could" is not "will." Geographic mobility timelines run from 18 months for container-on-existing-pad redeployment to 60 months for new greenfield builds in regulated interconnection queues. The coordination mechanism to connect a curtailment site with a mining load does not exist at scale, the incentive structures are not in place, and the data that would allow developers to identify viable sites is not publicly available in most markets. These are institutional gaps, not physical ones. The physics is settled. The energy is there.

## §5 — What AI changes

AI data centres are the largest new electricity load in decades, and they are already outbidding Bitcoin miners for the same electrons. The International Energy Agency projects AI-related data centre electricity demand to reach 945 terawatt-hours by 2030 - roughly the current annual electricity consumption of Japan.^11^ That demand is not hypothetical; it is being signed into existence today, through 20-year power purchase agreements for gigawatts of firm, reliable, low-carbon electricity. The hyperscalers - Microsoft, Google, Amazon, Meta - pay more than Bitcoin miners for the same electrons, and they require power that is available 99.99 percent of the time.

Bitcoin mining cannot compete with AI for baseload renewable electricity - not on price, not on reliability requirements, and not on political economy. Hyperscalers routinely outbid miners for the same wind and solar PPAs. AI inference and training workloads require uninterrupted power at predictable latency; mining tolerates interruption without material economic penalty. And data centres bring high-paying jobs, tax revenue, and the promise of a knowledge economy to local authorities in ways that containerised Bitcoin rigs do not. However, this concedes the wrong battlefield.

Curtailment is the one electricity market that AI cannot easily enter. AI workloads need reliable, predictable power with known availability - precisely the characteristics that curtailment lacks by definition. Curtailment is spiky, unpredictable in its timing, and geographically stranded in places the transmission grid does not reach well enough to export the power. These are the properties that make curtailment unattractive to hyperscalers even at near-zero prices. They are also exactly the properties that Bitcoin mining absorbs without penalty.

As AI data centres occupy the baseload renewable PPAs that mining currently competes for, they push mining toward the residual: structurally cheap, intermittently available power that nobody with a reliability requirement will touch. Curtailment is that residual. The competitive pressure from AI is not an existential threat to Bitcoin mining - it is a forcing function that pushes mining toward the structural niche it is best suited to fill.

Aluminium smelting followed the same logic. Smelters built themselves around excess hydroelectric power in Norway, Iceland, and the Pacific Northwest because they needed cheap, abundant, interruptible power and went where the grid had more than it could use. The Pacific Northwest's aluminium industry ran on the Columbia River's spring melt, when hydro plants operated at capacity and the grid could not export the surplus. Bitcoin mining in curtailment markets is the same industrial logic adapted to a digital commodity. The machinery is different; the economics are identical.

In a world where AI has taken the baseload, curtailment is Bitcoin's natural and defensible home. The mining industry that recognises this and builds accordingly will find itself with a structural cost advantage and a credible environmental case. The one that continues chasing baseload PPAs against hyperscaler competition will find itself paying full market rate for power that AI has already claimed - which is an uncompetitive position of its own making.

## §6 — What needs to change

The energy is real. The arithmetic is sound. The industrial logic is coherent. What is missing is institutional infrastructure. Four changes would accelerate the connection between curtailed energy and flexible mining loads.

The first is standardised curtailment reporting. Europe's grid operators, through ENTSO-E's Transparency Platform, already publish hourly curtailment data by fuel type and cause code - the A75 dataset. No equivalent global standard exists. In most of the world, curtailment data is either unavailable, published on irregular schedules, or aggregated to the point of uselessness. A requirement - driven by the IEA and IRENA, who have the convening power to enforce it - that every grid operator above a reasonable size threshold publish hourly curtailment volumes, fuel type, and cause code would dramatically improve the signal available to load developers. Miners cannot build at a curtailment site they cannot identify.

The second is a curtailment-credit mechanism for flexible loads. The US Treasury's final rule on the Section 45V Clean Hydrogen Tax Credit, published in January 2025, established that an industrial load drawing on curtailed clean electricity can receive credit for the carbon intensity of those electrons on an hourly-matching basis.^12^ A comparable mechanism for Bitcoin mining loads - or a new specific mechanism - would change the investment calculus for operators considering curtailment-site builds. Texas Senate Bill 1929, enacted in 2023, provides an operational template at the state level: it requires the Public Utility Commission to study incentives for flexible loads that reduce curtailment.^13^ The missing piece is a federal tax mechanism that makes the economics work for developers outside Texas.

The third is constructive use of MiCA's energy-disclosure framework. The EU's Markets in Crypto-Assets Regulation, Article 66, requires EU-registered crypto-asset service providers to disclose energy consumption and fuel mix from 2024.^14^ The industry should treat this not as compliance burden but as market signal: a credible, auditable record of curtailment-origin electricity share is exactly the documentation that ESG-motivated institutional investors need to differentiate mining on coal from mining on curtailed solar. Voluntary adoption beyond the EU would accelerate that signal considerably.

The fourth is an end to negative-price-hour opacity. Several major European transmission system operators do not publish the number of hours per year in which wholesale prices go negative at their interconnection nodes, nor the curtailment volumes in those hours. This information exists - TSOs collect it operationally - but it is not made public in standardised form. A simple extension of ENTSO-E's publication obligations - a quarterly table of negative-price-hour counts and associated curtailment volumes by fuel type, published at each interconnection node - would substantially reduce the information asymmetry that currently requires private market-data subscriptions and slows investment decisions.

These are not technological problems. They are coordination problems: between grid operators who do not publish what they know, between generators who do not know whom to call, and between miners who cannot identify where to build. The energy is verified, the industrial logic is sound, and the buyer exists. As such, the institutional gap between 338.8 terawatt-hours of wasted energy and the load that could absorb it is one of the more straightforwardly solvable problems in energy policy. The tools are available. The question is whether anyone will pick them up.

---

The data that underlies this analysis is open and accessible. The full dataset - curtailed and flared energy volumes across 384 regions - is archived at Zenodo under DOI 10.5281/zenodo.20045637, and the live dashboard at everylastjoule.com renders it in real time, updated continuously from market feeds. A forthcoming paper in *Scientific Data* will provide the formal data descriptor. For regional data extracts, curtailment-site assessments, or policy engagement, contact simon@collins.nu.

---

## References

1. Ember. *Global Electricity Review 2025*. London: Ember; 2025. https://ember-energy.org/latest-insights/global-electricity-review-2025/

2. World Bank Group / GGFR. *Global Gas Flaring Tracker Report 2024*. Washington DC: World Bank; 2024. https://www.worldbank.org/en/programs/gasflaringreduction/global-flaring-data

3. Collins S et al. *Every Last Joule — Global Curtailed and Flared Energy Dataset v1.2.1*. Zenodo; 2026. https://doi.org/10.5281/zenodo.20045637

4. Collins S. *Every Last Joule Dashboard*. 2026. https://everylastjoule.com

5. WooCharts. *Bitcoin Network Emissions Intensity*. 2026. https://woocharts.com/esg-bitcoin-mining-emissions-intensity/ (data trace dated 2024-07-27, accessed 2026-05-07).

6. ERCOT. *Settlement Point Price Historical Data*. 2024. https://www.ercot.com/mktinfo/prices

7. ERCOT. *Large Load Connection Process — revised 2024*. https://www.ercot.com/services/rq/integration

8. WooCharts. *Bitcoin Network Total Emissions*. 2026. https://woocharts.com/esg-bitcoin-mining-total-emissions/ (accessed 2026-05-07).

9. WooCharts. *Bitcoin Network Emissions Mitigated*. 2026. https://woocharts.com/esg-bitcoin-emissions-mitigated/ (accessed 2026-05-07).

10. IPCC. *Climate Change 2021 — The Physical Science Basis*. Chapter 7, Table 7.SM.7 (GWP100 fossil CH₄ = 27.9). Cambridge: Cambridge University Press; 2021. https://www.ipcc.ch/report/ar6/wg1/

11. International Energy Agency. *Electricity 2025 — Analysis and Forecast to 2027*. Paris: IEA; 2025. https://www.iea.org/reports/electricity-2025

12. US Department of the Treasury, Internal Revenue Service. *Section 45V Credit for Production of Clean Hydrogen — Final Regulations*. Federal Register, 3 January 2025. https://www.federalregister.gov/documents/2025/01/03/2024-31513/section-45v-credit-for-production-of-clean-hydrogen

13. Texas Legislature. *SB 1929, 88th Legislature (2023)*. https://capitol.texas.gov/BillLookup/History.aspx?LegSess=88R&Bill=SB1929

14. European Parliament and Council. *Regulation (EU) 2023/1114 on Markets in Crypto-Assets (MiCA)*. Official Journal of the European Union, 9 June 2023. https://eur-lex.europa.eu/eli/reg/2023/1114/oj
