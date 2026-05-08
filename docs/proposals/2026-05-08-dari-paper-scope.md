# DARI paper scoping — "Bitcoin on the World's Wasted Energy"

**Title (locked):** *Every Last Joule*
**Outlet:** da-ri.org (Simon's institute)
**Date drafted:** 2026-05-08
**Status:** SCOPE LOCKED 2026-05-08 — execution dispatched
**Companion piece to:** Scientific Data Data Descriptor (academic, in flight) — but ships **independently**, no embargo coordination

## Locked decisions (2026-05-08)

1. **Title:** *Every Last Joule* (matches the dashboard / dataset name).
2. **Branding:** light touch. Pull colours + fonts from da-ri.org. NOT highly branded. NOT modelled on Stacked. Brand probe: white/off-white bg, dark navy/charcoal text, teal/cyan accent, sans-serif (Inter-family), card-based, generous whitespace, minimal dividers.
3. **Publishing surface:** Webflow CMS — no repo. Deliverables are content + assets for Simon to import into Webflow.
4. **Headline number:** yes — single % stat above fold, methodology envelope disclosed in §3.
5. **Citations:** AMA 8 (numbered superscripts + reference list). NOT newsletter-style footnotes-with-links.
6. **Embargo:** none — DARI piece ships when ready, doesn't wait for Scientific Data submission.

## Source overrides

- **Bitcoin emissions intensity / TWh:** use [WooCharts ESG tracker](https://woocharts.com/esg-bitcoin-mining-emissions-intensity/) as primary. Simon explicitly rejects CCAF / de Vries / ARK / Square as headline anchors. The WooCharts page is JS-rendered; live figures need browser fetch.

---

## One-paragraph thesis

We built the most comprehensive open dataset of curtailed and flared energy ever assembled — 384 regions across every UN member state, with hourly resolution where it exists and honest documented gaps where it doesn't. We then overlaid Bitcoin's global electricity consumption against that map. The result lets us answer, for the first time at this resolution: *what fraction of Bitcoin's annual energy use could be served entirely by energy that the world is already wasting?* This piece walks policy and industry readers through what we built, what we found, and what the financial and carbon implications are for grid operators, generators, and the Bitcoin network itself.

## Audience and tone

- **Primary:** energy-policy professionals, regulators, generation-side asset operators (renewables developers, oil & gas with associated-gas problems), institutional Bitcoin allocators, climate-tech analysts.
- **Secondary:** journalists who cover Bitcoin × energy, sympathetic legislators' staff.
- **Voice:** Simon's professional/accessible register. Closer to the weekly Bitcoin newsletters than the Scientific Data paper. Confident, well-sourced, no academic hedging-language; no marketing puffery either.

## Working title (placeholders — Simon picks)

1. *"Every Last Joule: Bitcoin and the World's Wasted Energy"*
2. *"The Wasted Half: How Much of Bitcoin Could Run on Energy We're Already Throwing Away?"*
3. *"384 Regions, One Map, One Question"*

## Outline (proposed sections)

| § | Working heading | Words | Purpose |
|---:|---|---:|---|
| 0 | Hero + key-stat block | n/a | Above-the-fold figure: % of Bitcoin's energy that could be served by global curtailment + flare. Single line. Plus interactive globe embed. |
| 1 | Why this dataset exists | 350 | Frame the gap: nobody has had a region-by-region, hourly-resolution map of wasted energy. Quote the existing fragmented sources (IEA WEO; IRENA; ENTSO-E; CEC; AEMO) and explain why aggregating them honestly is hard. |
| 2 | What we built | 500 | The discipline layer in plain English: 384 regions, three-tier confidence model, sourceProvenance flag, the bad-conversions checklist. Show one screenshot of the dashboard with annotations. |
| 3 | The Bitcoin overlay | 450 | CBECI-derived annual TWh as the comparator. Methodology sidebar (1 paragraph). Headline number: X% of Bitcoin's 2025 consumption fits inside the global curtailment + flare envelope. |
| 4 | Where the matches are best | 600 | Region clusters: West Texas wind curtailment, German solar negative-price hours, Scottish wind constraints, Permian flare gas, West Siberia flare, Atacama solar spill. For each: a panel showing curtailed TWh, $/MWh wholesale price, and Bitcoin's hash-friendly load profile. |
| 5 | What it's worth — the generator side | 450 | Wholesale-revenue arithmetic: at current $/MWh prices, the annual revenue *foregone* by curtailment is $Y bn globally. Bitcoin miners as buyer-of-last-resort changes that math. Compare to existing analogues (Crusoe, Exxon ND flare-mining pilot, MARA Texas demand-response). |
| 6 | What it's worth — the carbon side | 450 | Bitcoin's current grid-average emission factor vs a curtailment-+-flare-only counterfactual. Be honest about flare math (methane → CO2 still emits but ~25× less GWP than venting). Caveats labelled. |
| 7 | What this isn't | 300 | Honest limits: self-curtailment is invisible; documented gaps remain; price coverage is partial; Bitcoin's geographic mobility has frictions; "could" ≠ "will." |
| 8 | What policy could do with this | 400 | 3–4 specific, actionable policy hooks: curtailment payment caps that don't disqualify Bitcoin offtake; flare-mining credits in 45V-style frameworks; ENTSO-E publication of negative-price-hour curtailment; the case for an open standard for regional curtailment reporting. |
| 9 | Where to go next | 200 | Pointers to the dashboard, the dataset (Zenodo), the academic paper, the dataset card, the methodology pages. CTAs. |
| — | **Total** | **≈3,700** | Plus footnote/citation block |

## Charts and visuals required

| # | Visual | Source / how to generate |
|---:|---|---|
| F1 | Hero stat: "X% of Bitcoin's energy" | Computed from CBECI annual TWh + sum of T1a/T1b/T1c verified-curtailment + T2-flare + scaled T3. One number, one supporting line. |
| F2 | World map / spinning globe | Either a screenshot of the live dashboard at a chosen UTC moment, or an embedded interactive globe if the piece ships as a web page on da-ri.org. |
| F3 | Top-20 wasted-energy regions (bar chart) | Generated from the Zenodo dataset. Annotate top 5 with photos / icons. |
| F4 | Bitcoin annual TWh vs total wasted energy (single comparison block) | Two numbers, large, with legend. |
| F5 | Region match panel (4-up small multiples) | West Texas, Germany, Scotland, Permian flare. Each panel: curtailment hourly profile + Bitcoin's typical 24h load shape overlaid. |
| F6 | Generator revenue at risk ($/yr by region) | Computed from `data/static-prices.csv` × curtailed MWh. Top-15 ranked. |
| F7 | Carbon counterfactual (current Bitcoin gCO₂/kWh vs curtailment-fed) | Two stacked bars. |
| F8 | Dashboard screenshot — annotated | Pull from live site. Annotate hotspot list, headline, mode toggle, USD toggle. |

## Web-sourced research items (need research, not in repo today)

These are the items where I'd dispatch MiniMax or DeepSeek to do sourced web research — each output should be a brief with linked citations:

1. **Bitcoin annual TWh — current best estimate.** CBECI live; cross-check with CoinMetrics, Galaxy, Cambridge.
2. **Bitcoin's grid-mix emission factor.** Academic: de Vries; CCAF; ARK Invest; Square/Block memo.
3. **Existing Bitcoin × waste energy case studies.** Crusoe Energy (Permian); ExxonMobil ND pilot; MARA TX demand-response; Argo Helios; Genesis Digital flare ops; Hut 8 hydro; Iris Energy hydro.
4. **Curtailment payment regimes globally.** ERCOT congestion revenue rights; UK Balancing Mechanism constraint payments; AEMO RERT; CAISO bid-cost recovery — what's been published in 2024–25.
5. **Flare-gas methane reduction figures.** GGFR Global Gas Flaring Tracker 2024–25; IEA Methane Tracker 2025; methane-to-CO2 GWP framing.
6. **Negative-pricing hours by zone.** EPEX Spot, Nord Pool, ERCOT historical reports — counts of negative-price-hours in 2024–25 by zone.
7. **Bitcoin mining geographic mobility — frictions.** Container vs hard infrastructure; permitting; fibre; transformer queues. Recent reporting from CoinShares, Hashrate Index.
8. **Policy proposals already in flight.** US 45V / IRA tax credit hash-rate language; EU MiCA energy-disclosure rules; Texas SB-1929; New York PoW moratorium history.

## Format / branding / delivery

**Two outputs, same content:**

1. **Branded PDF** — modelled on Simon's weekly Bitcoin newsletter HTML template. Pulled to PDF via headless Chrome / paged.js. Cover page, branded header, footnote citations, da-ri.org footer.
2. **Web page on da-ri.org** — same content, with three live interactive components:
   - Embedded spinning globe (iframe to a stripped dashboard route, or a re-usable component lifted out)
   - F5 region-match panel as an interactive small-multiples chart (D3 or Observable Plot)
   - MW ↔ USD toggle on F6 (re-using the PR #68 component)

**Open question for Simon:** is the newsletter HTML template in a repo I can read? If so, point me at it and I'll mirror it. If not, I'll need a sample issue (PDF or HTML export) as a brand reference.

## Length target

≈3,700 words body + ≈8 charts + footnotes. Roughly the length of a long-form newsletter or a Brookings policy brief.

## Dispatch plan (post-sign-off)

| Stage | Worker | Output |
|---|---|---|
| 1. Web research bundle (8 items above) | MiniMax × 2 + DeepSeek × 1 (parallel briefs) | Sourced markdown bundles, each ≤1,200 words, with linked citations |
| 2. Bitcoin overlay computation | Sonnet agent | Python notebook + emitted JSON producing F1, F4, F6, F7 |
| 3. Chart generation | Sonnet agent | F1–F8 as PNG (for PDF) and Observable Plot specs (for web) |
| 4. Section-by-section drafting | DeepSeek-V4-Pro | First-draft prose, paragraph-level, citing the research bundle |
| 5. Voice pass | Simon + me with `simonizer` skill | Final voice |
| 6. Layout / branding | Sonnet agent (Frontend Developer subagent) | Newsletter HTML template applied; PDF export |
| 7. Web page version | Sonnet agent | da-ri.org page with interactive components |

Estimated wall-clock to first reviewable draft: ~2–3 working days with parallel dispatch. Voice pass + final polish: separate.

## Open questions for Simon

1. **Title.** Pick from the three above or propose your own.
2. **Newsletter brand reference.** Where do I find the HTML template?
3. **da-ri.org publishing surface.** Is there a CMS / static site repo I should commit a `/wasted-energy/` page into?
4. **Headline number policy.** Are you comfortable putting a single % stat above the fold, knowing the methodology has an envelope around it? (Yes is the right answer; just confirming.)
5. **Citations style.** Footnotes-with-links (newsletter style) or full APA/Harvard? Newsletter-style is faster and reads better for the audience but is less academic.
6. **Embargo.** Do you want the DARI piece to drop *with* the Scientific Data submission, or land first as a public-interest splash to set up the academic submission?

---

When you sign off (or amend) the scope, I'll dispatch stages 1–3 in parallel.
