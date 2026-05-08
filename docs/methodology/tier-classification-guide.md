# Tier Classification Guide

**File purpose:** Definitive reference for tier classification decisions.
**Authoritative source:** `src/lib/uncertainty.ts:1-48` and `docs/methodology/uncertainty.md`
**Last updated:** 2026-04-28 by Claude (research/phase1-data-audit branch)
**Status:** Active working reference — update this file when tier classifications change.

---

## Bad conversions you must reject

A region cannot be promoted from T3-modelled to T2-annual-calibrated, T1c, T1b, or T1a unless every item in this checklist evaluates to "no" for the candidate source. The checklist is a review-time discipline gate (not currently CI-enforced — `scripts/ci/check-validation-doc-bad-conversions.ts` reports a baseline citation tally; enforcement is a follow-up sprint). It functions as the demotion filter for procedural failures, parallel to the per-tier "What this does NOT accept" lists in the section below. Each of the five items below corresponds to either a past production bug or a current research-only blocker.

### 1. DSM / deviation values used as curtailment

**Failure pattern:** Treating a deviation, deviation-settlement, or DSM (demand-side management) MWh value as if it were a curtailed-energy MWh value.

**Why it's wrong:** Deviation is the gap between scheduled and actual generation, signed (over- and under-delivery both contribute). Curtailment is dispatch-down energy, unsigned, specifically the energy the operator instructed not to be produced. A deviation table can include scheduling errors, forced outages, and weather mispredictions that are not curtailment. The MWh column has the same units; the semantics differ.

**Real example:** CEA India monthly reports include a deviation table for every month and a curtailment table only when the system reported curtailment events. January 2025 has the deviation table, no curtailment table. Using the deviation total as curtailment would inflate the India anchor by an unknown factor and pollute the regional totals.

**What to do instead:** Use only the explicit curtailment table when it exists. When only the deviation table is published, the region for that month has no usable curtailment number; report it as null in the loader pipeline rather than substituting deviation. Do not coerce.

**Decision question:** Does the source publish a column or table explicitly labelled "curtailment", "constrained-off", "dispatch-down", "reduction", or jurisdiction-equivalent — and not "deviation", "DSM", "imbalance", or "settlement"?

### 2. Capacity-at-risk MW used as curtailed energy MWh

**Failure pattern:** Multiplying installed capacity (MW) by capacity factor and assumed curtailment rate to produce a "curtailment" MWh figure.

**Why it's wrong:** This is a capacity calculation with three layers of assumption (CF, rate, fleet composition) and zero measured curtailment data. The output looks like an annual MWh anchor but is functionally a guess scaled by published capacity. A region whose only "curtailment" number is `capacity × CF × rate` has no measured curtailment evidence; it has only an upper-bound capacity-implied estimate.

**Real example:** Several IRENA-derived T3 anchors and the rejected Jordan / Kenya / Morocco entries from the 2026-04-29 elevation backlog. Any T2 promotion candidate whose annual MWh figure is back-calculated from installed capacity falls here.

**What to do instead:** Demand a measured energy total from the operator or a measured estimate from a satellite or independent monitor (TSO annual report, Ember country report, GGFR satellite, IEA WEO, equivalent). If only capacity is available, the region stays T3-modelled.

**Decision question:** Is the cited annual MWh / TWh figure a measured total reported by the source, or a number we computed by multiplying capacity by assumed factors?

### 3. Instruction percentage without a generation denominator

**Failure pattern:** Treating "renewable instructions reduced by X%" or "X% of plants curtailed at peak" as an energy figure.

**Why it's wrong:** A percentage is dimensionless. Converting it to MWh requires a paired generation total covering the same time window — the denominator. Without that denominator, the percentage carries no energy information; it can describe a tiny absolute or a large absolute equally well.

**Real example:** Karnataka KSLDC publishes plant-level dispatch-instruction PDFs that report the instructed reduction as a percentage of nameplate or schedule. The corresponding generation total is not in the PDF and is not published in a machine-readable form for older events. The instruction is a real signal but not, by itself, an energy total.

**What to do instead:** Either source the matching generation total from the same operator for the same window and compute MWh = generation × percentage with the math shown in the validation doc, or keep the region as official-lead and do not publish an energy figure derived from the percentage alone.

**Decision question:** If the source cites a percentage, do we have the matching generation MWh from the same operator covering the same window?

### 4. Blank or dash treated as zero

**Failure pattern:** A loader coerces empty cells, "-", "n/a", "NR", or "*" in a published table to numeric zero.

**Why it's wrong:** "Not reported" and "zero" are different observations. Coercing them to the same value silently understates curtailment in regions where reporting is incomplete and inflates the apparent global completeness of the dataset. The bug compounds across years and regions because the missing-as-zero coercion is invisible at every individual row.

**Real example:** Several upstream curtailment PDFs (especially Indian SLDC and earlier ENTSO-E A75 extracts) use blank cells in the curtailment column to mean "the operator did not file a curtailment number this period". A coerce-to-zero loader treats those silently as zero curtailment.

**What to do instead:** Distinguish missing values from zero in the loader. Surface "missing" as null in the snapshot pipeline, never as 0. The withFallback machinery should treat a null-heavy month as a freshness signal, not as evidence of low curtailment.

**Decision question:** Does the loader explicitly distinguish null (missing) from 0 (zero curtailment reported), and is that distinction preserved through to the snapshot?

### 5. Modelled fallback labelled as verified measurement

**Failure pattern:** A typical-shape profile scaled to a published anchor is declared T1a-live-tso or otherwise tagged "verified" because the annual anchor is sourced.

**Why it's wrong:** The hourly shape is synthetic. The annual scalar is published. The resulting hourly snapshot is neither a measured trace nor a defensible anchor — it is a modelled hourly profile constrained to integrate to a published total. A consumer who reads the hourly trace is not getting measured data; the validation doc and source-status must reflect that.

**Real example:** The v1.1.1 India SLDC declarations: six regions declared T1a-live-tso because the loader was wired and the Ember anchor was published, while the geoblock meant the emitted hourly trace was a typical solar shape. v1.2.0 had to demote them to T3-modelled. The exact sequence is documented in dataset/CHANGELOG.md.

**What to do instead:** A typical-shape profile scaled to a published anchor is T2-annual-calibrated at best (if the anchor is independently measured) and T3-modelled otherwise. The corresponding sourceProvenance is modelled-fallback, not verified. The validation doc must state explicitly that the hourly shape is synthetic.

**Decision question:** Does the hourly trace in the snapshot come from a measured or instructed-dispatch hourly source for this region — or is it a typical-shape profile constrained to a published annual anchor?

---

## Tier definitions (authoritative)

These are the canonical definitions. Any classification decision must satisfy the conditions in the **"What this requires"** column for the claimed tier. The **"What this does NOT accept"** column is the demotion filter — if any item in that column applies, the candidate cannot be placed in that tier without first obtaining the missing evidence.

### T1a-live-tso

**Condition:** `Region.tier === "live"` AND a calibration rate published by the **same jurisdiction's TSO or regulator**.

**What this requires (ALL must be satisfied):**
1. Hourly curtailment data is fetched live from the TSO/ISO/operator
2. A curtailment rate is published by that same TSO/ISO/operator (or the regulator in the same jurisdiction)
3. The rate is specific to that jurisdiction — not a neighbour rate, not a modelled share-split

**What this does NOT accept:**
- A neighbour zone's published rate used as a proxy (→ T1c)
- A rate sourced from a domestic statistical agency that is not the TSO (→ T1b)
- A rate calculated from the data itself without a published anchor (Pattern-PF: generation × rate = curtailment — acceptable if the rate itself is published or independently derived from a named source)
- An estimated rate invented without a published source

**Envelope:** ±15% of peakGW (2σ from 5-year backfill when available; ±15% fallback before backfill completes).

---

### T1b-live-domestic-anchored

**Condition:** `Region.tier === "live-domestic-anchored"` — live feed plus a rate sourced from a **domestic statistical agency** or a **modelled share-split of a national anchor**.

**What this requires (ALL must be satisfied):**
1. Hourly curtailment data is fetched live
2. The rate comes from a domestic statistical agency (e.g., national statistics office, energy regulator, not the TSO itself) OR is a modelled share-split of a national anchor
3. The rate scope and feed scope do not coincide (e.g., national anchor applied to a bidding zone, or a national aggregate applied to a sub-national region)

**What this does NOT accept:**
- A rate published by the same TSO that publishes the feed (→ T1a)
- A neighbour zone's rate used as a proxy (→ T1c)
- A rate calculated from the data itself without a named published source

**Envelope:** ±50% of peakGW.

---

### T1c-live-neighbour-anchored

**Condition:** `Region.tier === "live-neighbour-anchored"` — live feed plus a rate **extrapolated from a neighbouring zone** where no domestic rate is published.

**What this requires (ALL must be satisfied):**
1. Hourly curtailment data is fetched live
2. No domestic rate exists in the candidate's own jurisdiction
3. The rate comes from a neighbouring zone with a published rate — and the rationale for the neighbour choice is documented

**What this does NOT accept:**
- A rate published by the candidate's own TSO (→ T1a)
- A domestic statistical agency rate (→ T1b)
- An invented neighbour rate without justification

**Envelope:** ±35.5% of peakGW.

---

### T2-annual-calibrated

**Condition:** `Region.tier === "flare"` OR (`Region.tier === "static"` AND `profileKind === "flat"`).

**What this requires (ALL must be satisfied):**
1. An explicit, named, dated document that states an annual curtailment total for a specific region
2. The document is from one of: TSO annual report, Ember country report, GGFR satellite data, IEA WEO, ACER decision, or equivalent authoritative source
3. The annual figure is a measured or independently estimated total — not a capacity-based calculation (installed capacity × capacity factor × curtailment rate)

**What this does NOT accept:**
- An IRENA capacity-based estimate: IRENA publishes installed capacity and generation by fuel. Curtailment is not directly measured; it must be back-calculated from the gap between potential generation (capacity × CF) and actual generation. This requires assumptions. It is not a published curtailment total.
- A typical-shape profile applied to an annual anchor (→ T3)
- An invented figure with no published source
- A vague citation like "IRENA 2024" without a specific document URL or page reference

**Critical distinction — T2 vs T3 for static regions:**
A static region lands in T2 if and only if `profileKind === "flat"` AND the source is a published annual total. If the annual figure is from a capacity-based calculation, `profileKind` should be `"solar"`/`"wind"`/`"mixed"`/`"hydro"` and the region is T3.

**Envelope:** ±20% of peakGW.

---

### T3-modelled

**Condition:** `Region.tier === "static"` AND `profileKind ∈ { "solar", "wind", "mixed", "hydro", "hydro-seasonal" }`.

**What this requires (ALL must be satisfied):**
1. An annual anchor exists (from any source, including IRENA capacity-based estimates)
2. A typical diurnal/seasonal/fuel-mix profile is applied to represent the hourly shape

**What this does NOT accept:**
- A flat profile with no shape — that is T2 or flare
- A live hourly feed — that is T1a/T1b/T1c

**Envelope:** ±40% of peakGW.

---

## Data quality scoring framework

For each candidate country/region, score each of the following five dimensions. A candidate for elevation must score at the required level for ALL dimensions simultaneously.

### Dimension 1 — Source authority

| Score | Description |
|---|---|
| 5 | TSO or ISO/operator publishes the data directly |
| 4 | Domestic regulatory agency or statistical office |
| 3 | International organisation (IEA, IRENA — with specific document citation) |
| 2 | Academic paper or consultant report with methodology disclosed |
| 1 | NGO report without disclosed methodology |
| 0 | No source identified |

### Dimension 2 — Data specificity

| Score | Description |
|---|---|
| 5 | Explicit annual curtailment total in TWh with a cited document and year |
| 4 | Generation data from which curtailment can be calculated (with cited source) |
| 3 | Capacity-based estimate with disclosed assumptions and a named source |
| 2 | Capacity-based estimate with undisclosed assumptions |
| 1 | Rough order-of-magnitude estimate |
| 0 | No figure identified |

### Dimension 3 — Machine-readability

| Score | Description |
|---|---|
| 5 | JSON/XML/API — directly parseable without transformation |
| 4 | CSV or well-structured HTML table — parseable with minor effort |
| 3 | PDF with extractable tables |
| 2 | PDF with text requiring OCR or manual extraction |
| 1 | JS-rendered SPA — requires headless browser or API reverse-engineering |
| 0 | No machine-readable path identified |

### Dimension 4 — Temporal coverage

| Score | Description |
|---|---|
| 5 | Live hourly feed with 30-day rolling coverage |
| 4 | Daily data available for 365+ days per year |
| 3 | Monthly data available |
| 2 | Annual data available |
| 1 | Data from a single year |
| 0 | No temporal data identified |

### Dimension 5 — Rate provenance

| Score | Description |
|---|---|
| 5 | Rate published by TSO/regulator for that specific jurisdiction |
| 4 | Rate calculated from generation data in same document |
| 3 | Rate from neighbouring zone with documented rationale |
| 2 | Capacity-based rate with disclosed assumptions |
| 1 | Invented estimate |
| 0 | No rate identified |

---

## Tier landing thresholds

A candidate can only be placed in a tier if ALL minimum thresholds are met:

| Tier | Source authority | Data specificity | Machine-readability | Temporal coverage | Rate provenance |
|---|---|---|---|---|---|
| **T1a** | ≥4 | ≥4 | ≥3 | ≥4 | ≥4 (own-jurisdiction) |
| **T1b** | ≥3 | ≥3 | ≥3 | ≥4 | ≥3 (domestic stat agency or share-split) |
| **T1c** | ≥3 | ≥3 | ≥3 | ≥4 | ≥3 (neighbour with rationale) |
| **T2** | ≥3 | ≥3 | ≥1 | ≥2 | ≥3 (published annual total) |
| **T3** | ≥1 | ≥2 | ≥0 | ≥1 | ≥1 (annual anchor exists) |

**If a candidate does not meet the threshold for any dimension, it cannot be placed in that tier.**

---

## Scoring template for each country/region

For each candidate, document the following in the audit record:

```
Country/Region: [name] ([region_id])
Date assessed: [YYYY-MM-DD]
Assessor: [name]

--- Dimension scores ---
Source authority:    [N] — [one-line explanation with source name and URL]
Data specificity:    [N] — [one-line explanation with figure cited]
Machine-readability:[N] — [one-line explanation of format and path]
Temporal coverage:   [N] — [one-line explanation of data frequency and period]
Rate provenance:    [N] — [one-line explanation of rate source and calculation]

--- TIER SCORE SUMMARY ---
Total score: [N]/25
T1a minimum: ALL dimensions ≥[3/4/4/4/4] — [PASS/FAIL]
T1b minimum: ALL dimensions ≥[3/3/3/4/3] — [PASS/FAIL]
T1c minimum: ALL dimensions ≥[3/3/3/4/3] — [PASS/FAIL]
T2 minimum:  ALL dimensions ≥[3/3/1/2/3] — [PASS/FAIL]
T3 minimum:  ALL dimensions ≥[1/2/0/1/1] — [PASS/FAIL]

--- TIER DECISION ---
Recommended tier: [T1a/T1b/T1c/T2/T3/blocked-document-only/leave-T3]
Confidence: [high/medium/low]
Reason: [2-3 sentence justification]

--- PUBLISHED EVIDENCE ---
Document 1: [title], [organisation], [URL], [year], [relevant excerpt/figure]
Document 2: [same format]
[... as many as needed]

--- DEMOTION CHECK ---
[For claimed tier] What would make me reject this candidate?
1. [Specific condition that would invalidate the tier claim]
2. [Another condition]

--- DIFFERENTIATOR ---
What is the single most important difference between this candidate's tier and the tier below it?
[1-2 sentence answer]

--- NEXT STEPS ---
[What specific action is needed to confirm or refute this candidate]
```

---

## Demotion checklist (mandatory for every candidate)

Before assigning any tier, explicitly check and document:

- [ ] **For T1a:** Is the rate published by the same TSO/ISO that publishes the feed, or a regulator in the same jurisdiction?
- [ ] **For T1a:** Is the rate specific to this region, or is it a neighbour rate?
- [ ] **For T1a/T1b/T1c:** Is the hourly data live, or is it a static fallback?
- [ ] **For T2:** Is the annual figure from a named document with a URL and year? Or is it an IRENA capacity-based calculation?
- [ ] **For T2:** Does the document explicitly state curtailment, or does it require a calculation to derive it?
- [ ] **For any tier:** Could the claimed tier be achieved by simply relabelling an existing entry without finding any new data?
- [ ] **For any candidate:** Is the annual figure below 0.05 TWh — below the signal threshold where noise dominates?
- [ ] **For crisis-affected grids (Lebanon, Syria, Venezuela, Nigeria):** Is the phenomenon actually curtailment, or is it load-shed from grid inadequacy?
- [ ] **For hydro-dominant grids (Bhutan, Laos, Nepal):** Is curtailment structurally near-zero due to must-run hydro?
- [ ] **For island grids:** Does the TSO publish data independently, or is it too small to produce a signal above noise?
- [ ] **For sanctioned/geo-blocked countries (Belarus, North Korea):** Can the data be independently verified, or is it only accessible through unofficial channels?

---

## Phase 1 audit — candidate records

[See `docs/research/phase1-data-audit-2026-04-28.csv` for structured data and `docs/research/2026-04-28-phase1-data-audit.md` for narrative findings.]

The audit was conducted against this guide. Each candidate country was assessed on all five dimensions, with explicit demotion checks and differentiators documented. Results summarised below by tier recommendation.

### Candidates recommended for T1a investigation

| Country | Region ID | Source authority | Data specificity | Machine-readability | Temporal coverage | Rate provenance | Total | Blocking issue |
|---|---|---|---|---|---|---|---|---|
| Slovakia | slovakia | 4 (SEPS) | 4 (daily gen dashboard) | 4 (XML feed at dae.sepsas.sk) | 4 (daily) | 2 (rate not published — must calculate) | 18 | Rate not published; must derive |
| Slovenia | slovenia | 4 (ELES) | 4 (daily gen data) | 3 (HTML table) | 4 (daily) | 2 (rate not published) | 17 | Rate not published; must derive |
| Philippines | philippines | 3 (WREM/NGCP) | 4 (generation data confirmed) | 1 (JS-rendered SPA) | 4 (daily/hourly) | 2 (rate estimated) | 14 | JS-rendered; rate not published |

**Demotion criteria for all three:** If the rate cannot be derived from the data (i.e., generation data does not distinguish curtailed from non-curtailed output), the candidate is T2 only — not T1a. For all three, the generation data exists but a curtailment-specific rate is not published by the TSO. The path to T1a requires either (a) finding a published curtailment rate in a TSO document, or (b) independently calculating the rate from generation data and naming the methodology.

### Candidates recommended for T2 confirmation

| Country | Region ID | Source authority | Data specificity | Machine-readability | Temporal coverage | Rate provenance | Total | Blocking issue |
|---|---|---|---|---|---|---|---|---|
| Croatia | croatia | 3 (HOPS annual report) | 3 (monthly wind PDFs — not curtailment-specific) | 2 (PDF) | 2 (monthly) | 2 (capacity-based estimate) | 12 | PDF only; no published rate |
| Jordan | jordan | 3 (NEPCO annual) | 3 (annual reports — not machine-readable) | 1 (PDF/JS) | 2 (annual) | 2 (capacity-based estimate) | 11 | No machine-readable path found |
| Guatemala | guatemala | 3 (AMM wholesale market) | 3 (organized market data — may be machine-readable) | 3 (AMM data portal) | 4 (hourly/daily) | 2 (rate not published by AMM) | 15 | Rate not published; AMM may have hourly |
| Nigeria | nigeria | 3 (TCN + Ember) | 4 (Ember publishes ~7 TWh composite) | 2 (PDF/HTML) | 2 (daily TCN reports) | 3 (Ember composite anchor) | 14 | Load-shed vs curtailment distinction |
| Austria | austria | 3 (APG) | 3 (redispatch narrative ~0.5 TWh) | 2 (PDF) | 2 (annual) | 2 (redispatch narrative not rate) | 12 | PDF only; rate not published |

**Demotion criteria for all:** If the cited document does not explicitly state a curtailment total in TWh — if it requires calculation from capacity data — the candidate stays T3. For Austria, the APG "redispatch narrative" is qualitative, not quantitative. For Nigeria, the Ember composite figure includes load-shed, which is not curtailment.

### Countries to leave as T3 or block

| Country | Region ID | Primary reason |
|---|---|---|
| Albania | albania | ENTSO-E member but hydro-dominant (<2% VRE); structural near-zero curtailment |
| North Macedonia | north-macedonia | ENTSO-E member; PDF-only; very small system (~3 TWh); rate not published |
| Bosnia | bosnia | ENTSO-E member; PDF-only; rate not published |
| Serbia | serbia | ENTSO-E member; HTML table data but no published curtailment rate |
| Montenegro | montenegro | ENTSO-E member; very small (~3 TWh); PDF-only; rate not published |
| Belarus | belarus | Sanctioned; geo-blocking risk; cannot verify independently |
| North Korea | north-korea | Isolated grid; no public data; cannot verify |
| Bhutan | bhutan | Hydro export grid; structural near-zero domestic curtailment |
| Syria | syria | War-affected; no data accessible |
| Libya | libya | War-affected; no data accessible |
| Venezuela | venezuela | Grid in severe distress; load-shed dominates; not curtailment |
| Somalia | somalia | Conflict zone; no data |
| Yemen | yemen | War-affected; no data |
| Kiribati | kiribati | Sub-0.01 TWh; below signal threshold |
| Tonga | tonga | Sub-0.01 TWh; below signal threshold |
| Vanuatu | vanuatu | Sub-0.01 TWh; below signal threshold |

---

## Key lessons from Phase 1 audit

1. **Source authority is not the same as data specificity.** A TSO may publish data without publishing a curtailment rate. T1a requires both — the feed and the rate from the same jurisdiction.

2. **IRENA estimates are not T2-qualifying.** IRENA publishes installed capacity and generation. Curtailment is derived, not measured. A derived figure requires assumptions. T2 requires a published total — Ember's annual country review, a TSO's annual report, GGFR's satellite data.

3. **"Kind: flat" is not a T2 upgrade.** Changing `profileKind` from `"solar"` to `"flat"` in `statics.json.ts` narrows the uncertainty band from ±40% to ±20% but adds no new data. This is a mislabel, not an improvement. It is acceptable only when the annual figure already comes from a qualifying published source.

4. **Load-shed is not curtailment.** Nigeria's ~7 TWh figure is partly chronic load-shed from grid inadequacy, not VRE curtailment. These phenomena have different causes and policy implications. A single composite number conflates them.

5. **Crisis-affected grids have no reproducible signal.** Lebanon, Syria, Venezuela — the grid is not operating normally; data is not published reliably; a tier assignment would not be reproducible by another researcher.

6. **Neighbour rates require documented rationale.** T1c is a valid tier, but the choice of neighbour must be justified. "Closest ENTSO-E member" is not sufficient if the grid topologies differ significantly.

---

*This guide is a living document. Update the thresholds and criteria as the project's methodology evolves. Every tier classification decision — elevation or demotion — must reference this guide and document the specific evidence that satisfies or fails each criterion.*
