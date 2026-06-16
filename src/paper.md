<nav class="page-back-nav"><a href="./">← Dashboard</a></nav>

<div class="methodology-doc">

<header class="methodology-header">

<div class="methodology-eyebrow">Every Last Joule · DARI Research Paper · May 2026</div>

# Every Last Joule: Bitcoin and the World's Wasted Energy

<p class="methodology-deck">The world discards 293.7 TWh/yr of verified wasted energy — 149% of Bitcoin's appetite. A systematic global accounting across 385 regions and 195 countries that reframes the dominant policy narrative on Bitcoin and electricity.</p>

**Author:** Dr Simon Collins · [da-ri.org](https://da-ri.org)

**Published:** 9 May 2026 · Draft — for review before publication

**Dataset:** [DOI 10.5281/zenodo.19835411](https://doi.org/10.5281/zenodo.19835411) · **Dashboard:** [everylastjoule.com](https://everylastjoule.com)

</header>

## §1 — The accusation and the counter-claim

Bitcoin's energy consumption draws more environmental scrutiny than almost any other technology. Academics, journalists, and regulators have argued — with varying degrees of alarm — that the network uses too much electricity, that this electricity should serve more productive purposes, and that the associated carbon emissions are unacceptable. This criticism has driven policy. New York imposed a two-year moratorium on new fossil-fuel mining operations in 2022. Sweden called for an EU-wide ban on proof-of-work mining the same year. The European Union's Markets in Crypto-Assets Regulation now mandates energy disclosure, with the implicit assumption that transparency will drive a political response.[^14] The narrative is entrenched: Bitcoin, in this telling, is a wasteful competitor for scarce clean electrons at precisely the moment the world needs to electrify everything.

The counter-argument also has a long history. Mining advocates, a smaller number of independent researchers, and operators such as Crusoe Energy have argued that Bitcoin is not a competitor for scarce electricity but a natural buyer for electricity that has no other customer. The logic is structural. Bitcoin mining hardware is modular — a standard shipping container holds one to ten megawatts of compute capacity. It is interruptible within seconds, faster than any other large industrial load. It has no geographic preference beyond the cheapest power and a functioning internet connection. And it generates revenue continuously, twenty-four hours a day, three hundred and sixty-five days a year. A miner can go where no other industrial customer can follow: to the wind farm whose turbines are idled by transmission congestion, to the hydro dam whose spillway is running, to the oil well whose associated gas is flared because no pipeline exists to deliver it to market.

The problem with the counter-argument has been the evidence. It has been made with anecdotes — a flare-mitigation operation in the Permian Basin, a hydro-spillage arrangement in Sichuan — not with systematic, global, primary-source accounting. Without a dataset that quantifies how much wasted energy actually exists, where it is concentrated, and how it compares to Bitcoin's own consumption, the argument remained an assertion, vulnerable to the retort that the anecdotes prove nothing about scale. And the data infrastructure to answer the question did not exist. The IEA — the world's most authoritative energy body — publishes curtailment figures for approximately a dozen countries, mostly behind a paywall. Ember, IRENA, the Energy Institute, and Our World in Data all track generation and capacity without a curtailment metric. GridStatus.io tracks curtailment in real time — for five US grid operators. No public dataset has attempted a global accounting. This paper provides that accounting. The finding: the world discards more energy than Bitcoin uses, in the exact form Bitcoin is accused of consuming too much of. The accusation of excess rests on a peculiar inversion of the actual waste problem.

![Two-column argument tree. Left column "The Policy Edifice" shows three policy actions (NY moratorium, EU MiCA disclosure, China ban) resting on three claims about Bitcoin's energy harm, which in turn rest on six foundational sources (Mora 2018 flagged CONTESTED with three rebuttals, de Vries 2018 flagged COMMENTARY, Cambridge CBECI flagged NOT PEER REVIEWED, Stoll 2019, Krause & Tolaymat 2018, Truby 2018 flagged DERIVATIVE) connected by thin grey edges. Right column "This Paper's Counter" shows the conclusion that Bitcoin can absorb 293.7 TWh per year of already-wasted electricity, supported by three derived claims, all resting on 158 cyan dots (live TSO feeds) plus 8 amber dots (satellite-verified flare basins) for 166 primary measurements across 385 regions, connected by thick cyan edges.](../docs/dari/charts/claim-cascade.svg)

> *Figure 1: Two evidence bases. The policy edifice (left) rests on six sources — a Joule commentary, a contested Nature Climate Change paper, a non-peer-reviewed institutional model, two bottom-up estimates, and a derivative review. The counter-claim (right) rests on 158 live TSO feeds and eight satellite-verified flare basins across 385 regions. Edge thickness encodes evidence weight. Source: ELJ v1.3.2.*

## §2 — How much energy the world wastes

The Every Last Joule project spent eighteen months assembling a dataset covering 385 regions across 195 countries. The methodology drew from three source tiers. Tier 1 — 158 regions — relies on live transmission-system operator API feeds, including ENTSO-E across Europe, ERCOT, CAISO, MISO, PJM, ISO-NE, NYISO, SPP, and BPA in the United States, Elexon BMRS in Great Britain, EirGrid in Ireland, ONS in Brazil, XM in Colombia, the Coordinador Eléctrico Nacional in Chile, OCCTO in Japan, and AEMO in Australia, among others.[^1] These sources publish hourly or sub-hourly curtailment data — volumes of renewable generation that grid operators deliberately reduced because transmission capacity or demand was insufficient to absorb them. The data is independently verifiable by anyone with an internet connection.

Tier 2 adds eight satellite-verified flare-gas basins — the T2-flare sub-bucket of the dataset — from the World Bank's Global Gas Flaring Reduction programme, calibrated against infrared satellite measurements of flare volumes and converted to electrical equivalents using standard heat-rate assumptions.[^2] A small additional Tier 2 bucket holds six annual-calibrated non-flare regions (Austria's APG zone, Russia's Murmansk wind, and four Chinese provincial hydro systems), excluded from the headline totals reported below. Tier 3 provides model-based estimates at ±40% uncertainty for global directional coverage, drawn from calibrated national statistics from IRENA, Ember, and China's National Energy Administration.[^1] The headline finding rests entirely on Tier 1 live feeds and the eight T2-flare basins — verified sources that can be audited.

No public dataset has attempted a global accounting of this kind. The resulting database is approximately thirty times broader in geographic scope than the IEA's curtailment tracking, the most authoritative existing source. Forty-one percent of its regions are backed by live grid-operator feeds refreshed every three hours; every region carries a published uncertainty envelope and a source citation traceable to a specific grid operator or regulator. The numbers are a conservative lower bound: self-curtailment by asset owners — generators who throttle output privately during negative-price hours without reporting it to the system operator — is excluded entirely, and multiple analyses of CAISO and European markets suggest it may equal or exceed formal dispatch curtailment in volume.

The number: 293.7 terawatt-hours per year of verified wasted energy — electricity or its direct electrical equivalent that reaches no paying customer.[^3] That is larger than the annual electricity consumption of Argentina. The foregone revenue, calculated across 118 verified regions with available wholesale price data, is $14.3 billion per year.[^3] The full dataset is archived at Zenodo (DOI 10.5281/zenodo.19835411) and rendered interactively at everylastjoule.com.[^3] [^4]

> *Figure 2: Every Last Joule interactive dashboard — 385 regions, 195 countries. Live TSO data updated continuously. Circles represent annual curtailment volume; amber = flare gas, cyan = curtailed renewable generation. See [everylastjoule.com](https://everylastjoule.com) for the full interactive dashboard.*

## §3 — The absurdity, stated plainly

Bitcoin's annual electricity consumption, as tracked by the WooCharts ESG tracker — the most comprehensive source, combining the Cambridge Bitcoin Electricity Consumption Index's IP-geolocation methodology with bottom-up site survey data for off-grid and behind-the-meter capacity — is 197.6 TWh per year.[^5]

The world's verified wasted energy — live transmission-system-operator curtailment data combined with satellite-verified flare-gas basins — totals 293.7 TWh per year.[^3] That is 149% of Bitcoin's annual consumption. The world discards nearly half again as much electricity-or-direct-electrical-equivalent as Bitcoin uses, from sources that have no other buyer. These are not hypothetical surpluses or modelled projections. They are measured, recorded, grid-operator-curtailed and satellite-quantified quantities.

The verified total is dominated by flare gas. Of the 293.7 TWh, 154.8 TWh (53%) is natural gas burned at oil wellheads because no pipeline exists to capture it — concentrated across the Persian Gulf, Western Siberia, and the Permian Basin. The remaining 138.9 TWh (47%) is curtailed renewable electricity — wind turbines and solar panels that grid operators deliberately reduced to zero because transmission capacity or demand could not absorb them. Verified curtailed renewables alone, without invoking any flare-gas data, total 70% of Bitcoin's annual consumption from electrons that heat nothing, power nothing, and reach no customer.

**Where the waste is.** The 293.7 TWh is geographically concentrated. Four countries — Iraq, Brazil, Russia, and Colombia — account for 71% of the verified total. Adding the United States' Permian Basin brings the figure to 78%. The remaining ~250 regions in the dataset contribute the other 22% in long-tail aggregate. This is not a dilution of the finding; it is its sharpest form. The waste sits where one would expect — at oil-and-gas concentration in the Gulf and Russia, at transmission-constrained renewable buildouts in Brazil and Colombia, at the Permian flare complex in West Texas. A customer for that wasted energy would deploy where it is, not where it isn't, which is precisely what Bitcoin mining's modularity allows.

**Key figures:**

| Measure | Value |
|---|---|
| Verified wasted energy (T1 + T2-flare) | 293.7 TWh/yr |
| — of which flared gas (T2-flare basins) | 154.8 TWh/yr (53%) |
| — of which curtailed renewables (T1 live TSO) | 138.9 TWh/yr (47%) |
| Bitcoin network consumption (WooCharts) | 197.6 TWh/yr |
| Wasted energy as % of Bitcoin's appetite | 149% |
| Curtailed renewables as % of Bitcoin | 70% |
| Verified foregone revenue | $14.3 billion/yr |
| Top 4 countries' share of verified waste | 71% |

> *Chart note: A comparison chart of wasted energy categories versus Bitcoin network consumption is available in the full interactive version at [everylastjoule.com](https://everylastjoule.com). Sources: ELJ dataset v1.3.1 (T1 curtailment = live TSO data; T2 = satellite-verified flare gas); WooCharts ESG tracker (Bitcoin). T3 modelled estimates excluded from wasted totals.*

The narrative that Bitcoin's energy use represents a net addition to global electricity demand is hard to sustain against this accounting. The electricity Bitcoin uses exists in the system regardless of whether Bitcoin mines it or not. The question is whether it reaches a customer or a drain. Those 138.9 TWh of curtailed renewables, plus the 154.8 TWh of flared gas, are lost entirely. They heat nothing, power nothing, charge nothing. They are subtracted from the global energy system as a pure deadweight loss. If Bitcoin absorbed a fraction of that waste, net global electricity consumption would be unchanged; the electrons would simply be redirected from a resistor bank or a flare stack to a mining rig. The accusation of excess rests on ignoring the curtailment.

This does not mean Bitcoin is currently running on wasted energy. In aggregate, it mostly is not. The WooCharts composite intensity — 249.5 grams of CO₂ equivalent per kilowatt-hour — implies a mix dominated by conventional grid power, with small pockets of renewables and flare mitigation.[^5] The point is that the resource is there, at a scale that exceeds Bitcoin's entire appetite, and that the dominant policy narrative has proceeded as if it were not. Again: 293.7 TWh is a verified floor. Actual global waste is higher. The case does not require the modelled Tier 3 estimates. The verified numbers alone make it.

## §4 — Could Bitcoin actually be the customer?

The question moves from arithmetic to economics. Wasted energy exists at the right scale. Can Bitcoin mining be a commercially viable buyer for it?

The answer is yes, with conditions. The conditions are about pricing and institutions, not physics or engineering.

Bitcoin mining has a set of structural properties that no other large industrial load matches. The hardware is modular, rated at one to ten megawatts per standard shipping container, deployable at existing grid connection points without new transmission infrastructure. The load is interruptible within seconds — faster than demand response programmes assume possible — because miners convert electricity to heat and computation, not to chemical or mechanical processes that require thermal inertia or rotational stability. Mining has no geographic preference beyond power cost and internet connectivity, which means it can locate at transmission-constrained nodes where curtailment concentrates. And it generates revenue continuously, twenty-four hours a day, which suits both baseload curtailment — hydro spill, flare gas — and predictable midday solar surplus equally well.

The pricing condition is straightforward. Bitcoin mining at a curtailment site is economically viable when the effective electricity price reflects the zero-opportunity-cost of power that would otherwise be wasted. In markets where curtailment creates sustained negative or near-zero wholesale prices — ERCOT's West Texas hub, Germany's north-south transmission corridor, Brazil's Northeast wind corridor — the economics already work.[^6] In markets where curtailment is real but pricing mechanisms do not pass the discount through to potential buyers, the economics stall. A wind farm in Finland may be curtailed thirty percent of winter hours, but if the market design settles at the zonal rather than nodal price, the curtailment signal is invisible to a potential mining load. The price the miner would pay remains the daytime market price, not the negative price that reflects actual system conditions. This is not a physics problem. It is a market design problem — which is, in its way, a more tractable one.

The operational precedents exist at commercial scale. MARA Holdings operates at Garden City in ERCOT, where curtailment is structural. Riot Platforms at Rockdale and Corsicana has registered over 700 megawatts of demand-response capacity with ERCOT, capable of shedding load within seconds when grid conditions require it.[^7] Crusoe Energy's Permian Basin flare-to-compute operations, before their 2024 pivot toward AI inference workloads, demonstrated that modular gas-to-compute units could be deployed at single-well sites with no other electricity buyer within fifty kilometres. These are commercial operations that illustrate the viability of the model. What they do not demonstrate is deployment at a scale proportionate to the opportunity — which, given that the opportunity has been publicly quantified for the first time in this paper, is perhaps understandable as a chicken-and-egg problem, though less understandable for an industry that has been asserting its stranded-energy credentials for the better part of a decade without measuring them.

> *Figure 3: Top curtailment and flare-gas sites (circles sized by annual TWh) with known commercial mining operations. Data: ELJ dataset v1.3.1. See the interactive map at [everylastjoule.com](https://everylastjoule.com).*

The $14.3 billion per year in foregone revenue we have documented represents real losses — projects financed on the assumption that the grid would take their power, then curtailed by transmission constraints or market design failures.[^3] A wind developer whose turbine is curtailed loses the difference between their contracted price and zero. Bitcoin mining as a captive buyer at curtailment-hour pricing converts that loss into a revenue stream. The top five verified wasted-energy hotspots alone tell that story plainly — Southern Iraq's Basra, Rumaila, and Majnoon flare basins at $2.21 billion per year in foregone revenue, Western Siberia's Khanty-Mansi and Yamal flare fields at $1.61 billion, Colombia's hydro-heavy national system at $1.25 billion, the Permian Basin flare complex at $1.03 billion, and Brazil's Bahia wind corridor at $861 million — represent nearly $7.0 billion per year in revenue that generators are currently losing and miners are not capturing. Three of the top five are flare basins; their entire output is wasted by definition, the gas burned at the wellhead because no pipeline exists to deliver it to a buyer.[^3]

**Top 5 verified hotspots, by fuel:**

*Flare gas (T2-flare basins):*

| Site | TWh/yr | Revenue/yr |
|---|---:|---:|
| Southern Iraq (Basra/Rumaila/Majnoon) | 63.0 | $2,205M |
| Western Siberia (Khanty-Mansi/Yamal AO) | 42.4 | $1,611M |
| Permian Basin (USA) | 20.6 | $1,030M |
| Yamal (Russia) | 10.0 | $380M |
| Eastern Siberia (Russia) | 9.0 | $342M |

*Wind (T1a — live TSO):*

| Site | TWh/yr | Revenue/yr |
|---|---:|---:|
| Bahia Wind (Brazil) | 17.9 | $861M |
| Germany Wind | 5.6 | $541M |
| Rio Grande do Norte Wind (Brazil) | 10.4 | $500M |
| MISO Midwest Wind (USA) | 8.7 | $488M |
| Piauí Wind (Brazil) | 4.9 | $234M |

*Solar (T1a — live TSO):*

| Site | TWh/yr | Revenue/yr |
|---|---:|---:|
| Minas Gerais Solar (Brazil) | 9.3 | $447M |
| Spain Solar | 3.7 | $303M |
| Germany Solar | 2.8 | $269M |
| Bahia Solar (Brazil) | 5.2 | $250M |
| Rio Grande do Norte Solar (Brazil) | 1.9 | $90M |

*Hydro (T1a + T1b):*

| Site | TWh/yr | Revenue/yr |
|---|---:|---:|
| Colombia (system-wide vertimientos, T1b) | 22.7 | $1,250M |
| Norway NO2 Hydro (Kristiansand) | 2.9 | $166M |
| Norway NO4 Hydro (Tromsø) | 1.0 | $55M |
| Peru Hydro | 0.8 | $31M |
| Norway NO3 Hydro (Trondheim) | 0.5 | $26M |

*Hydro is genuinely thin in the verified dataset: Colombia dominates by ~7×, with the rest tail-heavy on Norwegian sub-basins. Sichuan and Iceland would lead this list at $1,242M and $341M respectively but sit in T3-modelled, excluded from §3's verified framing.*

*Source: ELJ dataset v1.3.2 last-good snapshots (2026-05-20), ranked by foregone revenue (annual TWh × wholesale price from `data/static-prices.csv`; IEA / EIA / ENTSO-E / CCEE 2023–24 averages, FX-converted to USD). Verified = T1a + T1b + T1c + T2-flare; T3-modelled regions excluded. Flare revenue uses a synthetic gas-equivalent price ($20–50/MWh delivered-electric basis) rather than a market clearing LMP — interpret as opportunity cost, not market price. Brazil rows reflect the May 2026 ONS curtailment-formula correction (commit `eabf8e5`), which reduced previously reported Bahia/RN/Piauí/MG curtailment by 25–60% after a `val_geracaolimitada` sign-convention error was identified.*

**Top 15 verified hotspots by foregone revenue (T1 + T2-flare; T3-modelled excluded):**

| Site | Annual TWh wasted | Foregone revenue (USD/yr) | Tier |
|---|---:|---:|---|
| Southern Iraq (Basra/Rumaila/Majnoon) | 63.0 | $2,205M | T2-flare — satellite |
| Western Siberia (Khanty-Mansi/Yamal AO) | 42.4 | $1,611M | T2-flare — satellite |
| Colombia | 22.7 | $1,250M | T1b — domestic |
| Permian Basin, USA | 20.6 | $1,030M | T2-flare — satellite |
| Bahia Wind, Brazil | 17.9 | $861M | T1a — live TSO |
| Germany Wind | 5.6 | $541M | T1a — live TSO |
| Rio Grande do Norte Wind, Brazil | 10.4 | $500M | T1a — live TSO |
| MISO Midwest Wind, USA | 8.7 | $488M | T1a — live TSO |
| Minas Gerais Solar, Brazil | 9.3 | $447M | T1a — live TSO |
| Yamal, Russia | 10.0 | $380M | T2-flare — satellite |
| Eastern Siberia, Russia | 9.0 | $342M | T2-flare — satellite |
| Spain Solar | 3.7 | $303M | T1a — live TSO |
| Germany Solar | 2.8 | $269M | T1a — live TSO |
| Bahia Solar, Brazil | 5.2 | $250M | T1a — live TSO |
| Piauí Wind, Brazil | 4.9 | $234M | T1a — live TSO |

*Sichuan ($1,242M), Xinjiang ($430M), and Iceland ($341M) are excluded as T3-modelled per §3's verified framing; including them would re-rank Sichuan to position 4. The exclusion is conservative.*

The carbon arithmetic follows directly. If Bitcoin's entire network ran on today's wasted energy — curtailed renewables at effectively zero grams of CO₂ equivalent per kilowatt-hour marginal intensity, and flare gas at roughly forty grams per kilowatt-hour post-combustion versus 740 grams if vented as methane on a GWP100 basis — total network emissions would fall from 49.3 million tonnes of CO₂ equivalent per year to 6.2 million.[^8] [^9] [^10] An 87.5% reduction. Bitcoin's current network, at 249.5 g CO₂e/kWh, already sits at 53% of the global grid average of 473.[^5] [^1] A curtailment-first network would be a fraction of that fraction — comparable in emissions to a small European country, not a global environmental problem.

As long as this is presented as arithmetic, the case holds. However, "could" is not "will." Geographic mobility timelines range from eighteen months for container redeployment to sixty months for new greenfield builds in regulated interconnection queues. The market mechanism to connect a curtailment site with a willing mining buyer at the right price does not yet exist at scale outside ERCOT. These are institutional gaps. The physics is settled.

## §5 — What AI changes

AI data centres are the largest new electricity load in decades, and they are already outbidding Bitcoin miners for the same electrons. The International Energy Agency projects AI-related data centre demand to reach 945 terawatt-hours by 2030 — roughly Japan's current annual consumption.[^11] That demand is being signed into twenty-year power purchase agreements for firm, reliable, low-carbon electricity at prices Bitcoin miners cannot match. The hyperscalers — Microsoft, Google, Amazon, Meta — negotiate directly with wind and solar developers at scale, committing to off-take agreements that underwrite new renewable capacity. A Bitcoin miner cannot compete for those contracts on any of the relevant terms: price, reliability, or political economy. Data centres arrive in a jurisdiction with job commitments and tax revenue; Bitcoin mining facilities do not.

It is tempting to conclude that AI is an existential threat to Bitcoin mining's access to clean electricity. It is not. That conclusion cedes the wrong battlefield. Curtailment is the one electricity market AI cannot easily enter. AI workloads need reliable, predictable power with known availability — the opposite of curtailment's defining characteristics. Curtailment is spiky in volume, unpredictable in timing, geographically stranded in places the transmission grid does not reach well enough to export power to load centres. A hyperscaler cannot build a data centre at a wind farm in Bahia curtailed four hundred hours per year when no reliable power exists for the remaining 8,360. The uptime requirement for tier-four data centres — typically 99.99% — is incompatible with a resource available for perhaps sixty percent of hours. Near-zero prices do not compensate for that.

These are exactly the conditions Bitcoin mining handles without penalty. A mining container runs when power is available, shuts down when it is not, and resumes without degradation. The revenue model is continuously generative regardless of intermittency. As AI occupies the baseload renewable PPAs that mining currently competes for, it pushes mining toward the residual: structurally cheap, intermittently available power that nobody with a reliability requirement will touch. Curtailment is that residual. The competitive pressure from AI is not an existential threat to Bitcoin mining — it is a forcing function toward the structural niche mining is best suited to fill.

Aluminium smelters followed the same logic a century ago. They located in the Pacific Northwest because the Columbia River's spring melt produced more hydroelectric power than the region could use. They ran when the water was high and curtailed when it was not. They paid prices that reflected the surplus value of otherwise-wasted water. Bitcoin mining in curtailment markets is the same industrial logic adapted to a digital commodity — a load that values electrons at their marginal cost of production, not their long-run average cost, because the load can be deferred without economic penalty.

With AI taking the baseload, curtailment is where Bitcoin mining belongs. The arithmetic is reassuring: 293.7 terawatt-hours of verified waste (138.9 from renewable curtailment, 154.8 from flare gas), against a 197.6 terawatt-hour network appetite. The resource exists at roughly one-and-a-half times the right scale. The question is whether the institutional mechanisms exist to connect them.

## §6 — What needs to change

The gap between the wasted energy and the buyer is not a physics problem. The electrons exist, the hardware exists, the revenue model works at curtailment-hour prices. It is not an economics problem in any fundamental sense — the price at which a miner would buy and a generator would sell is bounded below by zero and above by the average grid price, a range that contains many mutually agreeable transaction points. It is an information and regulatory problem. Four changes would close it.

### Standardised curtailment reporting

ENTSO-E's Transparency Platform has published hourly curtailment by fuel type and cause code under the A75 dataset designation since 2015. No equivalent global standard exists. The IEA and IRENA should jointly require that grid operators above a threshold size publish hourly curtailment volumes, fuel type, and cause code in a machine-readable, open-access format. Every major transmission system operator already records this data internally for balancing settlement. The cost is publishing what they already know. The benefit is a transparent global market in wasted energy that potential buyers — miners, electrolysers, thermal storage operators, and flexibility aggregators — can price and plan against.

### A curtailment-credit mechanism for flexible loads

The US Treasury's Section 45V Clean Hydrogen Tax Credit final rule, published in January 2025, established that industrial loads drawing on curtailed clean electricity can receive credit for the carbon intensity of those electrons on an hourly-matching basis.[^12] This is the correct regulatory logic: a load that runs on power that would otherwise be wasted should not be penalised for the carbon intensity of the marginal grid unit at the time of consumption. A comparable mechanism for Bitcoin mining loads — or a new specific instrument — would change the investment calculus for curtailment-site builds. Texas Senate Bill 1929, enacted in 2023, is the operational template at state level.[^13] A federal mechanism that applies the 45V logic to interruptible computing loads is the missing incentive layer.

### Constructive use of MiCA's energy-disclosure framework

MiCA Article 66 requires EU-registered crypto-asset service providers to disclose energy consumption and fuel mix from 2024.[^14] A credible, auditable record of curtailment-origin electricity share is what ESG-motivated institutional investors need to differentiate mining on coal from mining on curtailed solar. The European Securities and Markets Authority should issue guidance requiring that MiCA disclosures include a standardised curtailment-origin metric. Voluntary adoption beyond the EU, led by publicly traded mining firms that benefit most from the differentiation, would accelerate the signal.

### An end to negative-price-hour opacity

Several major European transmission system operators do not publish hours per year in which wholesale prices go negative at their interconnection nodes, nor associated curtailment volumes by fuel type. This information exists — TSOs collect it for internal balancing settlement. Publishing it in quarterly tables, at each interconnection node, would substantially reduce the information asymmetry that currently requires expensive private data subscriptions to identify curtailment-rich locations. The cost to grid operators is negligible. The value to the market for flexible loads is substantial.

---

The evidence exists: 293.7 verified terawatt-hours of wasted energy per year, documented across 385 regions, published in an open dataset with live updates. The buyer exists: a 197.6 terawatt-hour-per-year network designed for precisely the intermittency and price sensitivity that curtailment requires. The industrial logic is sound, tested at commercial scale in multiple markets. As such, the institutional gap is the only element of this problem that remains genuinely unsolved — and institutional gaps are the most tractable.

> The world is throwing away 293.7 terawatt-hours per year of perfectly good electricity. Bitcoin is the buyer standing at the door. The only missing piece is a system that lets them transact.

---

The full dataset is archived at Zenodo ([DOI 10.5281/zenodo.19835411](https://doi.org/10.5281/zenodo.19835411)) and rendered interactively at [everylastjoule.com](https://everylastjoule.com). For correspondence: [simon@collins.nu](mailto:simon@collins.nu)

## References

1. Ember. *Global Electricity Review 2025*. London: Ember; 2025. https://ember-energy.org/latest-insights/global-electricity-review-2025/ [^1]

2. World Bank Group / GGFR. *Global Gas Flaring Tracker Report 2024*. Washington DC: World Bank; 2024. https://www.worldbank.org/en/programs/gasflaringreduction/global-flaring-data [^2]

3. Collins S et al. *Every Last Joule — Global Curtailed and Flared Energy Dataset v1.3.1*. Zenodo; 2026. https://doi.org/10.5281/zenodo.19835411 [^3]

4. Collins S. *Every Last Joule Dashboard*. 2026. https://everylastjoule.com [^4]

5. WooCharts. *Bitcoin Network Emissions Intensity*. 2026. https://woocharts.com/esg-bitcoin-mining-emissions-intensity/ (data trace dated 2024-07-27, accessed 2026-05-07). [^5]

6. ERCOT. *Settlement Point Price Historical Data*. 2024. https://www.ercot.com/mktinfo/prices [^6]

7. ERCOT. *Large Load Connection Process — revised 2024*. https://www.ercot.com/services/rq/integration [^7]

8. WooCharts. *Bitcoin Network Total Emissions*. 2026. https://woocharts.com/esg-bitcoin-mining-total-emissions/ (accessed 2026-05-07). [^8]

9. WooCharts. *Bitcoin Network Emissions Mitigated*. 2026. https://woocharts.com/esg-bitcoin-emissions-mitigated/ (accessed 2026-05-07). [^9]

10. IPCC. *Climate Change 2021 — The Physical Science Basis*. Chapter 7, Table 7.SM.7 (GWP100 fossil CH₄ = 27.9). Cambridge: Cambridge University Press; 2021. https://www.ipcc.ch/report/ar6/wg1/ [^10]

11. International Energy Agency. *Electricity 2025 — Analysis and Forecast to 2027*. Paris: IEA; 2025. https://www.iea.org/reports/electricity-2025 [^11]

12. US Department of the Treasury, Internal Revenue Service. *Section 45V Credit for Production of Clean Hydrogen — Final Regulations*. Federal Register, 3 January 2025. https://www.federalregister.gov/documents/2025/01/03/2024-31513/section-45v-credit-for-production-of-clean-hydrogen [^12]

13. Texas Legislature. *SB 1929, 88th Legislature (2023)*. https://capitol.texas.gov/BillLookup/History.aspx?LegSess=88R&Bill=SB1929 [^13]

14. European Parliament and Council. *Regulation (EU) 2023/1114 on Markets in Crypto-Assets (MiCA)*. Official Journal of the European Union, 9 June 2023. https://eur-lex.europa.eu/eli/reg/2023/1114/oj [^14]

</div>
