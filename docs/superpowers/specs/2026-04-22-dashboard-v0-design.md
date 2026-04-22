---
title: Every Last Joule Dashboard - v0 Design
date: 2026-04-22
status: draft-for-review-v2
author: Simon Collins (with Claude)
revision_history:
  - 2026-04-22 v1: initial spec, four-week plan, daily-aggregate data, seven live grids, no globe or timeline.
  - 2026-04-22 v2: Direction B confirmed. Port the Stacked design artefact as v0. Six-week plan. Sub-hourly per-region profiles. Flared-gas layer included. Interactive 24h globe and timeline. Branding TBD.
---

# Every Last Joule Dashboard - v0 Design

*Design document for the first shippable version of the Every Last Joule dashboard. v2 revises v1 to adopt the Stacked design artefact (`~/Desktop/Wasted and Curtailed/`) as the v0 target, replacing the modelled profile functions with real sub-hourly data from live grid APIs.*

---

## Purpose

Build a public interactive dashboard that aggregates globally wasted electricity (renewable curtailment, negative-priced generation, and flared gas) and shows the proportion of the Bitcoin network that the waste could power - refreshed daily and visualised across a 24-hour globe cycle. The dashboard is the live proof of the central arithmetic in *Every Last Joule: How Bitcoin Meets Energy Where It Is*.

Three functions:

1. **Evidence layer for the book.** The book's central claim - that current global curtailment plus flared gas is on the order of, or exceeds, the Bitcoin network's annual energy consumption - is shown live and visualised.
2. **Platform-building asset.** Press-worthy on its own merit. No one has publicly built a global-aggregate real-time waste-to-hashrate visualisation with a solar-block-following globe.
3. **Methodology artefact.** The code, data loaders, and calculation module are themselves part of the methodology. Every number is source-linked; every calculation is reproducible; every limitation is named.

---

## Success criteria for v0

Simon can share the URL with ten people (an acquiring editor, Daniel Batten, Troy Cross, Natalie Brunell, a mainstream-energy journalist, a handful of trusted Bitcoin readers) and every one of them understands the book's central claim in under 30 seconds of viewing. The dashboard survives methodological scrutiny from a grid operator or an energy economist reading it cold.

---

## Scope

### Ships in v0

1. **Interactive 24-hour globe visualisation.** Dotted canvas globe with day/night terminator, slow auto-rotation, drag-to-spin. Regional hotspots sized by current wasted GW. Teal for renewable curtailment, orange for flared gas.
2. **Big headline readout.** Eyebrow + large `X.X%` tabular number + supporting sentence. Blended framing: design-punch plus spec-honesty.
3. **Active-hotspots leaderboard.** Right-panel list of regions sorted by current wasted GW. Dot + name + GW.
4. **24-hour timeline strip.** Bottom-of-screen sparkline of global total wasted GW by UTC hour. Play / pause, speed (0.5×, 1×, 2×, 4×), scrub-by-pointer, current-hour orange marker.
5. **Methodology modal.** Per-region source and cadence notes, calculation, assumptions, limitations. ASIC-efficiency reference panel.
6. **Stacked design system ported.** `colors_and_type.css` + Gotham fonts (16 weights) + layout motifs + typographic scale. Branding (logo, wordmark, headline phrasing identity) to be decided separately.
7. **Seven live sub-hourly grids.** ERCOT, CAISO, AEMO, ENTSO-E (returning Iberia, Germany, Finland sub-regions), National Grid ESO, CEN Chile, ONS Brazil.
8. **Flared-gas layer.** Four top basins as flat 24/7 baselines: Permian, W. Siberia, S. Iraq, E. Saudi. Sourced from VIIRS Nightfire + World Bank GGFR.
9. **Static regional estimates.** China Sichuan (hydro), China Xinjiang (solar), Iceland (stranded geothermal), Northern Norway (stranded hydro). Sourced from Ember China, published studies.
10. **Global anchor.** Ember + IEA published totals + CBECI network consumption, refreshing as reports land.
11. **Author link.** Bio / Substack / DARI / book pre-order slot.
12. **Daily scheduled rebuild.** GitHub Actions cron runs once per day: fetches sub-hourly data per region, time-of-day-averages across the last 30 days, commits snapshot, rebuilds, deploys.

### Waits for v1

- Historical time-series pages (7d, 30d, YTD)
- Embeddable widgets for journalists
- Public API
- Negative-price event log (searchable history)
- What-if calculator
- Luxor Hashrate Index overlay
- Japan, India, Africa, other MENA live integration
- 2050 NZE projection scenarios
- Sub-daily push updates (currently daily rebuild is sufficient)
- "Latest 24h" toggle (v0 uses 30-day time-of-day average only)

---

## Regions in v0

Every displayed region maps to a data tier. Each tier has a different update cadence and a different labelling convention in the methodology panel.

### Tier 1 - Live sub-hourly (real 24h profile)

| Region | Source API | Source cadence |
|---|---|---|
| California (CAISO) | OASIS API | 5-minute |
| Texas (ERCOT) | ERCOT public-data-portal API | 5-minute |
| South Australia (AEMO) | NEMWeb CSV | 5-minute |
| Iberia (ENTSO-E Spain) | Transparency Platform API | Hourly |
| Germany (ENTSO-E) | Transparency Platform API | Hourly |
| Finland (ENTSO-E) | Transparency Platform API | Hourly |
| North Sea (National Grid ESO) | Elexon BMRS | Half-hourly |
| Atacama (CEN Chile) | Coordinador public portal | Hourly |
| Brazil NE (ONS) | ons.org.br open data | Hourly |

Nine regions delivered through seven APIs (ENTSO-E covers three).

### Tier 2 - Static annual

| Region | Source | Cadence |
|---|---|---|
| Sichuan (hydro) | Ember China, S&P Global | Annual / on-publication |
| Xinjiang (solar) | Ember China | Annual / on-publication |
| Iceland (stranded geothermal/hydro) | Published studies | Annual |
| Northern Norway (stranded hydro) | Nord Pool, published | Annual |

### Tier 3 - Flared gas (flat 24/7)

| Region | Source | Cadence |
|---|---|---|
| Permian Basin (USA) | VIIRS Nightfire + World Bank GGFR | Monthly (VIIRS), annual (GGFR) |
| W. Siberia (Russia) | VIIRS + GGFR | Monthly / annual |
| S. Iraq | VIIRS + GGFR | Monthly / annual |
| E. Saudi Arabia | VIIRS + GGFR | Monthly / annual |

**Rationale for flare in v0.** Flared gas is close to pure base load - it burns 24/7 regardless of solar or wind conditions. Included in v0 because it complements curtailment's peakiness and is necessary for the headline to represent the full "waste stream" honestly.

### Global anchor (Layer 1)

- Ember Global Electricity Review (global wind + solar generation, regional curtailment aggregates) - quarterly.
- IEA Renewables (global curtailment rates, by-country) - annual.
- Cambridge CBECI (Bitcoin network hashrate, annualised consumption) - ~daily.

---

## Stack

**Observable Framework** (Apache 2.0, self-hosted) + **Vercel** static deployment + **GitHub Actions** daily data refresh + **React** for the interactive components ported from the design artefact.

### Why Observable Framework plus React

- Observable Framework's data-loader pattern is a clean fit for the daily-build model: a TypeScript file under `src/data/` runs at build time, its output is bound into the page.
- The design artefact is already React. Porting React components into Observable Framework pages via ESM imports is straightforward. Rewriting to Observable's native `html` / `Mutable` idiom is ~1-2 weeks of additional work and not required for v0.
- Static output deploys to Vercel free.
- Typography is CSS, not template-locked - the ported Stacked design system applies directly.
- The data-loader scripts are the methodology, in plain view in the repo.

### What we are NOT doing

- **Not rewriting React components to vanilla.** Ship-speed priority.
- **Not running a backend service.** Daily rebuild handles the update cadence; a backend is only required when sub-daily real-time or a public API is needed.
- **Not using Streamlit / Dash / Panel.** Typography and layout would not match the book register.

---

## Architecture and data flow

### Layer 1 - Global anchor

Inputs: Ember + IEA published totals (numerator context), CBECI (denominator).

Output: the global headline ratio's anchor values; consumed by `aggregate.ts`.

### Layer 2 - Live sub-hourly grids

Each loader performs the same sequence:

1. Fetch last 30 days of sub-hourly curtailment (and negative-price hours where separately reported) from the region's API.
2. Parse into a time-series of `(utcTimestamp, curtailmentMW)` points.
3. Compute a **30-day time-of-day average** per region: for each of the 24 hours of the day, average the values across the 30-day window. Produces a representative 24h profile.
4. Also compute rolling-12-month total TWh and peak hourly GW.
5. Write out as `{region_id, profile: [24 numbers in GW], totalTWh, peakGW, lastUpdated}` to `data/snapshots/YYYY-MM-DD/<region>.json`.

**Why 30-day time-of-day average rather than "latest 24h":**

- Smooths one-off anomalies (storm outages, maintenance events).
- Produces a representative curve that a user scrubbing through 24 hours sees as "the typical solar block" rather than "this specific day's noise".
- Updates daily as the 30-day window slides.
- Methodology page explicitly labels: *"Displayed curves are the last 30 days averaged by time-of-day. Not a single specific day."*

A "latest-24h" toggle is out of scope for v0; can land in v0.5.

### Layer 3 - Static regions and flare

Each region outputs `{region_id, annualTWh, flatGW: annualTWh * 1000 / 8760, source, lastUpdated}`. Rendered as a flat horizontal line in the 24h profile.

Flare layer specifically:
- VIIRS Nightfire (NOAA) provides monthly global flare detections with radiant heat, which correlates with volume. Converted to approximate gas volume via published calibration.
- World Bank GGFR provides annual per-country totals - ground-truth.
- v0 uses GGFR annual totals as the magnitude, VIIRS as cross-check and update signal. If VIIRS integration proves complex, v0 can ship with GGFR-only (annual update cadence) and add VIIRS in v0.5.

### Calculation

Per-region wasted power at UTC hour `h`:

```
region_GW(h) = profile[floor(h)]            # Tier 1: live 24h profile
             = flatGW                        # Tier 2 / Tier 3: flat baseline
```

Global total wasted power at UTC hour `h`:

```
total_GW(h) = sum over regions of region_GW(h)
```

Hashrate supportable by the waste at hour `h`, at reference ASIC efficiency `eff` in J/TH:

```
hashrate_EHps(h) = total_GW(h) * (1000 / eff)
```

Headline percentage at hour `h`:

```
pct(h) = hashrate_EHps(h) / CBECI_hashrate_EHps * 100
```

**ASIC reference:** `eff = 16 J/TH` for the primary "current fleet" readout (matches the design's value and the CBECI-implied fleet average). Methodology panel shows the result at 28.5 J/TH (CoinMetrics field-weighted) and at 15 J/TH (2028 projection) as a range.

**CBECI hashrate:** pull current estimate daily from Cambridge. Do not hardcode. The design's `GLOBAL_HASHRATE_EHS = 780` is a snapshot - replace with live value.

### Data-snapshot convention

Every daily run writes a dated directory to `data/snapshots/YYYY-MM-DD/` containing one JSON file per region plus an `aggregate.json`. All are git-committed on every daily refresh. Audit trail for methodology; also the cheapest possible historical data store. Storage overhead: ~200-400 KB/day (higher than v1's estimate because sub-hourly payloads are larger). Tractable in git for several years.

---

## Visual design and components

### Design system

The Stacked design system ports directly:

- `colors_and_type.css` becomes `src/style.css` unchanged.
- All 16 Gotham font files copy to `src/fonts/`.
- CSS custom properties (`--teal-500`, `--slate-800`, `--fs-display`, `--ls-caps`, etc.) drive everything.
- Layout motifs: eyebrow (ALL CAPS, teal, `ls-caps`) → big tabular number → supporting paragraph; methodology modal pattern; icon-and-logo placement in the header.
- Color coding locked: teal for renewable curtailment, `--btc-orange` for flared gas, slate family for chrome.

### Component inventory (from design, ported)

| Component | Role |
|---|---|
| `WastedEnergyApp` | top-level composition |
| `Globe` | 3D dotted canvas globe with day/night terminator and regional hotspots |
| `TimelineStrip` | 24h sparkline of global total wasted GW + scrub + current-hour marker |
| `RegionList` | active-hotspots leaderboard, sorted by current GW |
| `HeadlineReadout` | big `X.X%` + hashrate + wasted-now readouts |
| `Methodology` | modal overlay with sources, caveats, region table |
| `Controls` | play / pause / speed / UTC label |

### Branding

Decided separately by Simon. v0 placeholder: working title only in the header. Before the launch copy-pass (Week 6), Simon delivers:

- Logo / wordmark
- Project name for public display
- Short tagline

In the interim the repo uses `every-last-joule-dashboard` as the working name.

---

## Voice and copy

Every user-facing string passes through the `simonizer` skill with a manual review. Conventions unchanged from v1 (NZ English, " - " dashes, straight/curly quotes per context, serial comma, no emojis, soft qualification + hard verdict, no hype vocabulary).

### Blended headline framing

Eyebrow: `Sustainable hashrate · unlocked`

Big number: `X.X%`

Supporting sentence: `of today's Bitcoin network, powered entirely by energy that was observed curtailed, spilled, or flared in the last 30 days. A floor, not a ceiling - self-curtailment and several regions are not yet captured.`

Rationale: the eyebrow and the noun-phrase come from the design (punch). The "observed in the last 30 days" and the "floor, not a ceiling" come from the spec (accuracy). Every specific figure is checkable against the methodology page.

### Methodology-page copy

Every region card: source name, source URL, source cadence, peak GW, trailing-12-month TWh, one-line provenance / known quirks. A paragraph on the ASIC-efficiency choice. A paragraph on the 30-day time-of-day averaging choice. An explicit limitations section (self-curtailment, geographic concentration, ASIC divergence between CBECI and CoinMetrics, flare estimation uncertainty).

---

## Project structure

```
~/code/every-last-joule-dashboard/
├── README.md
├── LICENSE
├── package.json
├── observablehq.config.ts
├── .github/workflows/
│   ├── data-refresh.yml          # daily cron: fetch, commit snapshot, rebuild, deploy
│   └── deploy.yml                 # on push to main
├── src/
│   ├── index.md                   # dashboard home (embeds the React app)
│   ├── methodology.md             # longform, source-linked
│   ├── about.md                   # author card, book register copy
│   ├── components/                # React components ported from design
│   │   ├── WastedEnergyApp.jsx
│   │   ├── Globe.jsx
│   │   ├── TimelineStrip.jsx
│   │   ├── RegionList.jsx
│   │   ├── HeadlineReadout.jsx
│   │   ├── Methodology.jsx
│   │   ├── Controls.jsx
│   │   └── SourceLink.jsx
│   ├── data/                      # Observable Framework data loaders (run at build)
│   │   ├── ember.ts               # Layer 1
│   │   ├── iea.ts                 # Layer 1
│   │   ├── cbeci.ts               # Layer 1 (denominator + hashrate ref)
│   │   ├── ercot.ts               # Layer 2 live sub-hourly
│   │   ├── caiso.ts               # Layer 2
│   │   ├── aemo.ts                # Layer 2
│   │   ├── entsoe.ts              # Layer 2 (returns Iberia, Germany, Finland)
│   │   ├── eso.ts                 # Layer 2 - National Grid ESO
│   │   ├── cen.ts                 # Layer 2 - Chile
│   │   ├── ons.ts                 # Layer 2 - Brazil
│   │   ├── china-static.ts        # Layer 2 static
│   │   ├── iceland-norway-static.ts
│   │   ├── flare-viirs.ts         # Layer 3 - Permian, W. Siberia, Iraq, Saudi
│   │   ├── regions.ts             # canonical list: id, name, lat/lon, tier, kind
│   │   └── aggregate.ts           # headline ratio + per-hour + per-region aggregation
│   ├── fonts/                     # Gotham TTF files (16 weights, copied from design)
│   └── style.css                  # ported from design: colors_and_type.css
├── data/
│   └── snapshots/YYYY-MM-DD/      # git-tracked daily snapshots (sub-hourly per region)
├── lib/
│   ├── calc.ts                    # pure calculation module (testable)
│   └── profile.ts                 # 30-day time-of-day averaging logic
├── tests/
│   ├── calc.test.ts
│   └── profile.test.ts
├── docs/
│   ├── superpowers/specs/         # design docs (including this file)
│   ├── calculation-notes.md       # working notes for Simon's review
│   ├── data-source-log.md         # per-source status, quirks, access agreements
│   └── known-limitations.md       # shared between repo docs and user-facing page
└── scripts/
    ├── validate-calc.ts           # end-to-end sanity check
    └── snapshot-diff.ts           # anomaly detection on daily data
```

### Structural choices worth naming

- **Components ported as JSX.** Minimises rework of the design artefact. Observable Framework imports them at build time.
- **`data/snapshots/` is git-committed** and now includes per-region sub-hourly arrays. Expected to grow ~200-400 KB/day; plan to archive or prune after 12-24 months if size becomes unwieldy.
- **`lib/calc.ts` and `lib/profile.ts` are pure modules** separated from the site. Unit tests run against them. The site is a thin presentation layer. Future API can call them directly.

---

## Six-week plan to v0

Week-by-week shape. Day-by-day implementation plan produced separately via the writing-plans skill and reviewed before coding starts.

### Week 1 - Foundations, design system, first live region

- Repo, hosting, Observable Framework scaffold, React integration path validated.
- Port `colors_and_type.css` to `src/style.css`. Copy all 16 Gotham font files. Confirm typography renders.
- ERCOT sub-hourly loader: last 30 days 5-min curtailment → time-of-day average → 24h profile.
- `lib/calc.ts` and `lib/profile.ts` with unit tests.
- `HeadlineReadout` component with placeholder data piped through `calc.ts`.
- GitHub Actions daily cron running end-to-end.
- **Checkpoint:** ERCOT profile visible on a dark-themed page in Stacked typography; daily refresh pipeline green.

### Week 2 - North America, Oceania, Europe live

- CAISO sub-hourly loader (OASIS API - historically slow; defensive retries, cache).
- AEMO sub-hourly loader (NEMWeb CSV).
- ENTSO-E sub-hourly loader - Spain, Germany, Finland in one API call (register API key Day 1 of Week 2).
- Wire live data through to the aggregate and the `HeadlineReadout`.
- **Checkpoint:** six live regions feeding; global profile curve visible (console + basic canvas strip).

### Week 3 - South America, UK, static regions, flare

- National Grid ESO loader (Elexon BMRS half-hourly).
- CEN Chile loader (Coordinador public portal - Spanish docs, budget full day for schema reading).
- ONS Brazil loader (Portuguese docs - budget extra time for *restrição de operação* classification).
- China static loader (Ember + S&P).
- Iceland + N. Norway static loaders (published studies).
- **Flared-gas loader:** VIIRS Nightfire + GGFR. Four basins, flat 24/7 profile. If VIIRS proves complex within the week, ship with GGFR annual only and defer VIIRS cross-check to v0.5.
- **Checkpoint:** all regions loaded; aggregate calculation running; global profile curve shape matches bottom-up expectations.

### Week 4 - Globe rendering

- Port `Globe.jsx` from the design artefact.
- Canvas rendering: sphere of dots, land mask, day/night terminator based on UTC hour, slow rotation, drag-to-spin.
- Regional hotspot projection: lat/lon → screen coordinates; dot sized by current GW; color by renewable (teal) vs flare (orange).
- Wire `utcHour` state in from `WastedEnergyApp`.
- **Checkpoint:** globe renders with all regions as live hotspots; dragging spins the globe; hotspots update as `utcHour` changes.

### Week 5 - Timeline, leaderboard, controls

- Port `TimelineStrip.jsx`: 24h sparkline of global total GW, current-hour marker, scrub-by-pointer.
- Port `RegionList.jsx`: sorted active-hotspots leaderboard.
- Port `Controls.jsx`: play / pause / speed (0.5×, 1×, 2×, 4×), UTC label.
- Port the `useSmooth` animated counter into `HeadlineReadout`.
- State-machine integration: `utcHour` drives everything.
- **Checkpoint:** fully interactive dashboard with real data.

### Week 6 - Methodology, voice, launch

- `Methodology.jsx` modal ported and populated with real per-region provenance, cadence, and caveats.
- Blended headline copy applied.
- Limitations section (self-curtailment, geographic concentration, ASIC divergence, flare estimation).
- `simonizer` pass on all user-facing strings; manual voice review.
- Typography, mobile responsive, accessibility check.
- Acceptance review against v0 success criterion (ten-person sharable test).
- Soft launch to the ten-person test group.

---

## Risks

1. **Sub-hourly data volume.** 30 days × up-to-5-min cadence = ~8,640 rows per region. Across nine live regions, ~78k rows per daily snapshot. Compressed JSON handles this, but API rate limits matter. **Mitigation:** single daily fetch, aggressive caching, defensive retries, per-region back-off.
2. **Grid API access friction.** CEN and ONS remain highest-risk - Spanish and Portuguese documentation, less standardised schemas. **Mitigation:** full-day schema-read before loader development; CSV-ingest fallback if APIs prove unworkable within the sprint.
3. **ENTSO-E registration gating.** Free but requires account + API key. **Mitigation:** register on Day 1 of Week 2.
4. **VIIRS data access and interpretation.** NOAA's format is non-trivial. **Mitigation:** fall back to GGFR annual if VIIRS proves unworkable in Week 3; add VIIRS cross-check in v0.5.
5. **ASIC-efficiency anchor.** 16 J/TH vs 28.5 J/TH produce very different headlines. **Mitigation:** primary readout uses 16 J/TH (CBECI-implied fleet, matches design); methodology panel shows the range 15-28.5 J/TH and cites the sources for each.
6. **React in Observable Framework.** Not the native idiom. **Mitigation:** keep React for v0 via ESM import; refactor to native idiom only if v1 pressure requires.
7. **Scope creep.** One-more-thing-for-launch risk, greater at six weeks than four. **Mitigation:** the scope list above is fixed; anything not listed ships in v0.5 unless explicitly renegotiated.
8. **Flare data freshness.** VIIRS ~monthly, GGFR annual. Flare baseline is static vs curtailment. **Mitigation:** methodology explicitly labels flare as "annualised baseline, not daily"; user-facing tooltip shows last-update timestamp per region.
9. **Branding handoff.** Brand identity lands Week 6 at latest. **Mitigation:** all brand-related strings and assets centralised under a `brand.ts` config so swapping is a one-hour task.

---

## Out of scope for v0 (explicit)

- Sub-daily real-time push updates (daily rebuild sufficient)
- Historical time-series pages (7d, 30d, YTD charts)
- Public API
- Embeddable widgets
- Negative-price event log (searchable history)
- What-if calculator
- Luxor Hashrate Index overlay
- Japan, India, Africa, other MENA live integration
- 2050 NZE projection scenarios
- "Latest 24h" toggle (v0 uses 30-day time-of-day average only)
- Native-idiom Observable Framework rewrite of the React components

---

## Admin defaults (confirmed)

- **Working project name (repo, until branding arrives):** `every-last-joule-dashboard`
- **Repo location:** `~/code/every-last-joule-dashboard/`
- **Deployment URL (v0):** Vercel preview URL; swap to registered domain when available.
- **Aggregation window for Tier 1 profiles:** 30-day trailing time-of-day average per region.
- **ASIC-efficiency reference:** 16 J/TH primary; 15 J/TH (2028) and 28.5 J/TH (CoinMetrics) shown in methodology.
- **Repo visibility:** private during development, flip to public before launch.
- **Branding:** TBD; Simon delivers logo / wordmark / name / tagline by Week 6.

---

## Next steps

1. Simon reviews this revised spec. Any changes, redirect before the next step.
2. On approval, transition to the writing-plans skill to produce a day-by-day implementation plan for the six-week build.
3. Implementation starts only after the plan is approved.
