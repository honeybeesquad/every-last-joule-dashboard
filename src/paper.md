<nav class="page-back-nav"><a href="./">← Dashboard</a></nav>

<div class="methodology-doc">

<header class="methodology-header">

<div class="methodology-eyebrow">Every Last Joule · DARI Research Paper · September 2026</div>

# Every Last Joule: Bitcoin and curtailed renewable electricity

<p class="methodology-deck">146 TWh/yr of live-tier renewable curtailment — about 109% of Bitcoin’s annual use at 16 J/TH. Counted across 459 regions in 191 countries and territories. Renewables only.</p>

**Author:** Dr Simon Collins · [da-ri.org](https://da-ri.org)

**Published:** 18 September 2026 · Draft

**Dashboard:** [everylastjoule.com](https://everylastjoule.com) · **Methodology:** [everylastjoule.com/methodology](https://everylastjoule.com/methodology)

**Dataset:** concept DOI [10.5281/zenodo.19835411](https://doi.org/10.5281/zenodo.19835411) (always latest). This paper describes **v1.4.0** (459 regions, renewables only). The version DOI is minted when the GitHub release publishes. v1.3.2 still includes flare.

</header>

## §1 — The missing number

Bitcoin’s electricity use draws more scrutiny than almost any other technology. Policy followed the scrutiny: New York’s 2022 moratorium on new fossil-fuel mining, Sweden’s call for an EU-wide proof-of-work ban, MiCA’s energy-disclosure rule.[^11] The working assumption is that Bitcoin competes for scarce clean power.

The reply is older than the regulation. Hardware is modular — a container is one to ten megawatts — and can shut off in seconds. It does not care where it sits, beyond cheap power and a working internet connection. It earns revenue every hour. That combination lets a miner sit at a wind farm idled by a congested line, or a dam with the spillway open.

What the reply lacked was a total. Hydro spill in Sichuan is real. It is not a global number. The IEA publishes curtailment for about a dozen countries, mostly behind a paywall. Ember, IRENA, the Energy Institute, and Our World in Data track generation and capacity, not curtailment. GridStatus.io tracks five US operators live. This paper is a count of published renewable curtailment, compared with Bitcoin’s own use.

Associated-gas flaring is a separate map. It was in this dataset until 18 June 2026 and now lives on [Every Last Particle](https://everylastjoule.com/particle). The numbers below are solar, wind, hydro, and geothermal only.

## §2 — How much renewable electricity is curtailed

Every Last Joule covers **459 regions** in **191 countries and territories**, in five source tiers.[^1]

- **T1a** — 160 regions. Live operator feed and a rate from the same jurisdiction. ENTSO-E bidding zones; US ISOs (ERCOT, CAISO, MISO, PJM, ISO-NE, NYISO, SPP, BPA); Elexon; EirGrid; ONS Brazil; Japan’s ten TSO areas; AEMO states and named plants; and others. Some of these sum published dispatch-down directly. Others multiply live generation by a 2024-anchored rate. Shape is observed either way.
- **T1b** — 26 regions. Live feed, rate from a domestic agency or a split of a national anchor (Germany’s four TSOs via netztransparenz, Italy’s seven TERNA zones, Netherlands, Peru solar, Colombia).
- **T1c** — 1 region. Switzerland, Swissgrid feed × Czech rate.
- **T2** — 23 regions. Published annual, or live EIA-930 shape with an external rate.
- **T3** — 249 regions. Typical shape scaled to a published annual (China’s provinces, most of Africa, South Asia, the Middle East, Latin America outside Brazil). Envelope ±40%.

187 regions (41%) have a live operator feed. Every region has an uncertainty envelope and a citation. The totals are a lower bound: self-curtailment — generators who throttle in negative-price hours without reporting it — is excluded.

On the 18 September 2026 build, the trailing-30-day window annualised (`× 365/30`) is:[^3]

| Measure | Value |
|---|---|
| Live-tier curtailment (T1a + T1b + T1c) | **146 TWh/yr** |
| Annual-calibrated (T2) | 3 TWh/yr |
| Modelled (T3) | 234 TWh/yr |
| All published regions | **383 TWh/yr** |

T3 is larger than T1. Sichuan hydro spill alone is ~67 TWh/yr on a modelled seasonal shape. The Bitcoin comparison in §3 uses the live-tier floor unless it says otherwise. The dashboard headline uses all 459 regions, as the methodology page states.

Foregone wholesale revenue across 144 live-tier regions with a price in `data/static-prices.csv` is about **$7.3 billion/yr** (annual TWh × 2023–24 average wholesale price, FX to USD). That is opportunity cost at average prices, not what a miner would actually pay in a curtailment hour.

Map: [everylastjoule.com](https://everylastjoule.com).

## §3 — The comparison

Bitcoin’s annual electricity use, from the same method as the dashboard — mempool.space 24-hour hashrate × **16 J/TH** — was **134 TWh/yr** on 18 September 2026 (954 EH/s).[^5] That efficiency is CCAF/CBECI’s implied fleet average. At 28.5 J/TH (CoinMetrics field-weighted) the denominator is 238 TWh/yr; the ratio moves one-for-one with the assumption. Both readings are on the dashboard.

Live-tier curtailment, 146 TWh/yr, is **109%** of that 16 J/TH denominator. Curtailed renewables that operators already publish are, in this window, a little larger than Bitcoin’s entire use. All 459 published regions, including modelled T3, are about **2.9×** Bitcoin. Neither figure includes flare.

That is not a claim that Bitcoin already runs on this power. In aggregate it does not. It is a claim that the published waste is large enough to matter, and that policy has treated the waste as a rounding error.

**Where the live-tier volume sits.** Brazil, the US ISOs, Colombia, Spain, and GB/North Sea wind dominate the measured list. China dominates T3 (Inner Mongolia, Xinjiang, Hebei, Sichuan). A buyer looking for measured hours goes to the first group. Mining hardware can.

**Live-tier hotspots, 18 September 2026 window:**

*Wind (T1a)*

| Site | TWh/yr | Revenue/yr |
|---|---:|---:|
| Rio Grande do Norte, Brazil | 21.2 | $1,016M |
| Bahia, Brazil | 8.7 | $419M |
| MISO Midwest, USA | 5.1 | $284M |
| SPP, USA | 4.0 | $210M |
| ERCOT West, USA | 4.0 | $226M |

*Solar (T1a)*

| Site | TWh/yr | Revenue/yr |
|---|---:|---:|
| Minas Gerais, Brazil | 6.8 | $327M |
| Bahia, Brazil | 3.4 | $163M |
| Spain | 3.4 | $275M |
| ERCOT West, USA | 2.9 | $160M |
| California | 2.7 | $197M |

*Hydro (T1a / T1b)*

| Site | TWh/yr | Revenue/yr |
|---|---:|---:|
| Colombia (vertimientos, T1b) | 4.8 | $262M |
| Norway NO2 (Kristiansand) | 2.3 | $131M |
| Norway NO4 (Tromsø) | 1.5 | $86M |
| Norway NO3 (Trondheim) | 0.6 | $36M |
| Peru | 0.5 | $20M |

Sichuan, Iceland, Argentina, Ethiopia, and Rajasthan would rearrange this list if T3 were included. They are excluded from the tables on purpose. Rajasthan’s modelled ~7 TWh/yr is also a known overstatement against RRVPNL’s 2026 PDFs.

*Source: live dashboard records, 18 September 2026, annualised from the trailing 30-day `totalTWh`. Prices from `data/static-prices.csv`. Brazil rows use ONS’s own frustrated-generation definition (`val_geracaoreferencia − val_geracao` when limited). Germany is no longer a single national wind/solar pair — it is eight TSO-level measured redispatch regions, and none of them make this top five.*

## §4 — Can Bitcoin be the customer?

The physics is not the constraint. Hardware is modular, interruptible in seconds, and indifferent to location beyond power cost and internet. It can take hydro spill and midday solar surplus. It cannot take power that the market will not price as surplus.

Where curtailment produces sustained negative or near-zero wholesale prices — ERCOT West Texas, Brazil’s Northeast wind corridor — the economics already work.[^6] Where the waste is real but settlement is zonal, a miner still sees the daytime price, not the negative price at the constrained node. That is market design, not thermodynamics.

Commercial precedents exist without needing this dataset to invent them. MARA at Garden City in ERCOT. Riot at Rockdale and Corsicana, with hundreds of megawatts of ERCOT demand-response.[^7] Crusoe’s wellhead flare-to-compute units, before the 2024 pivot toward AI, sit in the flare map, not this one. They show the interruptible-load model works. They do not show deployment at the scale of published curtailment.

**$7.3 billion/yr** in the priced live-tier set is generators’ lost wholesale revenue at average prices, not a miner’s bid. A wind developer curtailed to zero loses the contracted price. A miner paying curtailment-hour prices turns some of that into a sale.

A network running on this curtailment would be near-zero grams CO₂e/kWh at the margin. That is a counterfactual, not a description of today’s mix.

Moving containers takes months; greenfield interconnection can take years. Outside ERCOT there is still no market at scale that connects a curtailment node to a willing miner at the right price. Those are institutional gaps.

## §5 — What AI changes

The IEA’s data-centre outlook puts AI-related demand on a path toward Japan-scale annual TWh by 2030.[^8] Hyperscalers buy firm, low-carbon power on long PPAs. Miners cannot match those contracts on price, uptime, or local politics.

That does not put AI and mining on the same electrons. Curtailment is spiky and stranded. A tier-four data centre cannot sit on a Bahia wind farm that is curtailed a few hundred hours a year if the other 8,000 hours are not reliable. Mining can. As AI takes the baseload PPAs, the residual is cheap interruptible power. That is this dataset.

Aluminium smelters sat on Columbia River spring melt for the same reason: they paid a surplus price for water that would otherwise have been wasted. Mining in curtailment hours is that logic for a digital commodity.

## §6 — What would need to change

The electrons exist. The hardware exists. The price a miner would pay and a generator would take sits between zero and the average grid price. What is missing is a rule that lets them meet.

**Publish hourly curtailment.** ENTSO-E already publishes generation by fuel. It does not publish curtailed renewable energy as a product; national TSOs do, when they do. IEA and IRENA should ask operators above a size threshold for hourly volumes, fuel, and cause code, machine-readable. They already record this for settlement.

**Credit flexible loads on the hours they actually take.** The US 45V hydrogen rule lets industrial loads claim the carbon intensity of the hours they run.[^9] A sibling rule for interruptible compute would change whether a curtailment-site build gets financed. Texas SB 1929 (2023) is the state-level template.[^10]

**Use MiCA’s disclosure.** Article 66 already requires energy and fuel-mix disclosure for EU crypto-asset service providers.[^11] A curtailment-origin share is the number that distinguishes mining on coal from mining on spilled hydro. ESMA could require it. Public miners who want the distinction can report it without waiting.

**Negative-price hours, per node.** Several European TSOs already collect this for balancing. Quarterly tables would save buyers from a private data feed just to find the waste.

---

Live-tier curtailment in this window is 146 TWh/yr against 134 TWh/yr of Bitcoin use at 16 J/TH. The industrial logic already runs in a few markets. The remaining gap is institutional.

> Operators already publish more curtailed renewable electricity, in this window, than Bitcoin uses. What is missing is a market that lets them transact.

---

Dashboard: [everylastjoule.com](https://everylastjoule.com). Methodology: [everylastjoule.com/methodology](https://everylastjoule.com/methodology). Correspondence: [simon@collins.nu](mailto:simon@collins.nu)

## References

1. Ember. *Global Electricity Review 2025*. London: Ember; 2025. https://ember-energy.org/latest-insights/global-electricity-review-2025/ [^1]

2. World Bank Group / GGFR. *Global Gas Flaring Tracker Report 2024*. Washington DC: World Bank; 2024. https://www.worldbank.org/en/programs/gasflaringreduction/global-flaring-data — cited for the separate flare map, not for the totals in this paper. [^2]

3. Collins S. *Every Last Joule* live dashboard records, 18 September 2026 (trailing 30-day window, annualised). https://everylastjoule.com [^3]

4. Collins S. *Every Last Joule Dashboard*. 2026. https://everylastjoule.com [^4]

5. mempool.space mining hashrate API, 24-hour average, accessed 2026-09-18; efficiency 16 J/TH per CCAF 2025 / CBECI implied fleet average. https://mempool.space/api/v1/mining/hashrate/24h [^5]

6. ERCOT. *Settlement Point Price Historical Data*. 2024. https://www.ercot.com/mktinfo/prices [^6]

7. ERCOT. *Large Load Connection Process — revised 2024*. https://www.ercot.com/services/rq/integration [^7]

8. International Energy Agency. *Electricity 2025 — Analysis and Forecast to 2027*. Paris: IEA; 2025. https://www.iea.org/reports/electricity-2025 [^8]

9. US Department of the Treasury, Internal Revenue Service. *Section 45V Credit for Production of Clean Hydrogen — Final Regulations*. Federal Register, 3 January 2025. https://www.federalregister.gov/documents/2025/01/03/2024-31513/section-45v-credit-for-production-of-clean-hydrogen [^9]

10. Texas Legislature. *SB 1929, 88th Legislature (2023)*. https://capitol.texas.gov/BillLookup/History.aspx?LegSess=88R&Bill=SB1929 [^10]

11. European Parliament and Council. *Regulation (EU) 2023/1114 on Markets in Crypto-Assets (MiCA)*. Official Journal of the European Union, 9 June 2023. https://eur-lex.europa.eu/eli/reg/2023/1114/oj [^11]

</div>
