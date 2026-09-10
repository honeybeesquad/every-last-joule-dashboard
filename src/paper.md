<nav class="page-back-nav"><a href="./">← Dashboard</a></nav>

<div class="methodology-doc">

<header class="methodology-header">

<div class="methodology-eyebrow">Every Last Joule · DARI Research Paper · May 2026</div>

# Every Last Joule: Bitcoin and the World's Wasted Energy

<p class="methodology-deck">293.7 TWh/yr of verified wasted energy — 149% of Bitcoin's annual use. Counted across 385 regions in 195 countries.</p>

**Author:** Dr Simon Collins · [da-ri.org](https://da-ri.org)

**Published:** 9 May 2026 · Draft — for review before publication

**Dataset:** [DOI 10.5281/zenodo.19835411](https://doi.org/10.5281/zenodo.19835411) · **Dashboard:** [everylastjoule.com](https://everylastjoule.com)

</header>

## §1 — The charge, and the missing number

Bitcoin's electricity use draws more environmental scrutiny than almost any other technology. Academics, journalists, and regulators have argued that the network uses too much power, that the power should go to better uses, and that the carbon is unacceptable. Policy followed. New York put a two-year moratorium on new fossil-fuel mining in 2022. Sweden called for an EU-wide ban on proof-of-work the same year. The EU's Markets in Crypto-Assets Regulation now requires energy disclosure, on the assumption that transparency will force a political response.[^14] The assumption is that Bitcoin competes for scarce clean electricity just as the world needs to electrify everything.

The reply is older than the regulation. Miners, a few independent researchers, and operators such as Crusoe Energy have argued that Bitcoin is not competing for scarce power so much as buying power that has no other customer. The hardware is modular — a shipping container holds one to ten megawatts. It can shut off in seconds, faster than other large industrial loads. It does not care where it sits, beyond cheap power and a working internet connection. It earns revenue every hour of the year. That combination lets a miner go where other industry cannot: a wind farm idled by a congested line, a dam with the spillway open, a well flaring gas because there is no pipeline.

What the reply has lacked is a number. Flare-mitigation in the Permian and hydro spill in Sichuan are real. They are not a total. Without a count of how much wasted energy exists, where it sits, and how it compares to Bitcoin's own use, the reply stays an assertion. The public data to answer it was not in one place. The IEA publishes curtailment for about a dozen countries, mostly behind a paywall. Ember, IRENA, the Energy Institute, and Our World in Data track generation and capacity, not curtailment. GridStatus.io tracks curtailment live for five US operators. This paper is that count. The world discards more energy than Bitcoin uses. The charge of excess does not count that waste.

![Two-column argument tree. Left column "The Policy Edifice" shows three policy actions (NY moratorium, EU MiCA disclosure, China ban) resting on three claims about Bitcoin's energy harm, which in turn rest on six foundational sources (Mora 2018 flagged CONTESTED with three rebuttals, de Vries 2018 flagged COMMENTARY, Cambridge CBECI flagged NOT PEER REVIEWED, Stoll 2019, Krause & Tolaymat 2018, Truby 2018 flagged DERIVATIVE) connected by thin grey edges. Right column "This Paper's Counter" shows the conclusion that Bitcoin can absorb 293.7 TWh per year of already-wasted electricity, supported by three derived claims, all resting on 158 cyan dots (live TSO feeds) plus 8 amber dots (satellite-verified flare basins) for 166 primary measurements across 385 regions, connected by thick cyan edges.](../docs/dari/charts/claim-cascade.svg)

> *Figure 1: Two evidence bases. The policy edifice (left) rests on six sources — a Joule commentary, a contested Nature Climate Change paper, a non-peer-reviewed institutional model, two bottom-up estimates, and a derivative review. The counter-claim (right) rests on 158 live TSO feeds and eight satellite-verified flare basins across 385 regions. Edge thickness encodes evidence weight. Source: ELJ v1.3.2.*

## §2 — How much energy the world wastes

Every Last Joule spent eighteen months assembling a dataset covering 385 regions across 195 countries, in three source tiers. Tier 1 — 158 regions — is live transmission-system operator API feeds: ENTSO-E across Europe; ERCOT, CAISO, MISO, PJM, ISO-NE, NYISO, SPP, and BPA in the United States; Elexon BMRS in Great Britain; EirGrid in Ireland; ONS in Brazil; XM in Colombia; the Coordinador Eléctrico Nacional in Chile; OCCTO in Japan; and AEMO in Australia, among others.[^1] These sources publish hourly or sub-hourly volumes of renewable generation that operators cut because the line or the demand could not take it. Anyone with an internet connection can check them.

Tier 2 adds eight satellite-verified flare-gas basins — the T2-flare sub-bucket — from the World Bank's Global Gas Flaring Reduction programme, calibrated against infrared satellite measurements and converted to electrical equivalents with standard heat-rate assumptions.[^2] A further six annual-calibrated non-flare regions (Austria's APG zone, Russia's Murmansk wind, and four Chinese provincial hydro systems) sit in Tier 2 but are excluded from the headline totals below. Tier 3 is model-based estimates at ±40% uncertainty, from IRENA, Ember, and China's National Energy Administration, for directional coverage.[^1] The headline rests on Tier 1 live feeds and the eight T2-flare basins only.

The IEA tracks curtailment for about a dozen countries. This dataset is roughly thirty times broader. Forty-one percent of its regions have live operator feeds refreshed every three hours. Every region has a published uncertainty envelope and a citation to a specific operator or regulator. The totals are a lower bound: self-curtailment — generators who throttle privately in negative-price hours without reporting it — is excluded, and work on CAISO and European markets suggests that hidden volume may match or exceed formal dispatch-down.

293.7 TWh/yr of verified wasted energy — electricity, or its direct electrical equivalent, that reaches no paying customer.[^3] Larger than Argentina's annual electricity use. Foregone revenue, across 118 verified regions with wholesale prices, is $14.3 billion per year.[^3] Dataset: Zenodo (DOI 10.5281/zenodo.19835411). Map: everylastjoule.com.[^3] [^4]

> *Figure 2: Every Last Joule interactive dashboard — 385 regions, 195 countries. Live TSO data updated continuously. Circles represent annual curtailment volume; amber = flare gas, cyan = curtailed renewable generation. See [everylastjoule.com](https://everylastjoule.com) for the full interactive dashboard.*

## §3 — The comparison

Bitcoin's annual electricity use, from the WooCharts ESG tracker — Cambridge's IP-geolocation method plus site surveys for off-grid and behind-the-meter capacity — is 197.6 TWh/yr.[^5]

Verified wasted energy — live operator curtailment plus satellite-verified flare basins — is 293.7 TWh/yr.[^3] That is 149% of Bitcoin's annual use: nearly half again as much electricity, or electrical equivalent, from sources that have no other buyer.

Flare gas is 154.8 TWh of that total (53%): gas burned at wellheads because no pipeline exists, concentrated in the Persian Gulf, Western Siberia, and the Permian Basin. The other 138.9 TWh (47%) is curtailed renewable electricity — wind and solar that operators cut because the line or the demand could not take it. Curtailed renewables alone, ignoring flare, are 70% of Bitcoin's annual use.

**Where it sits.** Four countries — Iraq, Brazil, Russia, and Colombia — account for 71% of the verified total. Add the US Permian and it is 78%. The remaining ~250 regions are the other 22%. The waste is where one would look: oil-and-gas concentration in the Gulf and Russia, transmission-constrained renewable buildout in Brazil and Colombia, the Permian flare complex in West Texas. A buyer for it would go there. Mining hardware can.

**Key figures:**

| Measure | Value |
|---|---|
| Verified wasted energy (T1 + T2-flare) | 293.7 TWh/yr |
| — of which flared gas (T2-flare basins) | 154.8 TWh/yr (53%) |
| — of which curtailed renewables (T1 live TSO) | 138.9 TWh/yr (47%) |
| Bitcoin network consumption (WooCharts) | 197.6 TWh/yr |
| Wasted energy as % of Bitcoin consumption | 149% |
| Curtailed renewables as % of Bitcoin | 70% |
| Verified foregone revenue | $14.3 billion/yr |
| Top 4 countries' share of verified waste | 71% |

> *Chart note: A comparison chart of wasted energy categories versus Bitcoin network consumption is available in the full interactive version at [everylastjoule.com](https://everylastjoule.com). Sources: ELJ dataset v1.3.1 (T1 curtailment = live TSO data; T2 = satellite-verified flare gas); WooCharts ESG tracker (Bitcoin). T3 modelled estimates excluded from wasted totals.*

The claim that Bitcoin's energy use is a net addition to global electricity demand does not survive this accounting. The electricity exists whether Bitcoin mines it or not. The question is whether it reaches a customer. Those 138.9 TWh of curtailed renewables, plus 154.8 TWh of flared gas, heat nothing, power nothing, charge nothing. If Bitcoin took a fraction of that waste, net global electricity consumption would not rise; the electrons would move from a resistor bank or a flare stack to a mining rig. The charge of excess ignores the curtailment.

That is not a claim that Bitcoin already runs on wasted energy. In aggregate, it mostly does not. WooCharts' composite intensity — 249.5 g CO₂e/kWh — implies a mix dominated by conventional grid power, with small pockets of renewables and flare mitigation.[^5] The resource is there, larger than Bitcoin's entire use, and policy has proceeded as if it were not. 293.7 TWh is a verified floor. Actual waste is higher. The case does not need the modelled Tier 3 estimates.

## §4 — Can Bitcoin be the customer?

Wasted energy exists at the right scale. Can mining buy it at a price that works?

Yes, if the price and the market rules allow it. The physics is not the constraint.

No other large industrial load matches this combination. Hardware is modular, one to ten megawatts per shipping container, and can sit at an existing grid connection. The load can drop in seconds — faster than demand-response programmes assume — because miners turn electricity into heat and computation, not into a chemical or mechanical process that needs thermal inertia. Mining does not care where it sits beyond power cost and internet, so it can go to the constrained nodes where curtailment concentrates. It earns revenue every hour, which fits both baseload waste — hydro spill, flare gas — and midday solar surplus.

Mining at a curtailment site works when the power price reflects the zero opportunity cost of electricity that would otherwise be dumped. Where curtailment produces sustained negative or near-zero wholesale prices — ERCOT West Texas, Germany's north-south corridor, Brazil's Northeast wind corridor — the economics already work.[^6] Where curtailment is real but the market does not pass the discount through, they stall. A Finnish wind farm may be curtailed thirty percent of winter hours, but if settlement is zonal rather than nodal, a miner still sees the daytime market price, not the negative price that describes the system. That is a market-design problem.

The commercial precedents exist. MARA Holdings at Garden City in ERCOT, where curtailment is structural. Riot Platforms at Rockdale and Corsicana, with more than 700 megawatts of demand-response registered with ERCOT, able to shed load in seconds.[^7] Crusoe Energy's Permian flare-to-compute units, before the 2024 pivot toward AI inference, at single-well sites with no other electricity buyer within fifty kilometres. These show the model works. They do not show deployment at the scale of the waste — which the industry has been claiming as a credential for a decade without measuring.

> *Figure 3: Top curtailment and flare-gas sites (circles sized by annual TWh) with known commercial mining operations. Data: ELJ dataset v1.3.1. See the interactive map at [everylastjoule.com](https://everylastjoule.com).*

The $14.3 billion per year in foregone revenue is real loss: projects financed on the assumption the grid would take the power, then cut by a constraint or a market rule.[^3] A wind developer whose turbine is curtailed loses the contracted price down to zero. A miner paying curtailment-hour prices turns that loss into a sale.

The top five verified hotspots: Southern Iraq (Basra, Rumaila, Majnoon) at $2.21 billion per year, Western Siberia (Khanty-Mansi and Yamal) at $1.61 billion, Colombia's hydro system at $1.25 billion, the Permian at $1.03 billion, and Bahia wind in Brazil at $861 million — nearly $7.0 billion per year that generators are losing and miners are not capturing. Three of the five are flare basins. That gas is wasted by definition: burned at the wellhead because no pipeline exists.[^3]

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

The carbon arithmetic is direct. If the whole network ran on today's wasted energy — curtailed renewables at effectively zero grams of CO₂e per kWh at the margin, flare gas at about forty grams per kWh after combustion versus 740 grams if vented as methane on a GWP100 basis — network emissions would fall from 49.3 million tonnes of CO₂e per year to 6.2 million.[^8] [^9] [^10] An 87.5% cut. Today's network, at 249.5 g CO₂e/kWh, is already 53% of the global grid average of 473.[^5] [^1] A curtailment-first network would be a fraction of that.

"Could" is not "will." Moving containers takes eighteen months; new greenfield builds in interconnection queues can take sixty. Outside ERCOT, there is still no market mechanism at scale that connects a curtailment site to a willing miner at the right price. Those are institutional gaps. The physics is settled.

## §5 — What AI changes

AI data centres are the largest new electricity load in decades, and they are already outbidding miners for the same electrons. The IEA projects AI-related data centre demand at 945 TWh by 2030 — roughly Japan's current annual use.[^11] That demand is being signed into twenty-year power purchase agreements for firm, low-carbon electricity at prices miners cannot match. Microsoft, Google, Amazon, and Meta negotiate directly with wind and solar developers and underwrite new capacity. A miner cannot compete for those contracts on price, reliability, or political economy. Data centres arrive with jobs and tax revenue. Mining facilities do not.

That does not make AI an existential threat to mining's access to clean electricity. Curtailment is the market AI cannot easily enter. AI needs known, reliable power. Curtailment is spiky, badly timed, and stranded where the grid cannot export well. A hyperscaler cannot put a data centre on a Bahia wind farm curtailed four hundred hours a year when the other 8,360 hours are not reliable. Tier-four uptime — typically 99.99% — does not fit a resource that may be available sixty percent of hours. Near-zero prices do not fix that.

Mining does not need those hours. A container runs when power is there, shuts off when it is not, and resumes. As AI takes the baseload renewable PPAs that mining currently bids for, mining is pushed onto the residual: cheap, interruptible power that nobody with a reliability requirement will touch. Curtailment is that residual.

Aluminium smelters did this a century ago. They sat in the Pacific Northwest because the Columbia's spring melt made more hydro than the region could use. They ran when the water was high and stopped when it was not. They paid a surplus price for water that would otherwise have been wasted. Mining in curtailment markets is the same logic for a digital commodity: a load that values electrons at their marginal cost, not their long-run average, because it can wait.

With AI taking the baseload, curtailment is where mining belongs. 293.7 TWh of verified waste (138.9 renewable curtailment, 154.8 flare) against 197.6 TWh of network use. The resource is about one-and-a-half times the size of the buyer. The open question is the institution that connects them.

## §6 — What needs to change

The gap is not physics. The electrons exist, the hardware exists, and the revenue model works at curtailment-hour prices. The price a miner would pay and a generator would take sits between zero and the average grid price. What is missing is information and a rule that lets them meet. Four changes would close it.

### Standardised curtailment reporting

ENTSO-E's Transparency Platform has published hourly curtailment by fuel type and cause code under the A75 dataset designation since 2015. No equivalent global standard exists. The IEA and IRENA should jointly require that grid operators above a threshold size publish hourly curtailment volumes, fuel type, and cause code in a machine-readable, open-access format. Every major transmission system operator already records this data internally for balancing settlement. The cost is publishing what they already know. The benefit is a transparent global market in wasted energy that potential buyers — miners, electrolysers, thermal storage operators, and flexibility aggregators — can price and plan against.

### A curtailment-credit mechanism for flexible loads

The US Treasury's Section 45V Clean Hydrogen Tax Credit final rule, published in January 2025, lets industrial loads drawing on curtailed clean electricity claim the carbon intensity of those electrons on an hourly-matching basis.[^12] A load that runs on power that would otherwise be wasted should not be charged the carbon of the marginal grid unit at that hour. The same rule, or a sibling instrument, for mining loads would change whether a curtailment-site build gets financed. Texas Senate Bill 1929 (2023) is the state-level template.[^13] A federal version for interruptible computing loads is the gap.

### Use MiCA's energy-disclosure rule

MiCA Article 66 requires EU-registered crypto-asset service providers to disclose energy consumption and fuel mix from 2024.[^14] Investors who care about that mix need an auditable curtailment-origin share if they are to tell mining on coal from mining on curtailed solar. ESMA should require that metric in MiCA disclosures. Public miners who benefit from the distinction can adopt it outside the EU.

### An end to negative-price-hour opacity

Several major European TSOs do not publish how many hours per year wholesale prices go negative at their interconnection nodes, or the associated curtailment by fuel. They already collect this for balancing settlement. Quarterly tables, per node, would save buyers from paying for a private data feed just to find the waste. Cheap for the TSO. Useful for anyone looking for flexible load.

---

293.7 TWh/yr of wasted energy is documented across 385 regions and published. Bitcoin's network uses 197.6 TWh/yr and can take interruptible, cheap power. The industrial logic is already running at commercial scale in a few markets. The remaining gap is institutional.

> 293.7 TWh/yr of electricity, or its equivalent, is discarded. Bitcoin can buy interruptible power. What is missing is a market that lets them transact.

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
