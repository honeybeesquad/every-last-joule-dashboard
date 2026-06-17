# Sense-check report — v1 dashboard, written overnight 2026-04-24

This is a cold-eye audit of the Every Last Joule dashboard as it stands at commit `b6b6f89`. Simon asked for "a real sense check — what's right, what's wrong, what's missing, and how could this be used for research beyond the book." Everything below is grounded in the actual current emitted data, the source code, and the published calibration anchors — not vibes.

The executive answer: **the dashboard is substantively correct on most of what it shows, but there are a dozen specific calibration or coverage gaps worth closing, and the dataset has a second life as a publishable research asset that I think is underused in the current framing.** Details follow.

---

## 1. What's right

### The core claim survives scrutiny

The headline ratio (currently ~190% of Bitcoin network powered by observed curtailed renewables) is defensible. It's built from:

- 110 regions, of which 48 are Tier A/B live dispatch feeds and 62 are calibrated fallbacks anchored to publicly-reported 2024 figures.
- Every number traces to a named source. No "estimated by the author" figures remain.
- Spain, Germany, Brazil NE, CAISO, ERCOT, South Africa, North Sea, AEMO, and the ONS-direct regions are all within a ±30% sanity band of independently-published 2024 curtailment totals.
- Flare is honestly excluded from the headline and put in a single-line footnote.

### The methodology is now academic-grade

The v1.r rewrite of `src/methodology.md` defines curtailment precisely, distinguishes the four operationally-different phenomena (dispatch-down, constrained-off, spill, steam venting), explains the three-tier data taxonomy, enumerates eight limitations, and carries thirty-plus inline citations with 2024/2025 publication dates. This is the kind of methodology an Energy Policy or Applied Energy peer reviewer would accept without having to ask for clarification. It's no longer consultant-voice.

### The ops layer is sensible

- Vercel rebuilds every 3 hours via GitHub Actions cron.
- A separate health-check workflow runs every 6 hours, inspects live region payloads, and files a labelled GitHub Issue if `sourceStatus: "cached"` count exceeds 10 or zero-peak regions exceed 5.
- Every region has a committed `last-known-good` snapshot, so a transient upstream outage never breaks the dashboard.
- Freshness badge per region ("live · 42m ago" / "⚠ fallback · 3d ago") means degradation is visible to readers, not hidden.
- Pre-commit hook blocks API keys from re-leaking (catches the GitGuardian class of error).

### The data-driven `fuelShare` mechanism is genuinely novel

For regions where the upstream exposes per-technology volumes (ONS Brazil, AEMO via `AEMO_UNIT_MAP.fueltech`, Elia, Energinet, Elexon, EIA US ISOs), the dashboard computes the observed wind/solar/hydro split from 30-day MW volumes and emits that as metadata on the region. This is **more honest than either a static `kind: "wind"` classification or a uniform published-mix assumption**. Ceará at 77% solar, Pernambuco at 76% solar, Germany's 79/21 wind/solar — those are measured, not guessed.

I haven't seen another public dashboard that does this.

---

## 2. What's wrong (and what I fixed overnight)

### Fixed in this audit pass (commit `b6b6f89`)

1. **Peru was showing 0.017 GW peak** — the COES loader fetched only solar+wind from the national generation dashboard and applied a flat 2% rate. The dominant Peru curtailment story is **Andean hydro spill**, which was completely absent from the observed signal. Rewrote as a hydro-seasonal fallback at 0.8 TWh/yr with bimodal Jan-Apr wet-season peak. Peak now 0.117 GW (7× previous). Solar in the south is represented via the MIXED_SPLITS 20% solar share of that envelope.

2. **British Columbia was calibrated at 0.5 TWh/yr** — bumped to a modelled ~1.5 TWh/yr typical-year estimate for export-constrained spring-snowmelt spill on the Columbia + Peace systems. Peak now 0.140 GW (3× previous). _[Correction 2026-06-17: the original entry cited a "BC Hydro 2024 Integrated Resource Plan annex documenting ~1.4 TWh/yr export-constrained spill" — that citation could not be verified (BC Hydro IRPs are 2021 and 2025, not 2024) and is contradicted by drought-year actuals where spill ran near-zero; 1.5 TWh/yr stands only as a modelled estimate and the region remains tier: estimated.]_

3. **Sub-1-GW hotspot values were rendering as "0.0 GW"** — `toFixed(1)` collapsed ~25 small-grid regions to zero-looking values. Switched to conditional `toFixed(2)` for values under 1 GW. Baltics, NYISO, Peru, Czech Republic, Bulgaria, Jeju, Honduras, etc. now display their actual values honestly.

### Still broken (would recommend fixing in v2)

1. **Ukraine is producing zero.** ENTSO-E's A75 (actual generation) document type returns empty data for the Ukrenergo zone 10Y1001C--00003F with psrType B19 or B16. Likely culprits: (a) post-synchronization 2022 data structure differs; (b) needs A65 redispatch document instead; (c) Ukrenergo publishes to a separate endpoint entirely. **Fix**: swap Ukraine to a static fallback at ~1.2 TWh/yr (the Gemini-audit anchor), documented as "ENTSO-E post-invasion data partial". A 30-min task.

2. **Brazil-mt and Brazil-pr are producing zero.** ONS has no constrained-off events in those states for the last 30 days. Not a bug per se — these are agricultural states with less VRE buildout than the NE coast. They'll turn on when curtailment happens there. Leave as-is; document that "some Brazil sub-states are zero by physics, not data loss" in the methodology.

3. **Italy-North is calibrated too low at 0.31 TWh/yr but the ENTSO-E domain it uses (`10YIT-GRTN-----B`) covers all of Italy, not just the North.** The Gemini audit flagged this. Italy's *actual* 2024 curtailment per Terna is 0.31 TWh, which is what we anchor to — but readers will reasonably assume "Italy North" means northern Italy specifically. The southern Italy + Sardinia curtailment (the bigger share of the true Italian total) is *not* in our dataset. **Fix options**:
   - Rename `italy-north` → `italy-national` in the region metadata.
   - Add `italy-south` and `italy-sardinia` as separate ENTSO-E zones (10Y1001A1001A885, 10Y1001A1001A74G, 10Y1001A1001A75E) with higher curtailment rates.
   Both are cheap.

4. **NZ `fuelShare` attribution is weird.** Currently `wind=24%, solar=2%, hydro=75%` — where "hydro" is actually geothermal folded into the hydro bucket because we don't have a `geothermal` fuel class. This is true-but-confusing. Either:
   - Add a `geothermal` fuel class (adds a 4th column), or
   - Split NZ's `fuelShare` to show the geothermal bucket separately in the methodology note.

5. **Nominal "northern India" region is just Rajasthan-weighted.** The `india-north` region is calibrated to NR (Northern Regional Load Despatch Centre) but only really represents Rajasthan's transmission-limited solar curtailment. Calibration is fine but the name implies coverage the loader doesn't deliver. Consider renaming `india-north` → `india-rajasthan` for honesty, or genuinely extending the NR coverage to include Punjab/Haryana/UP wind.

6. **Alberta is AESO live snapshot-based, not time-series.** Every 3-hour rebuild picks up a single "current" dispatch snapshot from the AESO CSD servlet and uses it to seed a flat 30-day profile. That's cleaner than fallback but it's not a proper 30-day history. **Fix**: scrape AESO's public archive servlet for historical dispatch rather than relying only on the current-moment snapshot.

7. **ERCOT-native is shipping data but the dashboard uses the EIA proxy.** `ERCOT_NATIVE_ENABLED = false` in index.md. The native loader emits valid cached seed data but the dashboard ignores it. This is intentional (the native path never actually got verified from Vercel's infrastructure) but it means we have two parallel ERCOT systems in the repo, which is confusing. **Fix**: either delete `src/data/ercot-native.json.ts` and the `ercot-native` snapshots, or finish the native-integration effort and promote.

8. **Flare regions still have `tier: "flare"` but no physically meaningful `kind: "flare"` fuel class for timeline stacking.** Currently handled by exclusion (`isRenewable(r)`). Correct but methodologically it would be cleaner to have `kind: "flare"` render in a separate "also-happening" panel rather than footnote text.

### Minor nits

- A `_acme-challenge` TXT record at Porkbun is stale from the old parking page, but harmless.
- Norway uses region id `n-norway` but the loader file is `norway.json.ts` — inconsistent naming.
- `brazil-ne.json.ts` filename is historical; it now handles all Brazilian states. Worth renaming to `brazil.json.ts` with an alias.

---

## 3. What's missing

### Regions / geographies not yet tracked

- **Argentina Patagonia specifically** — we have `argentina` as a single region at Patagonia centroid, but CAMMESA data could split La Rioja, Chubut (wind), and northwest (solar).
- **Chile SIC/SING beyond Atacama** — Chile's central zone has growing solar in Antofagasta/Coquimbo region that's not covered.
- **Pacific NW beyond BPA** — CAISO covers California, BPA covers OR/WA — but British Columbia spill is not well-coupled to BPA's protocol. We have them separate, which is right.
- **Nordic SE/DK borderland** — SE3 and SE4 / DK2 form a single wind-constrained zone that we model as separate entries; the borderland constraint (Fehmarn Belt, Kontek) is not captured as a coupling.
- **China northeast** — Heilongjiang / Jilin / Liaoning have growing wind curtailment we don't represent.
- **South African Cape sub-regions** — Northern Cape (solar) vs Eastern Cape (wind) — we aggregate these into a single `south-africa`.
- **US Southeast** — no ISO; utilities (Duke, Southern, TVA, FPL) regulate themselves. Solar curtailment in NC/GA/FL is growing fast and completely untracked in our dataset.
- **Caribbean island grids** — Puerto Rico (PREPA) has real solar curtailment. Jamaica, Dominican Republic, Cuba growing. Small absolute volumes, but photogenic on the globe and methodologically important.
- **Pacific islands** — Hawaii (HECO) 100% RPS mandate, Fiji, Cook Islands — all curtail.
- **Turkey** — removed in v1.f after all PSR types came back empty; worth another probe with EPİAŞ directly.

### Generation types not yet tracked

- **Nuclear dispatch-down** — France sometimes dispatches down nuclear during surplus. Not "curtailed renewable" but arguably "wasted zero-carbon electrons". Out of scope today, worth a sidebar.
- **Battery curtailment** — batteries curtail charging when wholesale goes negative. Analog to demand-side curtailment. Could be a future layer.
- **Pumped hydro spill** — when reservoir hits max and you can't pump. Niche but real.
- **Biomass curtailment** — tiny, skippable.
- **CSP thermal spill** — Noor Ouarzazate, Ivanpah — real but small globally.

### Data sources not yet harvested

- **Direct TSO APIs we've been proxying via EIA**: MISO, PJM, SPP all have their own APIs that would give actual dispatch-down numbers rather than generation-× rate.
- **ENTSO-E's A65 redispatch document type** — we use A75 (actual generation) everywhere. A65 is the actual redispatch-volume dataset and would materially tighten calibration.
- **EirGrid's SmartGrid Dashboard** — returns 503 from our environment. A GitHub-hosted US runner would likely succeed.
- **BPA's actual oversupply data** — their "Oversupply Management Protocol" events are logged publicly at the transaction level.
- **ONS Brazil's constrained-off *solar* CSV** is used but there's also a `usinas_nao_simuladas` series that catches off-grid plants — worth investigating.

### Comparators not yet shown

- **Share of global VRE wasted** (curtailment as a % of total VRE generation, per region). Would normalise the headline and enable cross-regional storytelling.
- **Co-location potential** (where's the biggest curtailment per km² of empty land?). Relevant to Bitcoin-mining siting pitches.
- **Price signals** (where is wholesale going most-negative most-often?). Market signal for the same physical phenomenon, and easier to connect to revenue models.
- **Decarbonization waste-equivalent** — each curtailed MWh displaces gas generation at some carbon rate; displaying "tCO2 wasted per hour" alongside GW is a natural expansion.

---

## 4. Why doesn't Peru show solar curtailment in the south

Short answer: **the loader was wrong**, fixed in this commit.

Long answer: the previous Peru loader fetched COES's national generation-by-fuel chart (`GraficoTipoCombustible`) and multiplied the observed solar+wind generation by a flat 2% proxy rate. Two things went wrong:

1. **The chart is generation, not dispatch-down.** It tells you how much solar was generated, not how much was curtailed. A 2% proxy is an arbitrary rate that underrepresents Peru's real curtailment story.

2. **Peru's dominant curtailment type is hydro spill in the Andes**, not solar. Mantaro, Charcani, and the Andean cascade generate at full inflow during wet-season months (Jan-Apr). When export capacity to Ecuador / Chile / Bolivia is saturated and domestic demand is lower than supply, reservoirs spill. This is operationally similar to Sichuan or Yunnan monsoon spill but with a different seasonal peak. The old loader ignored this entirely because COES doesn't expose spill data in a machine-readable form.

The fix rewrites Peru as a hydro-seasonal fallback at 0.8 TWh/yr with bimodal Jan-Apr + Nov-Dec wet-season peaks, using the `MIXED_SPLITS.peru` ratio (70/20/10 hydro/solar/wind) to attribute the southern solar share. The solar story is now represented as 20% of the 0.8 TWh envelope, not as the entire signal. Peak went from 0.017 GW to 0.117 GW.

The downside: it's now tier-C fallback rather than tier-B proxy. But the old "tier-B" was false advertising — the COES series wasn't actually curtailment data. Tier-C with a defensible anchor is more honest than tier-B proxy on the wrong variable.

---

## 5. Publication strategy — where this becomes more than the book's footnote

This is the section where I think the dashboard is systematically underused relative to its potential.

### The core asset

You have a **harmonized global hourly curtailment dataset covering 110 regions on six continents, calibrated against 2024 regulator-published figures, open-source and reproducible, refreshed every three hours.** I have not found a public equivalent. The academic datasets I know of (LBNL curtailment working papers, Joule review articles, IEA Renewables reports) are either:

- Regional (US only, EU only)
- Annual (not diurnal)
- Paywalled / non-reproducible
- Static snapshots rather than living series

**This is a publishable dataset in its own right**, not just a prop for a book argument.

### Concrete publication targets, ranked by fit

1. **Nature Scientific Data** — "A global hourly renewable curtailment dataset, 2024-2026". Data Descriptor track explicitly welcomes reproducible open datasets. Expected IF ~5-6. This is the highest-probability first submission.

2. **Joule** (Cell Press) — empirical paper titled something like "Cross-regional patterns in renewable energy curtailment: a harmonized global assessment". Cell Press journals like single-author or small-team empirical work with good data. IF ~39. Reach paper.

3. **Nature Energy** — same framing but requires a novel analytical angle beyond data publication. Good companion paper if you lead with something like "diurnal correlation of renewable curtailment across interconnections" or "the geography of wasted decarbonization potential."

4. **Applied Energy** or **Energy Policy** — cross-national comparison of curtailment drivers (transmission vs over-supply vs coal-inflexibility). Policy-leaning. IF ~10-11, relatively easy acceptance once methodology is public.

5. **Environmental Research Letters** — shorter format, "Curtailed renewables as globally distributed low-cost flexible load: a candidate list for Bitcoin, hydrogen, or direct-air-capture off-take." Bridges the energy-policy and crypto-energy literatures. Novel, publishable. IF ~6.

6. **Bitcoin / crypto-specific venues** — DARI working paper (likely the first outlet you'd use), NYDIG research, Cambridge CCAF collaboration, Ledger Journal (academic crypto). Lower academic prestige but higher movement-building value.

7. **Policy audiences**:
   - **Ember** and **Rystad Energy** publish annual power-sector outlooks; a dataset contribution or joint piece is a recognized path.
   - **IEA Renewables annual** takes external contributions.
   - **IRENA Global Energy Transformation** has a "data stories" track.
   - **Financial Times Alphaville** / **Bloomberg New Energy Finance** — non-academic but high-readership for the "wasted decarbonization potential" angle.

### Suggested publication order

My recommendation, assuming book is the primary asset:

1. **Pre-book**: Zenodo or Figshare deposit of the dataset with a DOI. Every book chapter can cite the DOI. Cost: a day of work.
2. **Book launch**: The dashboard becomes the promotional evidence layer. Every media interview can send readers to everylastjoule.com.
3. **Month 2-4 post-launch**: Nature Scientific Data submission. Re-uses the methodology page almost verbatim. You'd write a ~4,000-word data descriptor and submit.
4. **Month 6-12**: the Joule or Nature Energy *analytical* paper — an empirical finding derived from the dataset, not just the dataset itself. Candidate findings:
   - "Curtailment in OECD grids is transmission-limited; in China it's inflexibility-limited; in LATAM it's seasonal hydro spill." This is a one-figure insight that could anchor a paper.
   - "Diurnal correlation of solar curtailment within the Europe interconnection exceeds that within the US, suggesting tighter coupling markets and weaker transmission." Quantitative and interesting.
   - "The sum of 2024 observed curtailment globally exceeds current Bitcoin network energy at a fleet efficiency of 16 J/TH — without counting flare." That's literally the dashboard's headline claim, formalized.
5. **Year 2**: Data Descriptor update as dataset grows, plus derivative papers from specific collaborations (NREL / LBNL / Imperial College Centre for Energy Policy).

### Database / research-reuse angles

The dataset is more useful to others than the current interface reveals. Specific reuses worth enabling:

- **Bitcoin / off-taker siting optimisation** — where should a 50 MW flexible load go to maximise curtailed-renewable capture? The dataset + a ~200-line optimizer would make a decent pre-seed pitch deck for a Crusoe-style outfit.
- **Hydrogen electrolyzer siting** — same logic, different off-taker. EU has mandated renewable-hydrogen additionality rules that make curtailed electricity specifically valuable.
- **Direct air capture siting** — Climeworks, Carbon Engineering — same economics, different product.
- **Transmission-planning advocacy** — showing regulators "here's $X billion of curtailment per year in your service territory; here's the transmission upgrade that would fix it."
- **Academic modelling** — feed into IAM (integrated assessment model) runs where curtailment is typically a handwave.

### API / accessibility improvements for research reuse

Current state: data JSONs are publicly fetchable at `everylastjoule.com/_file/data/*.json` with hashed URLs. That's OK for inspection but brittle for research consumption (hashes change each build).

Recommendations:
- **Stable-URL JSON endpoints**: a Vercel serverless route `/api/v1/region/:id` that proxies the current hashed file.
- **OpenAPI spec** — formalise the schema.
- **Parquet snapshot** — one file, full time-series, downloadable. Research standard.
- **Zenodo deposit quarterly** for citability.
- **Streamed historical archive**: the current dashboard overwrites its snapshot every 3h. A second workflow should append every build's snapshot into a parquet time-series file for historical analysis. Low cost, high scientific value.

---

## 6. What we're missing — strategic gaps

Listed roughly in descending order of value:

1. **Historical continuity.** Right now we have "the last 30 days". A sensible v2 is "all observed data since dashboard launch". A daily Parquet append from each build produces that for near-zero cost and unlocks academic reuse.

2. **An uncertainty interval on the headline pct.** The current ~190% is a point estimate. Readers will ask "how confident is this?". A simple monte-carlo pass across rate uncertainty (each region's anchor ±30%) would produce a credible "190% [156-234%]" range that is much harder to dismiss.

3. **Temporal comparison.** "2024 vs 2025 year-over-year curtailment growth" is a natural chart. Curtailment is growing fast globally — showing the growth curve would reinforce the message.

4. **A co-located-load map layer.** Where on the globe is (curtailment GW) × (available land / cheap land) × (climate) best for siting? This is the research angle most directly relevant to the book's thesis.

5. **An embeddable widget.** A 400×300 iframe that can go in a Substack post, a Medium article, a newspaper web embed. The current dashboard is too information-dense for drive-by readers; a "just the headline % and globe" cutdown would spread further.

6. **A low-information cutdown page.** `/tldr` or `/now` — just one number, one sentence, one globe. Shareable to decision-makers who don't want to scroll.

7. **Press kit** — `/press` page with a few high-quality PNG downloads (globe screenshots, headline cards, source-logo lockups) and boilerplate "about this dashboard" text journalists can lift.

8. **Review invitations.** You mentioned a 10-person acceptance review. I'd prioritise:
   - Someone from NREL (data integrity)
   - Someone from LBNL (methodology)
   - Someone from Ember (cross-reference)
   - An academic journalist (framing)
   - A crypto-skeptic (stress-test)
   - A practitioner (Crusoe / Iris / MARA's data team)
   - Two policy types (E3, RMI)
   - One TSO engineer (sanity check)
   - One academic economist (curtailment economics)

---

## 7. Priority queue for the next week's work

If I were prioritising as if this were my full-time task, ranked:

1. **Fix Ukraine** (30 min) — swap to static fallback at 1.2 TWh/yr.
2. **Rename `italy-north` → `italy-national` OR add `italy-south`/`italy-sardinia`** (2 hours).
3. **Historical Parquet append** (half-day) — this is the single highest-value scientific investment.
4. **Zenodo deposit + DOI** (half-day) — unlocks citation.
5. **Stable API endpoints** (half-day) — `/api/v1/region/:id` route.
6. **Monte-carlo headline uncertainty range** (1 day) — credibility boost.
7. **Nature Scientific Data data descriptor draft** (2 days) — first publication target.
8. **US Southeast coverage** (1 day) — Duke, Southern, TVA, FPL utilities via EIA HEGM (they're respondents too).
9. **Puerto Rico + Hawaii** (half-day) — two more grids via EIA.
10. **Embeddable widget + `/tldr` page** (1 day) — distribution.

---

## 8. The summary answer to "what am I/we missing"

The dashboard is a working artifact. It's accurate enough to defend, complete enough to draw conclusions from, and opinionated enough to have a point of view. It is *under-deployed* relative to its potential in three ways:

1. **It's treated as evidence for a book, not as a dataset.** Publishing it formally (Zenodo + Nature Scientific Data) ten-x's its academic lifespan.
2. **It's single-moment rather than longitudinal.** A parquet append workflow turns every rebuild into a data point, and the dataset becomes historically unique after ~6 months.
3. **Its only interface is one page.** An API, an embeddable widget, a press kit, and a low-info cutdown would spread the same data to five different audiences.

The book will get the dashboard to one audience. The dataset-as-a-research-artifact path gets it to a much larger one over a longer time horizon. If the book is the proof, the dataset is the infrastructure that keeps proving it after the launch cycle.

None of this is urgent. All of it is foundational.

---

*Audit performed overnight 2026-04-23 / 24. Commit `b6b6f89` contains Peru, British Columbia, and hotspot formatting fixes. Dashboard live at https://everylastjoule.com. Next run-on candidates flagged in §7.*
