---
title: Every Last Joule Dashboard - v0 Design
date: 2026-04-22
status: draft-for-review
author: Simon Collins (with Claude)
---

# Every Last Joule Dashboard - v0 Design

*Design document for the first shippable version of the Every Last Joule dashboard. Drafted 22 April 2026. Approved scope and stack captured below; implementation plan produced separately via the writing-plans skill.*

---

## Purpose

Build a public dashboard that aggregates globally wasted electricity (renewable curtailment, negative-priced generation, and flared gas) and shows the proportion of the Bitcoin network that the waste could power, refreshed daily. The dashboard is the live proof of the central arithmetic in *Every Last Joule: How Bitcoin Meets Energy Where It Is*.

The long-term scope covers all three waste categories. **v0 narrows to renewable curtailment only**; negative-priced generation (where it is distinct from curtailment) and flared gas are explicitly deferred to v0.5 / v1.

Three functions:

1. **Evidence layer for the book.** The book's central claim - that current global curtailment alone is on the order of the Bitcoin network's annual energy consumption, and at 2028 ASIC efficiencies exceeds it - is shown live.
2. **Platform-building asset.** Press-worthy on its own merit (no one has publicly built a global-aggregate waste-to-hashrate visualisation). Each press cycle builds author platform ahead of book submission.
3. **Methodology artefact.** The code and data loaders are themselves part of the methodology. Every number is source-linked; every calculation is reproducible; every limitation is named.

---

## Success criteria for v0

Simon can share the URL with ten people (an acquiring editor, Daniel Batten, Troy Cross, Natalie Brunell, a mainstream-energy journalist, a handful of trusted Bitcoin readers) and every one of them understands the book's central claim in under 30 seconds of viewing. The dashboard survives methodological scrutiny from a grid operator or an energy economist reading it cold.

---

## Scope

### Ships in v0

1. **Global headline ratio.** `X% of the Bitcoin network could be powered by current global renewable curtailment.` Anchored to published global totals (Ember Global Electricity Review, IEA Renewables) plus a live aggregate of seven grids. Denominator is CBECI current consumption.
2. **Three-layer data architecture:**
   - **Layer 1 - global anchor.** Ember and IEA published totals; CBECI current consumption. Refreshes as reports land (quarterly for Ember, ~daily for CBECI).
   - **Layer 2 - live contributing grids.** Seven live-API grids covering North America, Europe, Oceania, and South America. Daily refresh.
   - **Layer 3 - static regional estimates.** China (Ember China, S&P), US broader (EIA for PJM/MISO/ISO-NE/SPP), labelled with latest publication date. Refreshes quarterly or annually as source reports land.
3. **Seven live-API grids:**
   - CAISO (US West, OASIS API)
   - ERCOT (US Central, ERCOT public-data-portal API)
   - AEMO (Australia NEM, NEMWeb CSV)
   - ENTSO-E Transparency (aggregate Europe including Germany, France, Spain, Finland, Netherlands, Denmark, Poland)
   - National Grid ESO (UK, Elexon BMRS)
   - CEN (Chile, Coordinador Eléctrico Nacional public portal)
   - ONS (Brazil, Operador Nacional do Sistema open data)
4. **2028 projection panel.** Same ratio at 15 J/TH implied fleet efficiency. Mirrors the book's forward arithmetic.
5. **Methodology page.** Longform, source-linked, per-source cadence notes, explicit limitations section.
6. **Author card.** Bio, Substack, DARI, book pre-order slot.
7. **Source-linked numbers.** Every displayed figure tooltips or links to its primary source.
8. **Daily scheduled rebuild.** GitHub Actions cron triggers data fetch, commits a snapshot, rebuilds the site, redeploys.

### Waits for v0.5 / v1

- Sub-daily real-time updates
- Solar-block-following visualisation
- Flared-gas layer (VIIRS)
- Stranded-hydro estimates
- Public API
- Embeddable widgets for journalists
- Negative-price event log
- What-if calculator
- Luxor Hashrate Index overlay
- Japan, India, MENA coverage
- Time-series charts (24h, 7d, 30d, YTD)

---

## Stack

**Observable Framework** (Apache 2.0, self-hosted) + **Vercel** static deployment + **GitHub Actions** scheduled data refresh.

### Why Observable Framework

- Data loaders are a first-class concept. A TypeScript file under `src/data/` runs at build time and its output is bound to the page. GitHub Actions cron triggers the build; no glue code between fetch and render.
- First-class Observable Plot and D3 integration. v1 needs these (solar-block visualisation, time-series charts); choosing Observable Framework now means no re-platform.
- Static output deploys to Vercel, Netlify, or Cloudflare Pages free.
- Typography is CSS, not template-locked.
- The data-loader scripts ARE the methodology, in plain view in the repo. Aligns with the authorial stance that the dashboard should survive methodological scrutiny.
- v1 upgrade path is additive: add loaders, add interactive components. No rewrite.

### Why not alternatives

- **FastAPI + Next.js:** correct for v1 when sub-daily data or a public API are required; premature complexity for v0.
- **Streamlit / Dash / Panel:** typography and layout feel templated; would not match the book register.
- **Astro + Observable Plot:** broader community and more general-purpose, but costs ~2-3 days of glue code for the data-loader pattern that Observable Framework provides natively.
- **Plain static + GitHub Actions:** would require writing the data-binding layer ourselves; no benefit over Observable Framework.

---

## Architecture and data flow

### Layer 1 - global anchor

Inputs:
- **Ember Global Electricity Review** (quarterly): global wind + solar generation, regional curtailment aggregates.
- **IEA Renewables** (annual): global curtailment rates, by-country breakdowns.
- **Cambridge CBECI** (~daily): Bitcoin network annualised electricity consumption.

Output: the global curtailment anchor (from Ember / IEA) and the consumption denominator (from CBECI). These feed into the aggregate calculation described below.

### Layer 2 - live contributing grids

Seven grids, each with its own data loader in `src/data/`:

| Grid | Feed | Source cadence | Dashboard refresh |
|---|---|---|---|
| ERCOT | ERCOT public-data-portal API | 5-minute | Daily |
| CAISO | OASIS API | 5-minute | Daily |
| AEMO | NEMWeb CSV | 5-minute | Daily |
| ENTSO-E | Transparency Platform API (free registration) | Hourly | Daily |
| National Grid ESO | Elexon BMRS | Half-hourly | Daily |
| CEN Chile | Coordinador public portal | Hourly | Daily |
| ONS Brazil | ons.org.br open data | Hourly | Daily |

Output: a per-grid breakout plus the sum of live curtailment observed across the seven grids.

### Layer 3 - static regional estimates

| Region | Source | Refresh cadence |
|---|---|---|
| China | Ember China Electricity Review, S&P Global | Quarterly / on-publication |
| US broader (PJM, MISO, ISO-NE, SPP) | EIA annual | Annual |
| Other regions not yet integrated | Published press aggregates | On-publication |

Output: fills the gap between Layer 2's live aggregate and Layer 1's global total.

### Calculation

Headline ratio:

```
ratio = global_curtailment_TWh / CBECI_annualised_consumption_TWh
```

Where `global_curtailment_TWh` is the maximum of (Ember-published global total, Layer 2 live aggregate + Layer 3 static) on a trailing 12-month basis. Taking the max means that if live observation starts exceeding the latest published estimate, the dashboard honours observation rather than under-reporting.

2028 projection:

```
hashrate_supportable_2028_EHps = (global_curtailment_TWh * 1000 / 8760) * 1e9 / (15 * 1e6)
ratio_2028 = hashrate_supportable_2028_EHps / hashrate_current_EHps
```

Where `15` is the J/TH assumption for 2028 fleet efficiency, per `research/energy_arithmetic.md`.

### Data-snapshot convention

Every scheduled run writes a dated JSON blob to `data/snapshots/YYYY-MM-DD/`. The blobs are git-committed on every daily refresh. This is the methodology audit trail - a reader questioning any historical number can reconstruct the exact inputs. It is also the cheapest possible historical data store for v0. Expected overhead: ~50-100 KB/day, tractable in git for several years.

---

## Project structure

```
~/code/every-last-joule-dashboard/
├── README.md
├── LICENSE
├── package.json
├── observablehq.config.ts
├── .github/workflows/
│   ├── data-refresh.yml            # daily cron: fetch, commit snapshot, rebuild, deploy
│   └── deploy.yml                  # on push to main
├── src/
│   ├── index.md                    # dashboard home
│   ├── methodology.md              # longform, source-linked
│   ├── about.md                    # author card, book register copy
│   ├── data/                       # Observable Framework data loaders (run at build)
│   │   ├── ember.ts                # Layer 1 - global anchor
│   │   ├── iea.ts                  # Layer 1 - global anchor
│   │   ├── cbeci.ts                # network consumption denominator
│   │   ├── ercot.ts                # Layer 2
│   │   ├── caiso.ts                # Layer 2
│   │   ├── aemo.ts                 # Layer 2
│   │   ├── entsoe.ts               # Layer 2
│   │   ├── eso.ts                  # Layer 2 - National Grid ESO
│   │   ├── cen.ts                  # Layer 2 - Chile Coordinador
│   │   ├── ons.ts                  # Layer 2 - Brazil ONS
│   │   ├── china-static.ts         # Layer 3 - Ember China
│   │   ├── eia-static.ts           # Layer 3 - EIA broader US
│   │   └── aggregate.ts            # headline ratio + 2028 projection
│   ├── components/
│   │   ├── HeadlineRatio.ts
│   │   ├── GridCard.ts
│   │   ├── ProjectionPanel.ts
│   │   ├── SourceLink.ts
│   │   └── DataFreshness.ts
│   └── style.css                   # typography-first, mobile-first
├── data/
│   └── snapshots/YYYY-MM-DD/       # git-tracked daily snapshots (audit trail)
├── lib/
│   └── calc.ts                     # pure calculation module, testable in isolation
├── tests/
│   └── calc.test.ts                # regression tests on the math
├── docs/
│   ├── superpowers/specs/          # design docs (including this file)
│   ├── calculation-notes.md        # working notes for Simon's review
│   ├── data-source-log.md          # per-source status, quirks, access agreements
│   └── known-limitations.md        # shared between repo docs and user-facing page
└── scripts/
    ├── validate-calc.ts            # end-to-end sanity check
    └── snapshot-diff.ts            # anomaly detection on daily data
```

### Two structural choices worth naming

- **`data/snapshots/` is git-committed.** Every daily run appends a dated blob. Audit trail for methodology; also the cheapest possible historical data store for v0.
- **`lib/calc.ts` is a pure module separated from the site.** It takes curtailment inputs and CBECI consumption and returns the ratio. Unit tests run against this module. The site is a thin presentation layer over it. When v1 adds an API, the API calls `calc.ts` too - no duplication.

---

## Voice and copy

Every user-facing string passes through the `simonizer` skill with a final manual review. Conventions:

- **NZ / UK English** - realise, organisation, centre, programme (noun), favour, analyse, utilise, decarbonise, catalyse.
- **" - " dashes** (space-hyphen-space), not em dashes, throughout user-facing copy and this spec.
- **Straight quotes** in code; **curly quotes** in prose. **Serial comma** throughout.
- **No emojis.**
- **Voice:** quietly combative, evidence-first, methodology-transparent. Soft qualification on headline claims ("approximately", "on the order of"). Explicit limitation-as-strength framing on every number.
- **Headline framed as a floor, not a ceiling.** The number under-represents reality (self-curtailment not visible in market data; several grids and flared gas not yet integrated). Never "global waste powers X%"; always "observed global curtailment equals X% of Bitcoin network consumption, a lower bound."

---

## Four-week plan to v0

Week-by-week shape below. Day-by-day implementation plan is produced separately via the writing-plans skill and reviewed before coding starts.

### Week 1 - Foundations, global anchor, first live grid

- Repo, hosting, domain, Observable Framework scaffold, CI/CD scaffolding.
- Ember + IEA static ingest (Layer 1).
- CBECI daily loader.
- ERCOT live loader (most mature API - validates the full pipeline first).
- `lib/calc.ts` with unit tests on the aggregation math.
- GitHub Actions daily cron running end-to-end.
- **Checkpoint:** headline ratio displays from global anchor, ERCOT contributing live, daily refresh working.

### Week 2 - Americas, Oceania, Europe aggregate

- CAISO loader (OASIS API - historically slow; defensive retries required).
- AEMO loader (NEMWeb CSV).
- ENTSO-E Transparency loader (covers Germany, France, Spain, Finland, Netherlands, Denmark, Poland in one API - ENTSO-E registration completed on Day 1 of this week to avoid blocking).
- China + EIA broader-US static ingests (Layer 3).
- **Checkpoint:** four live grids plus static Layer 3; global aggregate matches bottom-up estimate within ~10%.

### Week 3 - UK, Chile, Brazil

- National Grid ESO loader (Elexon BMRS).
- CEN Chile loader (Coordinador public portal - less standardised; budget a full day for schema reading before writing the loader).
- ONS Brazil loader (Portuguese-language documentation; budget extra time for correct interpretation of *restrição de operação* / constrained-off classification).
- **Checkpoint:** all seven live grids contributing; global coverage at or above ~80% of Ember bottom-up.

### Week 4 - Methodology, voice, polish, launch

- Methodology page (longform, source-linked, per-source cadence notes, limitations section).
- 2028 projection panel.
- Author card, typography pass, mobile responsive.
- `simonizer` copy pass on all user-facing strings; manual voice review.
- Acceptance review against the v0 success criterion (ten-person sharable test).
- Soft launch to the ten-person test group with a "pre-launch, feedback welcome" note.

---

## Risks

1. **Grid API access friction.** CEN and ONS are the highest risk - Spanish and Portuguese documentation, less standardised schemas than ERCOT/CAISO. **Mitigation:** budget full days for schema exploration before writing loaders; fall back to manual CSV ingest if APIs prove unworkable within the sprint.
2. **ENTSO-E registration gating.** Free but requires account creation and API key issuance. **Mitigation:** register on Day 1 of Week 2 so there is no last-minute block.
3. **Cambridge CBECI update lag.** CBECI updates on a lag. **Mitigation:** pipeline degrades gracefully - a "data as of [date]" indicator on the page, never a hidden gap.
4. **Calculation framing.** "Global waste" is a defensible claim only if the methodology page labels the number as a floor. If ever framed as a ceiling, critics have a trivially correct counter. **Mitigation:** floor-labelling baked into the copy pass and the methodology page.
5. **Voice drift.** Default AI-generated copy reads as promotional in this register. **Mitigation:** every user-facing string passes through `simonizer` and then a manual review; acceptance criterion is that an energy economist reading the methodology page would not flag it as promotional or methodologically sloppy.
6. **Scope creep.** "One more thing for launch" is the main risk to the four-week timeline. **Mitigation:** the scope list above is fixed; anything not listed ships in v0.5 unless explicitly renegotiated.

---

## Out of scope for v0 (explicit)

- Sub-daily real-time updates
- Solar-block-following visualisation
- Flared-gas layer
- Stranded-hydro estimates
- Japan, India, MENA live integration
- Public API
- Embeddable widgets
- Time-series charts (24h / 7d / 30d / YTD)
- What-if calculator
- Luxor hashprice overlay

---

## Admin defaults (confirmed)

- **Project name:** `every-last-joule-dashboard`
- **Repo location:** `~/code/every-last-joule-dashboard/`
- **Deployment URL (v0):** `every-last-joule-dashboard.vercel.app` (swap to a registered domain when available)
- **Aggregation window:** trailing 12 months
- **Repo visibility:** private during development, flip to public before launch

---

## Next steps

1. Simon reviews this spec. Any changes, redirect before the next step.
2. On approval, transition to the writing-plans skill to produce a day-by-day implementation plan.
3. Implementation starts only after the plan is approved.
