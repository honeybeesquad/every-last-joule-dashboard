# Every Last Joule: Bitcoin and the World's Wasted Energy

**Dr Simon Collins — da-ri.org**
*Draft v2 — 2026-05-09 — for voice pass before publication*

---

## §1 — THE WRONG SIDE OF THE METER

The world is building the clean energy infrastructure of the future at a pace that would have seemed unimaginable a decade ago. Solar and wind are now the cheapest sources of electricity ever built—cheaper than coal, cheaper than gas, cheaper in many places than existing nuclear or hydro. The energy transition is not a forecast anymore; it is a construction project underway on every inhabited continent. And every day, somewhere on that grid, a wind turbine is being told to stop.

The irony would be dark if it weren't so expensive. Grid operators across the world are paying generators to produce nothing. They order wind farms to feather their blades at the exact moment the wind is blowing hardest. They instruct solar arrays to idle at noon, when the sun is at its zenith. They watch hydroelectric reservoirs spill past their turbines—water that could turn a generator flowing over a dam wall—because there is no transmission line to carry the power to where it is needed. The energy exists. The electrons are there. There is simply no one to take them.

This is curtailment. It is not a rounding error, and it is not a temporary phase. It is a structural feature of the energy transition: clean energy is being built faster than the grids can absorb it, in locations the transmission infrastructure was never designed to serve. The wind blows hardest in places far from cities. The sun shines brightest on land that was cheap for a reason. The grid connects load centres to legacy power plants; it does not yet connect them to the best renewable resources. And until it does—a build-out that will take decades and trillions of dollars—curtailment will be the default outcome of any energy system that builds generation faster than it builds transmission.

The scale of this waste demands attention. The Every Last Joule project has assembled a dataset covering 384 regions across 195 countries, drawing on live transmission-system operator feeds, satellite data, and calibrated national statistics. The finding is stark: the world generates 338.8 terawatt-hours per year of verified wasted energy—energy that exists as electricity or its direct equivalent but reaches no customer. That is the entire annual electricity consumption of Argentina, delivered to no one. The foregone revenue attached to that energy is $16.2 billion per year. That is not a theoretical loss. That is money that renewable generators have already spent—on turbines, on panels, on debt service—and are not earning back, on electricity that exists but has no buyer.

This is the economic wound behind the energy transition's headline success story. The headlines celebrate record solar installations, falling LCOE curves, gigawatt-scale projects. They do not mention that many of those projects, in their first years of operation, spend a non-trivial fraction of their lives producing nothing because the market has no use for their output at that hour. The generators are on the right side of history—they are building the low-carbon future we need—but they are on the wrong side of the P&L.

The clean factual case for outrage is this: we are building expensive machines that capture free energy from the sun and wind, and then we are paying them to sit idle. We do this because the coordination problem between generation and transmission has not been solved. We do this because electricity markets were designed for a world of dispatchable baseload, not for a world where the cheapest power arrives in unpredictable surges. And we do this because no one has yet built the load that can absorb those surges.

But there is a buyer for this energy. An unusual one—mobile, interruptible, indifferent to geography, hungry for cheap electrons. It has been buying some of this wasted energy already, not by design, but by accident. Its name is Bitcoin.

## §2 — HOW WE MEASURED IT

The Every Last Joule project was built to answer a single question: how much energy is the world wasting, and where? The answer required 18 months of source-by-source assembly, pulling from live transmission-system operator API feeds across the planet's major power markets—ENTSO-E in Europe, ERCOT in Texas, CAISO and MISO in the United States, ONS in Brazil, OCCTO in Japan, AEMO in Australia—and supplementing those with verified satellite data from the World Bank's Global Gas Flaring Tracker for flare-associated waste, plus calibrated national statistics from IRENA, Ember, and China's National Energy Administration where live feeds were not available.^8,12^

The resulting dataset covers 384 regions across 195 countries with a consistent methodology. Every region is assigned to one of three confidence tiers. Tier 1 regions—164 of them—are live-sourced and independently verifiable: a zero value in the feed means a real zero, not a data gap. These are the electricity markets that publish hourly or sub-hourly curtailment data as a matter of operational practice, and they account for 184.5 TWh/yr of verified wasted renewable energy. Tier 2 regions add satellite-verified flare-gas waste: the eight World Bank-tracked flare regions that account for 154.2 TWh/yr of electrical-equivalent energy burned for nothing. Together, these T1 and T2 sources account for the headline number of 338.8 TWh/yr—every watt of which is documented, cross-checked, and auditable. Tier 3 provides modelled estimates for the remaining regions, at ±40% uncertainty, giving directional global coverage but not included in the verified total.

The dataset is not a static report. The live dashboard at everylastjoule.com renders the numbers in real time, updated continuously from market feeds. The full archive is deposited at Zenodo with DOI 10.5281/zenodo.20045637.^28,29^ This paper draws on that data. The methodology matters, but it is the instrument, not the subject. What matters is what the data reveals: a world awash in energy that no one is using.

## §3 — BITCOIN AS ACCIDENTAL ABSORBER

Bitcoin mining is, by market design, a buyer of last resort for electricity. Its economics are brutally simple: a miner will locate wherever the post-hashprice cost of electricity is lowest, and will relocate when a cheaper option appears. Miners are price-sensitive, mobile on timescales of months to years, and indifferent to location beyond power cost and internet connectivity. They do not care if the power comes from a baseload nuclear plant or a solar farm being curtailed at noon. They care about the price per kilowatt-hour. That single-minded focus on cheap electrons has, over the past decade, drawn mining operations toward the same places where curtailment is most severe.

This is not a coordinated strategy. It is not the result of any industry-wide plan to absorb surplus renewable energy. It is simply what happens when a mobile, price-sensitive industrial load drifts toward the cheapest electricity on the planet, and the cheapest electricity on the planet is increasingly the electricity no one else wants. When curtailment creates sustained periods of zero or negative wholesale prices at a location—as it does across the wind-rich regions of West Texas, the solar-baked plains of southern Spain, the hydro-abundant basins of Sichuan and Quebec—mining loads eventually show up.

The visible instances are now well-documented. MARA Holdings operates at Garden City in ERCOT, drawing power from wind-heavy West Texas when prices are low. Riot Platforms runs facilities at Rockdale and Corsicana, participating in ERCOT's Emergency Response Service to provide demand response while mining. Crusoe Energy built a business converting Permian Basin flare gas to compute—first Bitcoin, then AI—before their 2024 pivot. These are the flagship examples of a broader pattern: mining loads drawn to wasted energy by price signals that no other industrial customer finds attractive.

Now map the numbers onto this relationship. Verified curtailment from Tier 1 live sources alone totals 184.5 TWh/yr. Bitcoin's annual energy consumption, as tracked by the WooCharts ESG primary source, is 197.6 TWh/yr.^1^ That ratio—93.4%—means the world's verified curtailed renewables alone nearly equal Bitcoin's entire energy appetite. Add the eight verified gas-flare regions and the total rises to 338.8 TWh/yr—171.4% of Bitcoin's current consumption.^1,12^

The arithmetic is straightforward: there is more wasted energy than Bitcoin needs. Bitcoin could run entirely on energy that no one else wants. Not theoretically—arithmetically. The numbers are there. The energy exists. The generation assets are already built and paid for. The waste is happening right now, every hour of every day, in every major power market on earth.

But the current relationship is accidental. Mining drifts toward cheap power; cheap power sometimes includes curtailed renewables and sometimes does not. There is no mechanism to ensure that Bitcoin mining absorbs the curtailment rather than just the cheapest available electricity wherever that happens to be. The industry has stumbled into a partial solution to a problem it did not set out to solve. The question is whether it can build the intentional infrastructure to make the relationship permanent.

## §4 — BUYER OF FIRST RESORT

The central argument of this paper is that Bitcoin mining should be redesigned from the ground up as a buyer of first resort for curtailed energy—the load of choice for the hours when no one else wants the electricity. This is not a charity case for struggling renewable generators. It is the economically rational structure for an industry uniquely suited to the properties of curtailed power.

What makes Bitcoin mining uniquely suited to curtailment? The hardware is modular. A standard mining container delivers 1 to 10 megawatts of load capacity, deployable at existing grid connection points without the multi-year permitting timelines that accompany equivalent industrial loads. The load is technically interruptible within seconds—miners can power down in less than a single demand-response interval, making them the most flexible large loads that exist anywhere on the grid today. Mining has no geographic preference beyond power cost and internet connectivity: a container of ASICs is as happy in the Texas Panhandle as in rural Norway or the Chilean desert. And mining generates revenue 24 hours a day, 7 days a week, which makes it a natural counterparty for baseload sources of curtailment—hydro spill in the spring melt, flare gas from oil wells that produce around the clock—and for the structurally predictable midday solar surplus that defines the modern renewable grid.

What "buyer of first resort" looks like in practice is straightforward. Power purchase agreements written against curtailment-hour pricing: a wind farm and a mining operator agree that when the wholesale price at the interconnection node drops below a threshold—say, $10/MWh, or zero, or negative—the mining load will ramp up to absorb whatever the wind farm would otherwise be forced to discard. The mining load is designed to ramp down when grid demand is high and prices recover, freeing that capacity for other customers. The closest existing template is the ERCOT Emergency Response Service, where Riot Platforms' Rockdale facility targets over 700 megawatts of demand-response capacity, earning ancillary-service revenue from the grid operator alongside its mining proceeds.^15,20^ That model is not Bitcoin-specific; it is a general approach to flexible load, but Bitcoin mining is its most technically natural application.

Consider the generator's economics. A wind developer whose turbine is curtailed loses the difference between their contracted power price and zero. The $16.2 billion per year in foregone revenue we have documented represents real losses to real projects—projects that were financed on the assumption that the sun would shine and the wind would blow and the grid would take their power. When it does not, those projects bleed cash. Bitcoin mining as a captive buyer of curtailment-hour electricity converts that loss into a revenue stream. The analogy is Amazon building warehouses near airports: not because warehouses belong near airports in any romantic sense, but because logistics economics favour proximity to the thing you depend on. Mining near curtailment is the same logic applied to electrons.

The carbon case adds weight. If Bitcoin ran entirely on today's wasted energy—curtailed renewables at roughly zero grams of CO₂ equivalent per kilowatt-hour marginal intensity, and flare gas at roughly 40 grams per kilowatt-hour post-combustion versus roughly 740 if vented as methane on a GWP100 basis—the network's total emissions would fall from 49.3 million tonnes of CO₂ equivalent per year to 6.2 million.^2,3,13^ That is an 87.5 percent reduction. And Bitcoin's current network, at 249.5 grams of CO₂ equivalent per kilowatt-hour, is already 53 percent of the global grid average of 473.^1,8^ A curtailment-first network would be a fraction of that fraction.

This should not be oversold. "Could" is not "will." Geographic mobility timelines are 18 to 60 months for new builds in most regulatory environments. The infrastructure to connect a curtailment site with a mining load does not exist at scale outside of ERCOT and a handful of other markets. The coordination problem between generators, grid operators, and miners is real, and it is not solved by asserting that it should be solved.

But the physics is not the constraint. The energy is there. The generation assets are built. The waste is happening now. The missing piece is institutional—a mechanism to match the load to the curtailment, contract by contract, megawatt-hour by megawatt-hour. That is a coordination problem, and coordination problems can be solved.

## §5 — WHAT AI CHANGES

The landscape of global electricity demand is shifting under Bitcoin's feet, and the shift matters more than most mining executives yet acknowledge. AI data centres are the largest new electricity load in a generation, and their growth is accelerating. The International Energy Agency projects AI-related data centre electricity demand to reach 945 terawatt-hours by 2030—roughly the current electricity consumption of Japan.^9^ That demand is not hypothetical; it is being signed into existence today, through 20-year power purchase agreements for gigawatts of firm, reliable, low-carbon electricity. The hyperscalers—Microsoft, Google, Amazon, Meta—are willing to pay more than Bitcoin miners for the same electrons, and they need power that is available 99.99 percent of the time.

This creates a competitive displacement that is already visible in the market. Bitcoin mining cannot compete with AI for baseload renewable electricity. Not on price—hyperscalers routinely outbid miners for the same wind and solar PPAs. Not on reliability requirements—AI inference and training workloads need uninterrupted power at predictable latency, while mining can tolerate interruption with little economic penalty. And not on political economy—data centres bring high-paying jobs, tax revenue, and the promise of a knowledge economy, making them far easier for developers to sell to local officials and permitting authorities than containerised Bitcoin mining rigs.

The structural implication is clear: Bitcoin mining's position in the baseload energy market is weakening, and it will continue to weaken as AI demand grows. But that is not a problem for Bitcoin. It is an opportunity.

The reason is that curtailment is the one energy market that AI cannot easily play. AI workloads need reliable, predictable power with known availability. Curtailment is spiky, unpredictable in its timing, and geographically stranded—by definition, it occurs in places the transmission grid does not reach well enough to export the power. These are exactly the properties that make curtailment unattractive to hyperscalers, even at near-zero prices. They are also exactly the properties that Bitcoin mining can absorb without penalty.

As AI data centres occupy the baseload renewable PPAs that mining currently competes for, they will push mining toward the residual: the structurally cheap, intermittently available power that nobody with a reliability requirement wants. Curtailment is that residual. The competitive pressure from AI is not an existential threat to Bitcoin mining. It is a forcing function that pushes mining toward the structural niche it is best suited to fill.

There is a historical analogy worth making. Aluminium smelting built itself around excess hydroelectric power in Norway, Iceland, and the Pacific Northwest for exactly this reason: smelters needed cheap, abundant, interruptible power, and they went where the grid had more power than it could use. The Pacific Northwest's aluminium industry was built on the Columbia River's spring melt, when hydro plants ran at maximum capacity and the grid could not export enough to absorb the surplus. Bitcoin mining in curtailment markets is the same industrial logic, adapted to a digital commodity. The machinery is different; the economics are identical.

The synthesis is this: in a world where AI takes baseload, curtailment becomes Bitcoin's natural and defensible home. Not by accident, not by charity, but by structural fit. The mining industry that understands this and builds for it will survive and thrive. The industry that continues to chase baseload PPAs against hyperscaler competition will find itself increasingly priced out of its own market.

## §6 — WHAT NEEDS TO CHANGE

The energy is real. The arithmetic is sound. The industrial logic is coherent. What is missing is institutional infrastructure. Four changes would accelerate the connection between curtailed energy and flexible mining loads.

The first is standardised curtailment reporting. Europe's grid operators, through ENTSO-E's Transparency Platform, already publish hourly curtailment data by fuel type and cause code—the A75 dataset. No equivalent global standard exists. In most of the world, curtailment data is either unavailable, published on irregular schedules, or aggregated to the point of uselessness. A requirement—driven by the International Energy Agency and IRENA, who have the convening power to do so—that every grid operator above a reasonable size threshold publish hourly curtailment volumes, fuel type, and cause code would dramatically improve the signal available to load developers. Miners cannot build at a curtailment site they cannot identify.

The second is a curtailment-credit mechanism for flexible loads. The US Treasury's final rule on the Section 45V Clean Hydrogen Tax Credit, published in January 2025, established that an industrial load drawing on curtailed clean electricity can receive credit for the carbon intensity of those electrons on an hourly-matching basis.^21^ A comparable mechanism for Bitcoin mining loads—or a new specific mechanism—would change the investment calculus for operators considering curtailment-site builds. Texas Senate Bill 1929, enacted in 2023, provides an operational template at the state level: it requires the Public Utility Commission to study and potentially implement incentives for flexible loads that reduce curtailment.^22^ What is missing is a federal tax mechanism that makes the economics work for developers outside Texas.

The third is constructive use of MiCA's energy-disclosure framework. The European Union's Markets in Crypto-Assets Regulation, Article 66, requires EU-registered crypto-asset service providers to disclose energy consumption and fuel mix from 2024.^23^ The industry should treat this not as a compliance burden but as an opportunity. A credible, auditable record of curtailment-origin electricity share is exactly the documentation that ESG-motivated institutional investors need to allocate capital to mining operations with a demonstrable environmental benefit. Voluntary adoption of MiCA-compliant disclosure standards beyond the EU would accelerate the market signal and give investors the data they need to differentiate between mining on coal and mining on curtailed solar.

The fourth is an end to negative-price-hour opacity. Several major European transmission system operators do not publish the number of hours per year in which wholesale prices go negative at their interconnection nodes, nor the curtailment volumes in those hours. This information exists—the TSOs collect it operationally—but it is not made public in standardised form. Miners and developers must currently buy expensive private market-data subscriptions to identify curtailment-rich locations. A simple extension of ENTSO-E's publication obligations—a quarterly table of negative-price-hour counts and associated curtailment volumes by fuel type, published at each interconnection node—would substantially reduce the information asymmetry that currently requires private data subscriptions and slows investment.

These are not technological problems. They are coordination problems: between grid operators who do not publish what they know, between generators who do not know whom to call, between miners who cannot identify where to build. The energy is real, the numbers are verified, the industrial logic is sound. The gap is institutional, and institutions can change.

---

The data that underlies this analysis is open and accessible. The full dataset—curtailed and flared energy volumes across 384 regions—is archived at Zenodo under DOI 10.5281/zenodo.20045637, and the live dashboard at everylastjoule.com renders it in real time, updated continuously from market feeds. A forthcoming paper in *Scientific Data* will provide the formal data descriptor. For regional data extracts, curtailment-site assessments, or policy engagement, the author can be reached at simon@collins.nu.

---

## References

1. WooCharts. Bitcoin Network Emissions Intensity. 2026. https://woocharts.com/esg-bitcoin-mining-emissions-intensity/

2. WooCharts. Bitcoin Network Total Emissions. 2026. https://woocharts.com/esg-bitcoin-mining-total-emissions/

3. WooCharts. Bitcoin Network Emissions Mitigated. 2026. https://woocharts.com/esg-bitcoin-emissions-mitigated/

4. Cambridge Centre for Alternative Finance. Cambridge Bitcoin Electricity Consumption Index (CBECI) — methodology v1.3.0. 2025. https://ccaf.io/cbnsi/cbeci/methodology

8. Ember. Global Electricity Review 2025. London: Ember; 2025. https://ember-energy.org/latest-insights/global-electricity-review-2025/

9. International Energy Agency. Electricity 2025 — Analysis and Forecast to 2027. Paris: IEA; 2025. https://www.iea.org/reports/electricity-2025

11. Batten D, Bastian-Pinto C. Bitcoin Energy & Emissions Sustainability Tracker (BEEST) — methodology white paper v2. Bitcoin Magazine; 2024.

12. World Bank Group / GGFR. Global Gas Flaring Tracker Report 2024. Washington DC: World Bank; 2024.

13. IPCC. Climate Change 2021 — The Physical Science Basis. Chapter 7, Table 7.SM.7 (GWP100 fossil CH4 = 27.9). Cambridge: Cambridge University Press; 2021.

15. ERCOT. Settlement Point Price Historical Data. 2024. https://www.ercot.com/mktinfo/prices

20. ERCOT. Large Load Connection Process — revised 2024.

21. US Department of the Treasury, Internal Revenue Service. Section 45V Credit for Production of Clean Hydrogen — Final Regulations. Federal Register, 3 January 2025.

22. Texas Legislature. SB 1929, 88th Legislature (2023).

23. European Parliament and Council. Regulation (EU) 2023/1114 on Markets in Crypto-Assets (MiCA). Official Journal of the European Union, 9 June 2023.

28. Collins S et al. Every Last Joule — Global Curtailed and Flared Energy Dataset v1.2.1. Zenodo; 2026. https://doi.org/10.5281/zenodo.20045637

29. Collins S. Every Last Joule Dashboard. 2026. https://everylastjoule.com
