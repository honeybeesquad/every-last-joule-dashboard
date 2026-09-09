# Bitcoin coverage-ratio claim register - 2026-05-06

Purpose: recover the DARI/journal claim set after the crashed session and classify each claim against the strict ELJ source-quality rules. This is a governance artifact, not a redraft.

Controlling source-quality rule: `docs/research/2026-04-29-data-quality-elevation-backlog.md`.

Draft files inspected:

- `/Users/simoncollins/Documents/New project/scientific-reports-bitcoin/dari_research_note_v0.1.md`
- `/Users/simoncollins/Documents/New project/scientific-reports-bitcoin/manuscript_v0.1.md`
- `/Users/simoncollins/Documents/New project/scientific-reports-bitcoin/dari_publication_plan.md`
- `/Users/simoncollins/Documents/New project/scientific-reports-bitcoin/redevelopment_plan.md`

Audit files inspected:

- `docs/research/2026-04-24-global-coverage-audit.md`
- `docs/research/2026-04-28-phase1-data-audit.md`
- `docs/research/2026-04-28-global-data-elevation-audit.md`
- `docs/research/2026-04-29-data-quality-elevation-backlog.md`
- `docs/research/2026-04-29-missing-coverage-and-regionalization-audit.md`
- `docs/methodology/uncertainty.md`
- `docs/methodology/china-provinces.md`

Note on claim IDs: the full Opus memo was not available as a file in this workspace. The IDs below reconstruct the D, S, R, and F groups from the Opus summary and the available draft passages. Replace these IDs with the exact Opus table if that memo is recovered.

## Integrity Position

The database is the primary scholarly object. It should aim to be the most comprehensive, verifiable, open representation of renewable-energy curtailment possible. Inclusion is acceptable for lower-quality regions only when the source chain, definition, tier, uncertainty band, and limitation are explicit. Fudging numbers, silently changing definitions, or using capacity-derived estimates as source-verified totals is not acceptable.

This means:

- T1/T2/T3 are not rhetorical strength labels. They are evidence classes.
- T3 values may be included in the database with wide uncertainty, but they cannot be used as source-verified headline totals.
- Capacity-derived estimates, generation multiplied by assumed rates, and profile-shape relabels cannot support source-lock claims.
- Lower-quality data should be represented with explicit discounts, confidence intervals, upper/lower bands, or structural-gap flags, not hidden or promoted.
- A global total must state which tiers are included and must publish tier-separated subtotals.

## Controlling Rules

| Rule | Source | Operational meaning |
|---|---|---|
| R0.1 | `2026-04-29-data-quality-elevation-backlog.md` | T3 to T2 requires a named source and explicit annual curtailed-energy figure for a specific year. |
| R0.2 | `2026-04-29-data-quality-elevation-backlog.md` | T3 to T1 requires a machine-readable operational source and defensible curtailment value. |
| R0.3 | `2026-04-29-data-quality-elevation-backlog.md` | `kind: "flat"` is a profile shape, not a promotion mechanism. |
| R0.4 | `docs/methodology/uncertainty.md` | Every emitted value must carry a confidence tier and uncertainty envelope. |
| R0.5 | `docs/methodology/uncertainty.md` | T3 is modelled. It can be included with +/-40% peakGW envelope, but it is not measured hourly curtailment. |
| R0.6 | `2026-04-29-missing-coverage-and-regionalization-audit.md` | Do not add launch rows just because IRENA/Ember annual estimates exist. |

## Claim Register

| ID | Current claim | Location | Status | DARI treatment | Journal treatment | Required action |
|---|---|---|---|---|---|---|
| D1 | Bitcoin mining is modular, interruptible, and location-flexible. | DARI sections 2, 8; manuscript intro | Source-supported with literature, but needs exact citations. | Keep with citations and restrained language. | Keep with citations and define operational limits. | Lock to Bastian-Pinto 2022, Menati 2023, Shan 2019, Bruno 2023, Lal 2023, plus mining-demand literature. |
| D2 | Mining revenue is globally liquid, changing demand geography. | DARI section 2 | Interpretive, plausible, not a curtailment-data claim. | Keep as framing if not overused. | Move to motivation or limitations, not result. | Cite mining-economics literature or soften. |
| D3 | Prior work covers Texas, CAISO, project finance, and demand flexibility. | DARI section 2; manuscript intro | Source-supported if citations are checked. | Keep. | Keep. | Verify each cited work actually supports the described scope. |
| D4 | Network-scale coverage test is missing from literature. | DARI section 2; manuscript contribution | Needs literature search qualification. | Use "less developed" or "not yet standardized." | Do not use novelty claim until literature scan is complete. | Add search log or remove novelty claim. |
| D5 | DARI's next step should be a source-verified ELJ Global Curtailment Dataset. | DARI section 9 | Supported by project goal, not an empirical claim. | Keep and strengthen. | Recast as data availability/future work. | Link to dataset schema, tier model, and source audit bundle. |
| D6 | The core purpose is truth-first open database construction, not Bitcoin advocacy. | User instruction, 2026-05-06 | Controlling editorial principle. | Add as methodology/ethics posture. | Add as data-quality and limitations posture. | Include "not all data are equal" and tier-separated outputs. |
| D7 | Lower-quality regions may be included with discounts, confidence intervals, or upper/lower bands. | User instruction; `uncertainty.md` | Source-supported by existing tier system, but needs careful wording. | Keep as database design principle. | Keep as methodology. | Avoid calling discounts "corrections" unless calculation is documented. |
| S1 | Global curtailment pathway starts at 58.3 TWh in 2025 and reaches 100 TWh in 2030. | DARI section 4; manuscript supply model | Non-compliant as a sourced claim. Opus says audit anchors sum to single-digit TWh, not 58.3 TWh. | Only allowed as a didactic scenario, visibly labelled. | Remove or replace. | Replace with tier-separated ELJ-derived range, IEA-anchored parametric scenario, or per-jurisdiction analysis. |
| S2 | Annual curtailed renewable energy becomes comparable to Bitcoin demand by 2025-2030. | DARI summary/results; manuscript abstract/discussion | Not supported under current source-lock. Depends on S1. | Remove from summary; maybe "the framework can test when this occurs under chosen scenarios." | Remove until supply model is rebuilt. | No crossing-year language from S1 in headline/abstract. |
| S3 | 24-hour-equivalent coverage crosses unity in 2028/2027/2026 for 0/30/70% conversion. | DARI summary/results; manuscript abstract/results | Computed from illustrative inputs but not source-supported. | Move to boxed didactic example only, if retained. | Remove from main results. | Label as arithmetic demonstration, not finding. |
| S4 | Daylight-only case weakens result; 0% and 30% do not cross by 2030. | DARI summary/results; manuscript results | Methodologically useful but tied to unsupported S1. | Keep concept; remove exact crossing claims unless boxed as didactic. | Keep as sensitivity concept after rebuild. | Add a sensitivity table after source-locked supply replacement. |
| S5 | `delta = 1.0` treats all curtailed supply as technically available. | DARI framework; manuscript supply model | Transparent upper-bound assumption. | Keep only with clear "deliberately permissive" warning. | Keep as upper-bound scenario, not central result. | Add lower deployable-fraction bands, e.g. 0.1, 0.25, 0.5, 1.0. |
| S6 | `lambda = 0.5` represents daylight-only availability. | DARI framework; manuscript supply model | Acceptable as a sensitivity assumption, not measured. | Keep as illustrative sensitivity. | Keep if justified, but add broader sensitivity. | Add caveat: not a storage/load-matching model. |
| S7 | Source-verified annual anchors sum to single-digit TWh under strict audit. | Opus summary | Needs calculation artifact before publication. | Use internally as warning, not public claim unless computed. | Compute and publish tier-separated totals. | Create script/table that sums T1a/T1b/T1c/T2/T3 separately. |
| R1 | 716 EH/s baseline hashrate. | DARI section 4; manuscript methods | Needs dated source-lock because hashrate changes. | Keep only with date and source. | Keep only with date and source. | Choose exact snapshot date/source, likely Cambridge or network data provider. |
| R2 | 22 J/TH in 2025 improving to 13 J/TH by 2028. | DARI section 4; manuscript demand model | Needs source-lock. | Keep as scenario with citation. | Keep as scenario if literature-backed. | Cite Cambridge DMI report, Paez/PRICE, or hardware fleet-efficiency source. |
| R3 | 2025 demand is about 138 TWh from 716 EH/s and 22 J/TH. | DARI section 4; manuscript methods/results | Arithmetic claim; source depends on R1/R2. | Keep after source-lock. | Keep after source-lock and provide formula/code. | Add reproducible calculation table. |
| R4 | Demand declines to 81.54 TWh by 2028 with no conversion. | Manuscript results | Arithmetic claim; scenario-dependent. | Optional, only in technical appendix. | Keep only after demand assumptions are locked. | Move to scenario table, not narrative headline. |
| R5 | 30% and 70% AI/HPC conversion reduce Bitcoin mining demand. | DARI sections 4, 6; manuscript methods/results | Scenario assumption, not forecast. | Keep as stress-test only. | Keep as sensitivity parameter only. | Avoid implying industry prediction. |
| R6 | AI/HPC conversion may sharpen incentives for remaining miners to seek flexible energy niches. | DARI section 6 | Interpretive and speculative. | Keep only as hypothesis. | Move to discussion limitations or remove. | Add citation from mining-sector AI/HPC trend reports or soften. |
| R7 | Model omits difficulty adjustment, price, fees, entry/exit, contracts, and AI/HPC load elsewhere. | DARI section 6; manuscript discussion | Supported limitation. | Keep. | Keep and expand. | Make this a visible limitations paragraph. |
| F1 | The DARI piece can be a Bitcoin-facing research note while journal stays conservative. | Publication plan | Strategically sound. | Keep. | Keep as workflow separation. | Do not let DARI claims contaminate journal claims. |
| F2 | "Market failure" framing for curtailment. | DARI summary/section 1 | Rhetorical, potentially defensible but broad. | Keep if softened: "often reflects market/grid coordination failure." | Use more technical wording. | Avoid moralizing language in journal. |
| F3 | "Energy produced, then thrown away." | DARI summary | Useful but simplified. | Keep with care. | Avoid or define as "available generation curtailed before delivery." | Add definitional note on physical vs market energy. |
| F4 | "Bitcoin mining should be evaluated not only as an electricity consumer..." | Publication plan | Suitable DARI thesis. | Keep with "not only" and constraints. | Not a journal thesis. | Use as DARI intro, not result. |
| F5 | "What we are NOT claiming" guardrail. | Opus summary recommendation | Strongly recommended. | Add near top. | Use in limitations/contribution. | Explicitly list no absorption forecast, no low-carbon guarantee, no deployability claim. |

## Passages That Should Not Be Published Unchanged

These passages should be treated as controlled hazards until S1 is replaced or demoted to didactic status.

| File | Passage | Why blocked |
|---|---|---|
| `dari_research_note_v0.1.md` | "Under a central illustrative trajectory, the annual quantity of curtailed renewable electricity becomes comparable to Bitcoin network demand within the 2025-2030 horizon..." | Headline crossing-year language depends on non-compliant S1. |
| `dari_research_note_v0.1.md` | "The central illustrative curtailment pathway begins at 58.3 TWh in 2025 and reaches 100 TWh in 2030." | Cannot be presented as a source-grounded global estimate. |
| `dari_research_note_v0.1.md` | Results tables with first crossing years and 2030 ratios. | Arithmetic is valid only inside an illustrative scenario. |
| `manuscript_v0.1.md` | Abstract sentence beginning "Using a central illustrative curtailment trajectory from 58.3 TWh..." | Journal abstract cannot lead with unsupported numerator. |
| `manuscript_v0.1.md` | "The central illustrative curtailment trajectory is 58.3 TWh..." | Must be replaced before submission. |
| `manuscript_v0.1.md` | "The analysis shows that, under central assumptions..." | The current "central" assumptions are not source-locked. |

## Source-Lock Triage

| Priority | Task | Output |
|---:|---|---|
| 1 | Build tier-separated annual totals from current ELJ data. | `T1a`, `T1b`, `T1c`, `T2`, `T2-flare`, `T3`, and all-tier totals with uncertainty bands. |
| 2 | Define public-total policy. | Decide which tier set can be called "source-verified floor" and which can only be "modelled envelope." |
| 3 | Replace S1 in DARI note. | Didactic scenario label plus regional anchor floor. |
| 4 | Replace S1 in journal path. | Bottom-up ELJ-derived range or per-jurisdiction coverage ratios. |
| 5 | Lock demand-side references. | Dated hashrate, fleet efficiency, Cambridge/Paez citations, reproducible calculation script. |
| 6 | Add "What we are NOT claiming." | Guardrail box for DARI, limitations paragraph for journal. |

## Recommended Database Principle

Publish comprehensive data, not comprehensive certainty.

For every region, the database should make four things visible:

1. What exactly is being measured or estimated.
2. Who published the source quantity and at what temporal resolution.
3. What transformation ELJ applied.
4. How wide the confidence envelope is, and why.

This lets ELJ include difficult jurisdictions without pretending they are clean. It also makes the database useful to critics: the strongest version of the project is one where every number can be inspected, downgraded, replaced, or excluded by tier.
