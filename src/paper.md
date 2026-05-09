<nav class="page-back-nav"><a href="./">← Dashboard</a></nav>

<div class="methodology-doc">

<header class="methodology-header">

<div class="methodology-eyebrow">Every Last Joule · DARI Research Note · May 2026</div>

# The Sorting Mechanism: How the AI Pivot Is Driving Bitcoin Mining Toward Its Natural Home

<p class="methodology-deck">Renewable electricity curtailed at grid scale already rivals Bitcoin's annual network demand. This note presents the ELJ-PRICE integration model — the first framework to bring curtailment supply, network energy demand, and the AI pivot together in a single quantitative analysis.</p>

**Author:** Simon Collins, DARI · [da-ri.org](https://da-ri.org)

</header>

## Abstract

Renewable electricity is curtailed at scale every year — produced for free at zero marginal cost, then deliberately withheld from grids that cannot absorb it. Bottom-up estimates from ISO disclosures put 2024 global curtailment at approximately 125 TWh — comparable to the entire annual energy demand of the Bitcoin network. This note presents the ELJ-PRICE integration model, a framework that brings three quantities into a single analysis for the first time: the volume of curtailed renewable electricity, the Bitcoin network's energy demand, and the ongoing conversion of mining infrastructure to AI and high-performance compute. The central finding is that industrial reorganisation — the AI pivot — is the mechanism most likely to close the gap between curtailment supply and mining demand within the current decade, by sorting the mining fleet toward the siting positions where its flexibility characteristics are most economically valuable. At plausible efficiency trajectories and under conservative supply assumptions, curtailed renewable electricity could in principle cover the entire Bitcoin network's energy demand before 2030.

---

## 1. The problem is structural, not cyclical

Every year, power systems around the world produce clean electricity and then destroy it. In 2024, bottom-up estimates from ISO disclosures and grid-operator data suggest global wind and solar curtailment reached approximately 125 TWh — with the United States alone contributing ~20 TWh (Amperon, 2024), China an estimated ~80 TWh at a ~4% curtailment rate (IEA; S&P Global, 2024), Europe approximately 15 TWh (Delfos Energy, 2025), Chile 5.9 TWh (+149% year-on-year, SolarTech 2024), and Australia 4.3 TWh (AEMO QED 2025). Grid-investment gaps are widening rather than closing as renewable capacity outpaces transmission build-out. Curtailment is growing.

For context: the Cambridge Centre for Alternative Finance (CCAF) estimates Bitcoin's annualised network consumption at 138 TWh in 2025 (Neumueller et al., 2025). In the same year, global curtailment was likely running at approximately 91% of that figure and rising. The electricity was there. No one bought it.

The 125 TWh bottom-up figure is almost certainly an undercount. Self-curtailment under negative prices — generation that owners dispatch down rather than accept spot prices below zero — is systematically under-reported in grid-operator statistics. The IEA's curtailment rate method, applied to Ember's global VRE generation figures, suggests a high-end estimate of approximately 160 TWh. The true figure probably falls in the 125–160 TWh range, and is growing.

*Note on the 50 TWh figure:* Some earlier versions of this work used 50 TWh as a conservative floor for 2024 curtailment, attributed to IRENA. That specific IRENA attribution could not be confirmed from any publicly accessible IRENA document. We use the bottom-up figure of 125 TWh as the better-supported mid-case throughout this note.

---

## 2. Bitcoin mining as flexible absorber: the structural case

Bitcoin mining has an unusual combination of properties that make it a candidate absorber for stranded renewable energy. The hardware draws power at a fixed rate. There is no minimum-off-time constraint. The computation can be located anywhere with power and internet — it has no requirements for customer proximity, low latency, or transmission reliability. A mine can come on or go off at subsecond timescales in response to a grid signal. It produces a fungible revenue stream (bitcoin) that scales with available energy rather than with customer proximity.

These properties describe a near-ideal interruptible load for absorbing excess generation: modular, location-agnostic, fast-responding, latency-tolerant.

In practice, most of the globally installed mining fleet does not operate this way. Most mines are sited for cheapest firm baseload power and operate under continuous-load agreements. They are not deployed at transmission-congestion points, at the end of under-built VRE collector systems, or at the stranded-energy site where a renewable developer cannot reach a buyer. The structural fit exists; the deployment does not yet match the opportunity.

---

## 3. The AI pivot as sorting mechanism

Between late 2024 and Q1 2026, listed Bitcoin mining operators collectively announced AI and high-performance compute conversion contracts that in aggregate exceeded USD 65–70 billion (Core Scientific, Marathon Digital, IREN, Terawulf, Applied Digital, Hut 8, Iris Energy). AI compute has material siting requirements that Bitcoin mining does not: low-latency proximity to fibre, thermal stability, continuous-power guarantees, and predictable round-trip latency. AI can pay more per kWh for power that meets those requirements. In any setting where both uses are technically feasible, AI will outbid Bitcoin.

This is not a threat to the Bitcoin network's thesis about energy. It is a sorting mechanism.

The operators with the lowest cost-of-capital and the highest demand for thermal stability migrate to Tier 1 AI infrastructure. The operators that remain specialised Bitcoin miners — by choice or by competitive pressure — face an intensifying need to access the cheapest available power. The cheapest available power, in any market with growing renewable penetration, is increasingly the power that would otherwise be curtailed. Curtailment means zero revenue for the generator. Mining at curtailed sites means below-baseload power for the miner and a first-sale for the generator. The competitive pressure of AI on Bitcoin's baseload positions is the mechanism that pushes mining toward stranded, curtailed, and behind-the-meter renewable generation.

This is what the *ELJ-PRICE integration model* formalises. It takes three quantities — curtailment supply, network energy demand, and the AI pivot fraction — and asks: under what conditions does curtailed renewable electricity come to cover Bitcoin network demand?

---

## 4. The framework

The model is defined by four elements.

**Inputs:** (1) Curtailment supply C(t) in TWh per annum, from ISO disclosures and aggregate data. (2) Network energy demand D(t), parameterised by hashrate H(t) and fleet-average ASIC efficiency η(t), with trajectories derived from Paez (2026)'s PRICE model. (3) Industrial-reorganisation parameter π ∈ [0,1] — the share of baseload mining capacity converted to AI compute. (4) Adjustment factors: deployable-fraction multiplier δ (geographic mismatch) and diurnal-availability factor λ.

**Operations:**

- Pivot-adjusted demand: D(t,π) = (1 − π) × H(t) × η(t) × T
- Adjusted supply: S(t) = C(t) × δ × λ
- Coverage ratio: R(t,π) = S(t) / D(t,π)

**Output:** The coverage-ratio surface R(t,π) — how much of network demand could in principle be supplied by curtailed electricity — across time and pivot scenarios.

**Boundary conditions:** This framework produces *technical* upper bounds, not *deployable* upper bounds. Setting δ = 1.0 assumes geographic mismatch is zero — that curtailment anywhere can serve mining anywhere. This is the most optimistic assumption in the model and is explicitly a design choice. The deployable upper bound (which requires site-level geographic matching) is reserved for follow-on work with primary data.

---

## 5. Results of the worked illustration

The worked illustration applies the framework to 2025 data, projecting to 2030. Inputs are: curtailment supply from 50 TWh (2024 conservative floor) interpolated to 100 TWh (2030 illustrative endpoint); network hashrate held constant at the 2025 CCAF baseline of 716 EH/s (~138 TWh annualised); efficiency trajectory declining linearly from 22 J/TH (2025, CCAF-implied) to 13 J/TH (2028, manufacturer-roadmap extrapolation), held constant thereafter. Pivot scenarios are 0%, 30%, and 70%.

These curtailment inputs are deliberately conservative: the 2024 bottom-up estimate is approximately 125 TWh, and the 2030 endpoint of 100 TWh is below that current level. The model uses the conservative range to ensure crossing-point findings are not built on optimistic supply assumptions.

| Pivot scenario | Diurnal assumption | First year R ≥ 1 | Coverage ratio 2030 |
|---|---|---|---|
| 0% (no conversion) | 24h (λ=1.0) | **2028** | 1.84 |
| 0% (no conversion) | Daylight-only (λ=0.5) | No crossing | 0.61 |
| 30% conversion | 24h (λ=1.0) | **2027** | 2.62 |
| 30% conversion | Daylight-only (λ=0.5) | No crossing | 0.88 |
| 70% conversion | 24h (λ=1.0) | **2026** | 4.09 |
| 70% conversion | Daylight-only (λ=0.5) | **2027** | 1.36 |

*All crossing-point findings are conditional on the input parameters above. They are not predictions.*

Three findings stand out.

**First:** The pivot parameter is the load-bearing variable. Industrial reorganisation alone — holding curtailment growth and efficiency improvement at central values — produces a two-year pull-forward in the crossing point (2028 under no-pivot to 2026 under 70% conversion). The bifurcation pressure of AI on Bitcoin's baseload contracts is the structural mechanism that makes the technical upper bound increasingly attainable within the projection horizon.

**Second:** The diurnal-availability assumption matters enormously. Under a daylight-only assumption (λ = 0.5, representing a solar-dominated curtailment mix without storage), the no-pivot and 30% pivot scenarios do not cross unity within the modelled horizon. This is the framework's clearest signal that storage and time-shifting infrastructure are not optional complements to the deployment thesis — they are prerequisites.

**Third:** Even under the model's conservative supply assumptions, the no-pivot case crosses unity by 2028. On the more defensible bottom-up curtailment estimate of 125 TWh (rather than the 50 TWh conservative floor used in the model), the supply side is already at or above the technical upper bound for network demand. The question is not whether the supply exists. The question is whether the deployment can happen fast enough to capture it.

---

## 6. What this does not claim

This framework is explicit about its boundaries.

It does not claim that miners can physically access all curtailed electricity. Geographic mismatch is unmodelled (δ = 1.0). Curtailment is geographically concentrated in West Texas, Xinjiang, northern Chile, and the Nordic region. Mining deployment in those regions is growing but is not yet co-located with curtailment at scale.

It does not claim that the 30% or 70% pivot scenarios are forecasts. They are parameter choices chosen to span a plausible range given the commercial signals as of 2025–26. The actual pivot fraction depends on AI compute demand, data-centre financing conditions, hashprice, and regulatory factors that the model does not attempt to estimate.

It does not address whether Bitcoin mining is "good" or "bad" for the energy system in any net sense. It addresses a narrower, tractable question: what is the technical envelope of curtailment absorption under projected efficiency, supply, and industrial-reorganisation parameters?

Peer-reviewed empirical support for the broader deployment thesis exists in the literature. Gharehpetian et al. (*Solar Energy*, 2025) shows solar + mining co-location lifting IRR from single-digits to 15–54% via Monte Carlo analysis. Paez (2026)'s PRICE model provides the only peer-reviewed framework for projecting Bitcoin network energy demand under alternative price and efficiency scenarios — and this note's framework is explicitly complementary to it, not a substitute.

---

## 7. The sorting thesis: a forward framing

When the AI pivot is read structurally rather than symptomatically, it describes a productive outcome rather than a crisis. The highest-value AI compute requires baseload power with continuous uptime and thermal predictability. Bitcoin mining requires cheap power with flexibility tolerance. The two use cases are naturally sorted to different parts of the grid.

AI migrates toward Tier 1 data-centre infrastructure with guaranteed uptime agreements, near fibre interconnects, and predictable power costs. Bitcoin mining migrates toward the places where power is cheapest — which, in a world with growing renewable penetration, increasingly means stranded and curtailed sites. The pressure of AI competition is the mechanism that corrects the current misalignment between Bitcoin mining's structural fit with curtailed renewables and its actual deployment pattern.

The Atacama Desert produces some of the highest solar irradiance on Earth. The 180 MW Coya solar installation there generates, by our calculation, approximately 25–40% of its annual output as energy that the 638 MWh battery cannot absorb — hundreds of megawatt-hours per day on a summer afternoon, produced at zero marginal cost, with nowhere to go. Kenya's run-of-river hydro systems have anchor-tenant demand gaps that keep village grids financially unviable without a flexible buyer. West Texas curtailed more than 5 TWh of wind from a single transmission-constrained zone in 2024.

These are not marginal edge cases. They are the structural economics of variable renewable energy, amplified by transmission constraint. Bitcoin mining, under competitive pressure from AI, is sorting itself toward exactly these locations. The sorting is the solution.

---

## References

Amperon (2024). *US Solar and Wind Curtailment Is Exploding.* https://www.amperon.co/blog/us-solar-and-wind-curtailment-is-exploding

AEMO (2025). *Quarterly Energy Dynamics Q3 & Q4 2025.* https://www.aemo.com.au/

Delfos Energy (2025). *Curtailment by Any Name: The EUR 7.2B Problem.* https://www.delfos.energy/blog-posts/curtailment-has-many-names

Ember (2025). *Global Electricity Review 2025.* https://ember-energy.org/latest-insights/global-electricity-review-2025/

Gharehpetian, G. B. et al. (2025). Techno-economic assessments of a cogeneration system of large-scale solar photovoltaic energy and Bitcoin cryptocurrency mining. *Solar Energy.* https://doi.org/10.1016/j.solener.2025.113905

International Energy Agency (2025). *Renewables 2025.* https://www.iea.org/reports/renewables-2025/renewable-electricity

Lawrence Berkeley National Laboratory (2025). *Queued Up 2025 Edition.* https://emp.lbl.gov/publications/queued-2025-edition-characteristics

Neumueller, A., Pieters, G. C., Mohaddes, K., Rousseau, V. and Zhang, B. Z. (2025). *Cambridge Digital Mining Industry Report: Global Operations, Sentiment, and Energy Use.* Cambridge Centre for Alternative Finance / Cambridge Judge Business School. https://www.jbs.cam.ac.uk/wp-content/uploads/2025/04/2025-04-cambridge-digital-mining-industry-report.pdf

Paez, V. M. (2026). *Characterizing and Modeling Energy Flexibility and Decarbonization Potential through Metrics, Heuristics, and Forecasting in Cryptocurrency and High-Performance Data Centers.* PhD dissertation, Georgia Institute of Technology. https://github.com/dmrobotix/phd

S&P Global Ratings (2024). *Sustainability Insights: Rising Curtailment in China.*

WattClarity (2026). *Keeping Up with the Curtailment 2025.* https://wattclarity.com.au/articles/2026/02/keeping-up-with-the-curtailment-2025-beneath-the-headline-numbers/

</div>
