# Scientific Data submission plan — 2026-11 target

Status: **Approved 2026-04-24** · Author: Simon Collins (solo) · Target submission: early November 2026

## Decision summary

- **Primary venue:** Scientific Data (Nature Portfolio, IF ~9, 30–40% acceptance)
- **Fallback ladder:** ESSD (Earth System Science Data) → Data in Brief (with parent analysis paper) → DARI Working Paper series (parallel preprint)
- **Companion paper:** Joule or Applied Energy — a hypothesis-testing analysis paper citing the dataset DOI, drafted in parallel with the descriptor and submitted after descriptor acceptance
- **Authorship:** Solo (Simon Collins). Codex/Claude agentic workflow disclosed in Methods section as a methodological novelty, not as co-authorship
- **Repo layout:** option C — `/dataset/` subdir with own README/CHANGELOG/schema within the existing dashboard repo. Zenodo archives the whole repo; descriptor paper points at `github.com/honeybeesquad/every-last-joule-dashboard/tree/v1.0.0/dataset/`

## Why Scientific Data

Based on a survey of the 10 most recent Data Descriptors (2026-04-24):

- 6 of 10 were synthesis-with-calibrated-fills — the same pattern as our dataset
- Global coverage accepted (2/10 explicitly global)
- Energy/grid work accepted but rare (#11 just outside the sample: synchrophasor grid-integrity attacks)
- Short temporal horizons tolerated when well-characterised (4/10 had <1yr histories)

Scientific Data publishes exactly our pattern. The weakness is the Technical Validation section — synthesis papers live or die there.

## Risks and mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Technical validation discrepancies vs IRENA/Ember >25% | Medium | 2-week calibration-rework buffer in S2 |
| Parquet history thin (~6mo) at submission | High | Document versioned-Zenodo-deposit cadence post-publication; most reviewers accept |
| Editor desk-reject on scope ("not Earth-system enough") | Low-Medium | Pre-submission inquiry in S4 catches this cheaply; pivot to ESSD adds ~3wk |
| Figure quality insufficient (descriptors live/die on figures) | Medium | 3 figure iterations in S3 |
| Reviewer asks for 12+ mo history | Medium | Commit in the submission to versioned quarterly Zenodo releases |
| Codex quota exhausted mid-sprint | Low | Sprint planning accounts for daily reset; backup via Claude Agent SDK |

## 6-month timeline

| Sprint | Window | Deliverable | Parallelism |
|---|---|---|---|
| **S0 Foundation** | Wks 1–2 (2026-04-28 → 2026-05-12) | Merge 5 branches; `/dataset/` scaffold; Zenodo DOI; v1.0.0 tag | Serial, ~2 days Simon |
| **S1 Validation** | Wks 3–6 (05-12 → 06-09) | Per-region triangulation vs IRENA/Ember/TSO annuals; 78 × `docs/validation/<region>.md`; global validation figure | ~8 parallel codex (10 regions each) |
| **S2 Uncertainty** | Wks 7–10 (06-09 → 07-07) | `uncertaintyLow/High/ConfidenceTier` fields on RegionData; per-tier methodology | 4 parallel codex (one per tier) |
| **S3 Descriptor draft** | Wks 11–14 (07-07 → 08-04) | Scientific Data paper draft + 5 figures | 6 parallel codex (one per section) + figure codex |
| **S4 Pre-submission** | Wks 15–18 (08-04 → 09-01) | FAIR self-assessment; peer review round; editor pre-inquiry; revisions | Mostly Simon |
| **S5 Submit + companion** | Wks 19–22 (09-01 → 09-29) | Submit to Scientific Data; DARI preprint deposit; Joule companion draft | Parallel companion stream |
| **S6 Review cycle** | Wks 23–27 (09-29 → 11-03) | Reviewer responses; companion paper polish | Reactive |

## Work division

**Codex eats:**
- Per-region validation research (~78 regions × ~1hr = 78hr, parallelised ≈10× = overnight runs)
- Uncertainty band derivation (rule-based per source tier)
- Draft prose generation from existing methodology docs
- Figure code (Observable Plot / D3 / matplotlib)
- Companion analysis paper first draft
- Routine revisions after peer review

**Simon keeps:**
- Background & Summary (voice)
- Scientific Data editor pre-inquiry
- Peer-reviewer outreach
- Reviewer-response letters (final word)
- Final polish passes

## S0 (Foundation) detail

1. **Merge pending branches into v0-build:**
   - `europe-expansion` (Norway NO1–NO5 + Switzerland, live ENTSO-E) — `fc7785d`
   - `codex/europe-completeness` (coverage audit doc) — `f883fcb`
   - `codex/entsoe-rates` (ENTSO-E rate calibration) — `5a6577f`
   - `codex/china-provinces` (Chinese province calibration) — `60587de`
   - `codex/flare-ercot-brazil` (GGFR 2025 flare revision + ERCOT/Brazil docs) — `a0b3e9b`

2. **Scaffold `/dataset/` subdir:**
   - `dataset/README.md` — dataset description, usage, citation
   - `dataset/CHANGELOG.md` — versioned release history
   - `dataset/SCHEMA.md` — parquet schema, JSON schema for per-region payloads
   - `dataset/FAIR.md` — FAIR self-assessment (placeholder, completed in S4)
   - `dataset/CITATION.cff` — citation metadata
   - `dataset/LICENSE` — CC-BY-4.0 for data (code stays under repo's existing licence)

3. **Zenodo integration** (Simon-action, ~30 min):
   - Enable GitHub → Zenodo toggle at https://zenodo.org/account/settings/github/
   - Flip the every-last-joule-dashboard repo switch to on
   - Edit repo metadata (title, description, authors, keywords)

4. **Tag v1.0.0:**
   - Create annotated tag with release notes summarising the 5 merged branches
   - Push tag. Zenodo auto-archives on tag push, mints DOI within ~5 min
   - Add returned DOI to `dataset/CITATION.cff` and `dataset/README.md`

## Success criteria for S0

- [ ] All 5 branches merged to v0-build with passing tests
- [ ] `/dataset/` subdir scaffolded and committed
- [ ] v1.0.0 tag pushed
- [ ] Zenodo DOI minted and recorded in `dataset/CITATION.cff`
- [ ] Dashboard deployment still green (Vercel builds successfully from merged v0-build)

## Out of scope for this submission

- Hardware measurement primary data (we're explicitly a synthesis)
- Pre-2024 historical backfill (forward-looking dataset, no claim of historical completeness)
- Jurisdictions with no public TSO data (documented as "structural gap" in Methods)
- Real-time API for external consumers (dashboard is the only consumer; dataset users pull Parquet snapshots)

## References

- `docs/academic-model/target-journal.md` — venue ladder and why Scientific Data
- `docs/methodology/entsoe-rates.md` — ENTSO-E rate audit (S1 input)
- `docs/methodology/china-provinces.md` — China province calibration (S1 input)
- `docs/methodology/flare-ercot-brazil.md` — flare revision + ERCOT/Brazil audit (S1 input)
- `docs/coverage-gaps-europe.md` — Europe coverage audit (S1 input)
- `docs/known-limitations.md` — running limitations ledger (S3 input)
- `src/methodology.md` — public methodology page (S3 input)
