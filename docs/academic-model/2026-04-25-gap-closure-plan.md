# Gap-closure plan — from v1.0.0 to Scientific Data submission

Status: **Drafted 2026-04-25** · Supersedes open-items section of `2026-04-24-submission-plan.md` · Author: Simon Collins (solo)

## Scope

This document takes the seven hard gaps and two thin-but-survivable gaps identified in the v1.0.0 status review and maps each one to a sprint, a deliverable, an agent-dispatchable work-item list, and a success criterion. It is the execution companion to `2026-04-24-submission-plan.md`.

The main change vs the original plan: a new **HB Historical Backfill** track runs in parallel with S1–S3. Rather than documenting "~6mo of parquet at submission, commit to future releases," we reconstruct 5+ years of hourly history from upstream archives for every region whose source supports it. This converts the thin-parquet gap from a reviewer-response risk into a technical-validation strength.

## Gap → sprint map

| # | Gap | Severity | Sprint | Delivered by |
|---|---|---|---|---|
| 1 | DOI / formal archival | Required | **S0** | Zenodo tag of v1.0.0 |
| 2 | Schema / citation / data licence | Required | **S0** | `dataset/SCHEMA.md`, `CITATION.cff`, `LICENSE` (CC-BY-4.0) |
| 3 | **Technical Validation** | Critical | **S1** | 78 × `docs/validation/<region>.md` + global validation scatter figure |
| 4 | **Uncertainty quantification** | Critical | **S2** | `uncertaintyLow/High/ConfidenceTier` fields + `docs/methodology/uncertainty.md` |
| 5 | Figures | Required | **S3** | 5 publication-grade figures + generation code |
| 6 | FAIR self-assessment | Standard | **S4** | `dataset/FAIR.md` complete + F-UJI run |
| 7 | **Historical backfill** (NEW — closes "thin parquet" gap) | Strategic | **HB** (parallel to S1–S3) | `data/historical/curtailment_backfill.parquet` on Zenodo |
| 8 | Coverage completeness (Balkans, small EU) | Thin-survivable | **HB.4** | Covered by historical-backfill Europe expansion OR documented as structural gap |
| 9 | Pre-2024 anchor (per-region validation against multi-year history) | Thin-survivable | **HB + S1** | Backfill makes multi-year triangulation possible |

## Work stream detail

### S0 Foundation — CLOSES GAPS 1 & 2 (in progress, this week)

**Status:** branches merged; dataset scaffold landed; tag + Zenodo remaining.

Remaining work:
- [ ] Simon: enable GitHub→Zenodo integration at https://zenodo.org/account/settings/github/ and flip the `every-last-joule-dashboard` toggle
- [ ] Simon: edit Zenodo repo metadata (title, description, authors, keywords, ORCID)
- [ ] Automatable: push annotated v1.0.0 tag with release notes summarising the 5 merged audit branches
- [ ] Automatable: after Zenodo mints DOI (~5 min after tag push), record it in `dataset/CITATION.cff` and `dataset/README.md`

**Success criterion:** DOI resolvable; `curl -s https://zenodo.org/doi/<DOI>` returns metadata; paper draft can cite `10.5281/zenodo.xxxxxx`.

### HB Historical Backfill — NEW TRACK, runs Wks 3–12, parallel with S1/S2/S3

**Goal:** produce `data/historical/curtailment_backfill.parquet` (or a Zenodo-attached variant if size exceeds repo-committable) containing hourly curtailment observations from ≥ 2020-01-01 through 2026 for every region whose upstream archive supports it.

**Feasibility matrix** (verified against current loaders):

| Source | History depth | Agent-dispatchable chunks | Estimated hourly rows |
|---|---|---|---|
| ENTSO-E Transparency | 2015→ (10yr) | 11 bidding zones | 11 × 88k ≈ 970k |
| EIA US ISOs | 2015→ | 9 ISOs (CAISO, ERCOT-W, ERCOT-E, PJM, MISO, NYISO, ISONE, SPP, BPA) | 9 × 88k ≈ 790k |
| AEMO NEMWeb | 1998→ (clip to 2020) | 5 states | 5 × 53k ≈ 265k |
| Elexon BMRS (UK) | 2005→ | 2 zones | 2 × 53k ≈ 105k |
| ONS Brazil | 2010→ | 2 regions (NE clusters, South) | 6 × 53k ≈ 320k |
| Nord Pool / ENTSO-E NO | 2015→ | 5 Norway zones | 5 × 88k ≈ 440k |
| CAMMESA Argentina | limited ~2022→ | 1 region | 35k |
| IESO Ontario | ~2015→ | 1 region | 88k |
| AESO Alberta | ~2015→ | 1 region | 88k |
| EirGrid Ireland | dashboard scrape — limited history, may be 1yr only | 1 region | 8k |
| ESKOM South Africa | data portal | 1 region (patchy) | ~20k |
| COES Peru | dashboard | 1 region | ~20k |
| **Total** | | **~40 parallel agent chunks** | **~3.2M rows** |

**Not backfillable** (structural gaps, documented in `known-limitations.md`):
- Chinese provinces — no public hourly API; stays on Ember-calibrated static
- Flare regions — GGFR annual; 24/7 base-load by nature, hourly back-fill meaningless
- Atacama Chile — Cloudflare-gated; backfill depends on B2 Playwright spike landing first
- Saudi/Iran/most Middle East — no public source
- Iceland — Orkustofnun annual only

**Size budget.** 3.2M rows × 50 bytes (Snappy, typed columns) ≈ **160 MB** uncompressed. Partition the output by `year=YYYY` and publish as a Zenodo asset rather than committing the full file to the git repo (repo-committed subset: last 12 months rolling). This sidesteps GitHub's 100 MB/file soft limit without LFS.

**HB sprint phases:**

#### HB.0 Schema + harness (Wk 3, Simon-led, 2 days)

- Create `scripts/backfill/` with `common.py` (shared rate-calibration logic matching `src/lib/profile.ts::timeOfDayAverageGW` semantics — same kWh → GW conversions, same calibration-rate application).
- Create `data/historical/backfill/` output directory with partition-by-year layout.
- Write `docs/methodology/historical-backfill.md` describing the reconstruction methodology, discrepancies vs live feeds, and how calibration rates that evolved over time are handled (locked at per-year TSO-published annual rates rather than current rate).
- Create `scripts/backfill/merge_to_parquet.py` that consolidates per-source per-year partitions into the final `curtailment_backfill.parquet`.

#### HB.1 ENTSO-E (Wks 4–5, 11 parallel codex agents)

Each agent takes one bidding zone, writes `scripts/backfill/entsoe_<zone>.py`, pulls 2020–2026 hourly generation + curtailment (B18/B19/B25 psr types as appropriate per `docs/methodology/entsoe-rates.md`), applies the calibrated rate per year, writes year-partitioned Parquet. Zones: Germany, Iberia-ES, Iberia-PT, Finland, France, Netherlands, Denmark-West, Switzerland, Norway NO1, NO2, NO3, NO4, NO5 (13 zones — split NO1–NO5 into one agent since they share the API structure).

Dispatch prompt template (written now, reused per zone): in `scripts/backfill/prompts/entsoe.md`.

#### HB.2 EIA US ISOs (Wks 4–5, 9 parallel codex agents)

One per ISO. EIA API supports hourly data back to 2015 via `/v2/electricity/rto/region-data/` and similar endpoints. Each agent writes `scripts/backfill/eia_<iso>.py`, handles rate limiting (EIA: 5000 req/hr), stores year-partitioned. No calibration rate — EIA publishes actual curtailment directly for most ISOs.

#### HB.3 Rest-of-world (Wks 6–7, 10 parallel codex agents)

AEMO NEMWeb (5 states), Elexon BMRS (2 zones), ONS Brazil (regions + NE cluster disaggregation), Argentina/Ontario/Alberta/Ireland/South Africa/Peru — one agent each.

#### HB.4 Coverage-gap expansion (Wks 8–9)

With the backfill infrastructure in place, use the remaining capacity to close thin-coverage gaps flagged in `docs/coverage-gaps-europe.md`:
- Poland (ENTSO-E PL zone)
- Czech Republic (ENTSO-E CZ)
- Italy North/South (ENTSO-E IT-Nord, IT-Sud)
- Sweden SE1–SE4 (ENTSO-E)
- Greece (ENTSO-E GR)

Each is a live-loader addition plus backfill. ~5 additional regions.

#### HB.5 Validation + merge (Wks 10–11, Simon-led)

- Cross-check backfill values against published TSO annual totals per year per region. Write validation into `docs/validation/<region>.md` (S1 integration point — see below).
- Merge all year-partitioned per-source files via `scripts/backfill/merge_to_parquet.py` into the final archive.
- Publish to Zenodo as a dataset asset with its own sub-DOI under the main dataset DOI.
- Update `dataset/SCHEMA.md`, `dataset/README.md`, and `dataset/CHANGELOG.md`.

**Success criterion:** `data/historical/curtailment_backfill.parquet` exists with ≥ 2.5M rows spanning ≥ 2020-01-01 to 2026-09-30 for ≥ 35 regions; loadable in 1 line of pandas; every row traceable via `source` column back to a specific upstream archive fetch.

### S1 Technical Validation — CLOSES GAP 3 (Wks 3–6, now with HB integration)

**Original plan:** per-region triangulation vs IRENA/Ember/TSO annuals for 78 regions.

**With HB integration:** each `docs/validation/<region>.md` now contains:
1. Live-feed vs IRENA 2024 annual (original)
2. Live-feed vs Ember 2024 annual (original)
3. Live-feed vs TSO 2024 annual published curtailment (original)
4. **NEW** — Backfill 2020-2024 annual totals vs those sources year-by-year (a 5-year triangulation instead of a 1-year one). This is hugely stronger for Technical Validation.

Per-region MD template: `docs/validation/_template.md`, produced in HB.0.

**Agent dispatch:** 10 parallel codex agents, 7-8 regions each, ~1 hr per region = overnight runs. 78 regions total covered.

**Deliverables:**
- 78 validation markdowns (`docs/validation/*.md`)
- 1 global scatter figure (our annual vs IRENA annual, colour-coded by confidence tier)
- `docs/validation/README.md` index

**Success criterion:** for every non-structural-gap region, discrepancy vs IRENA or TSO annual is within ±25% OR the discrepancy has a documented reason (e.g., definitional — we include spill, IRENA doesn't).

### S2 Uncertainty — CLOSES GAP 4 (Wks 7–10)

**Tier definitions** (deterministic from loader type):

| Tier | Who gets it | Uncertainty model | ± on peakGW |
|---|---|---|---|
| T1-live-TSO | Live feed from TSO with documented calibration, ≥ 1yr history | `2 × σ_backfill_5yr` (actual observed variance from backfill) | Typically ±5–10% |
| T2-annual-calibrated | Static with annual anchor (Ember/IRENA/GGFR) | `0.2 × peakGW` (published-source implied uncertainty) | ±20% |
| T3-modelled | Typical profile scaled to annual (Sichuan, Xinjiang, Iceland) | `0.4 × peakGW` (profile-shape assumption) | ±40% |
| T4-structural-gap | No claim made — region not in dataset | n/a | n/a |

**Work items:**
- `src/lib/uncertainty.ts` — tier derivation from `source`/`loaderId` and bounds calculation
- All loaders extended to emit `uncertaintyLowGW`, `uncertaintyHighGW`, `confidenceTier`
- `scripts/append_history.py` extended to include uncertainty columns
- `docs/methodology/uncertainty.md` — methodology doc, cites FAIR-NUM-2019 conventions
- Dashboard tooltip surfaces tier label (see existing `region-tooltip.js`)
- Tests: each tier computed deterministically from loaderId on every snapshot

**Agent dispatch:** 4 parallel codex — one per tier's methodology + implementation.

**Success criterion:** every row in the parquet archive has `uncertainty_low_gw ≤ peak_gw ≤ uncertainty_high_gw` (test-enforced) and `confidence_tier ∈ {T1,T2,T3}` (or absent for structural gaps).

### S3 Figures — CLOSES GAP 5 (Wks 11–14)

**5 figures, each generated deterministically by a committed script:**

1. **Global curtailment map** (descriptor paper Figure 1)
   - World map, dots sized by peakGW, coloured by confidenceTier, one dot per region.
   - `scripts/figures/fig1_global_map.py` using cartopy + matplotlib.

2. **Validation scatter** (descriptor paper Figure 2)
   - x = our published annual, y = IRENA/Ember/TSO published annual, 122 points.
   - `scripts/figures/fig2_validation_scatter.py`.

3. **Temporal trace — backfill era** (descriptor paper Figure 3)
   - Global total curtailment 2020–2026, daily resolution.
   - Made possible by HB deliverable. Shows seasonal pattern, COVID dip, post-2022 solar boom.
   - `scripts/figures/fig3_temporal_trace.py`.

4. **Per-tier coverage map** (descriptor paper Figure 4)
   - Same geographic base as Fig 1, shading by tier to show where we are T1 vs T2 vs T3 vs gap.
   - `scripts/figures/fig4_tier_coverage.py`.

5. **Hotspot comparison** (descriptor paper Figure 5)
   - Top 20 regions by mean peakGW; 5yr timeseries per region; horizontal-facet layout.
   - `scripts/figures/fig5_top20_timeseries.py`.

**Standards:** 300dpi PNG + PDF; colour-blind-safe palette (Viridis or Okabe-Ito); captions in `docs/paper/figure-captions.md`.

**Agent dispatch:** 1 figure-codex per figure, 5 parallel. Human review on each.

**Success criterion:** all 5 figures regenerate from commits (no manual editing); all labels readable at journal-column width; captions pass technical-writing review.

### S4 FAIR — CLOSES GAP 6 (Wks 15–18)

- Run F-UJI automated scan at https://www.f-uji.net/
- Manual scorecard against FAIR principles (template in `dataset/FAIR.md`)
- Address any automated-scan failures (typically: add DataCite-compatible metadata, fix relative URLs in CITATION.cff, ensure Zenodo entry has all required fields)
- Commit completed `dataset/FAIR.md`

**Success criterion:** F-UJI score ≥ 70% on each pillar (F, A, I, R).

## Updated 6-month timeline

| Sprint | Window | Original deliverable | Adjustment |
|---|---|---|---|
| **S0** | Wks 1–2 (04-28 → 05-12) | Merges + scaffold + Zenodo | _in progress, scaffold landed 04-25_ |
| **S1 + HB.1–HB.2** | Wks 3–6 | Validation + ENTSO-E/EIA backfill | Parallel, 20+ parallel agents |
| **S2 + HB.3** | Wks 7–8 | Uncertainty + ROW backfill | Parallel, 14+ agents |
| **HB.4–HB.5** | Wks 9–10 | Coverage expansion + backfill merge | |
| **S3** | Wks 11–14 | Figures | Fig 3 uses HB output |
| **S4** | Wks 15–18 | FAIR + pre-inquiry + peer review round | |
| **S5** | Wks 19–22 | Submit + DARI + Joule companion | |
| **S6** | Wks 23–27 | Reviewer cycle | |

Submission window unchanged: early November 2026.

## Revised risk matrix

| Risk | Likelihood | Mitigation |
|---|---|---|
| HB.1 ENTSO-E rate-limit or API change mid-backfill | Medium | Agents implement exponential backoff; per-zone state checkpointing lets restarts resume; budget 2× each zone's nominal time |
| HB.2 EIA 5000 req/hr cap exhausted before completion | Medium | Stagger agent launches; each ISO ≈ 15k requests for 10yr hourly; run each ISO in a separate 1-hr window |
| HB output size > 500 MB even compressed | Low | Partition by year, publish via Zenodo assets rather than git |
| Codex quota exhausted mid-HB run | Medium | HB.0 schema harness makes each agent task resumable; pause and wait for daily reset; Claude Agent SDK as backup |
| Per-year calibration-rate drift causes reviewer confusion | Medium | `docs/methodology/historical-backfill.md` documents which rate applied to which year with TSO-annual anchor |
| S1 validation discrepancies > ±25% on > 15% of regions | Medium | 2-week calibration-rework buffer in S2; document root cause per region in validation MD |
| S2 uncertainty model looks hand-waved to reviewer | Medium | Tier model derived from backfill-observed variance is empirical, not subjective — HB makes this possible |
| Figures don't meet journal typography standard | Low | Template against published Sci Data figures; 3 revision rounds in S3 |

## What stays out of scope even with backfill

- Pre-2020 history (dataset positioned as "modern renewable era"; pre-2020 has patchy coverage and different policy regimes)
- Real-time sub-hourly resolution (still 1-hour granularity)
- Mexico CENACE, most of sub-Saharan Africa, most Middle East non-flare (no public hourly source; structural gaps remain structural)
- Price-weighted curtailment (energy-weighted only; price weighting is v1 analysis-paper territory)

## Companion (Joule) paper coordination

The historical backfill also unlocks the companion analysis paper. With 5yr hourly × 35+ regions, the Joule paper can do things the descriptor paper can't:
- Demonstrate the Bitcoin-matchability thesis empirically against real historical curtailment
- Quantify the "useful wasted joule" across weather events, seasonal cycles, policy regimes
- Run sensitivity analysis on interruptible-load assumptions
- Compare curtailment growth against renewable-capacity growth

Drafted in parallel (S3–S5) per the original submission plan; submitted after descriptor acceptance.

## Agent dispatch list (copy-paste ready)

```
HB.1 ENTSO-E: 13 agents (one per bidding zone)
HB.2 EIA: 9 agents (one per ISO)
HB.3 ROW: 10 agents
HB.4 Coverage expansion: 5 agents
S1 Validation: 10 agents (~8 regions each)
S2 Uncertainty: 4 agents (one per tier)
S3 Figures: 5 agents (one per figure)
```

~56 agent-dispatches across 3 months. At ~2 hr per agent task and 10-way parallelism, this is ~60 hours of human supervision spread over 12 weeks — matches the "Simon monitors, codex executes" division in the original plan.

## References

- `docs/academic-model/2026-04-24-submission-plan.md` — master 6-month plan
- `docs/academic-model/target-journal.md` — venue ladder and rationale
- `docs/methodology/entsoe-rates.md` — ENTSO-E calibration rates (input to HB.1)
- `docs/methodology/china-provinces.md` — Ember calibration (input to S1)
- `docs/methodology/flare-ercot-brazil.md` — flare methodology (ERCOT also relevant to HB.2)
- `docs/coverage-gaps-europe.md` — gaps to close in HB.4
- `docs/known-limitations.md` — structural gaps that stay gaps
- `dataset/SCHEMA.md` — current schema (HB adds to this)
- `scripts/append_history.py` — live rolling Parquet (analog for HB merge script)
