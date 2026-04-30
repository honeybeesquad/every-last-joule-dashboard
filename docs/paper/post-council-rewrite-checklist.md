# Paper rewrite checklist — post-council remediation

Date: 2026-04-25 · Owner: Claude (Phase-3 prep) · Consumer: Gemini (paper-rewrite sweep) and Claude (final pass).

This checklist is the mechanical hand-off so the post-merge paper rewrite is a straight execution job, not a discovery exercise. Every line below names a file, a line range, and the council finding driving the change. Sections are grouped by readiness:

- **Edit-now (no dependency)** — fixes that don't depend on Codex/Gemini PRs landing first.
- **Edit-after-B1** — needs CODEX-1 (PT15M overcount fix) to land + B4 re-run before numbers are correct.
- **Edit-after-CODEX-7** — needs the Option B implementation (T1 → T1a/T1b/T1c subdivision) to land before the new tier names exist in the codebase. **B4 Option B is locked** (`docs/proposals/b4-option-b-decision.md`); this section was previously "Edit-after-decision" and is now specialised to that single path.

## Stale rhetoric inventory

### Edit-now: drop "T4-structural-gap" as a tier entry

**Driver:** N1 (Reality Checker) + N2 (taxonomy doc, `docs/methodology/taxonomy.md`).

**Rationale:** T4 was a paper-draft shorthand for "documented-gap." It is not a confidence tier (tiers describe how confidently we know an *emitted* value; gap regions emit nothing). The two-axis taxonomy resolves this: gap regions have `coverage_status = "documented-gap"`, not a T-tier.

**Files / lines:**

| File | Line | Current | Replacement |
|---|---|---|---|
| `docs/paper/02-methods.md` | 184 | `\| T4-structural-gap \| No hourly claim made \| n/a — not published \|` | **Drop the row entirely.** Add a one-sentence note above the table: *"Documented-gap regions (Mexico CENACE, etc.) are listed in `docs/known-limitations.md` and do not appear in this table — they are out-of-scope for tier assignment by definition."* |
| `docs/paper/02-methods.md` | 217 | `These are T4 (structural gap); no synthetic series is published` | `These are documented gaps (taxonomy axis: \`coverage_status = "documented-gap"\`); no synthetic series is published` |
| `docs/paper/02-methods.md` | 218 | `for them. Annual estimates for T4 jurisdictions appear in` | `for them. Annual estimates for documented-gap jurisdictions appear in` |
| `docs/paper/01-background-and-summary.md` | 78 | `hourly source are classified T3 (modelled) or T4 (structural gap,` | `hourly source are classified T3 (modelled) — or, where even an annual anchor is unavailable, are documented as coverage gaps,` |
| `docs/paper/01-background-and-summary.md` | 79 | `not published) rather than filled with fiction. Structural gaps` | `rather than filled with fiction. Documented coverage gaps` |
| `docs/paper/05-usage-notes.md` | 68 | `## 5.3 Structural coverage gaps` | `## 5.3 Documented coverage gaps` |
| `docs/paper/05-usage-notes.md` | 95 | `Full structural-gap ledger: \`docs/known-limitations.md\`.` | `Full documented-gap ledger: \`docs/known-limitations.md\`.` |
| `docs/paper/05-usage-notes.md` | 191 | `\`docs/known-limitations.md\` — complete structural-gap and` | `\`docs/known-limitations.md\` — complete documented-gap and` |
| `docs/paper/README.md` | 62 | `\`docs/known-limitations.md\` — structural-gap + blind-spot` | `\`docs/known-limitations.md\` — documented-gap + blind-spot` |

### Edit-now: introduce two-axis taxonomy in §1

**Driver:** N2 (`docs/methodology/taxonomy.md`).

**Rationale:** §1 currently uses three numbered "aspects that distinguish this dataset" without naming the axes formally. Aligning the §1 framing with the taxonomy doc gives reviewers a clean mental model.

**Surgical change in `docs/paper/01-background-and-summary.md`** at line 67–84:

Replace the existing "What distinguishes this dataset (150 words)" section with:

```markdown
## What distinguishes this dataset (150 words)

The dataset is organised on two orthogonal axes (full taxonomy:
`docs/methodology/taxonomy.md`):

| | `published` | `documented-gap` |
|---|---|---|
| **`curtailment-renewable`** | 124 regions: live ENTSO-E/EIA/AEMO/Elexon/etc.; T2 calibrated; T3 modelled. | Mexico CENACE, parts of SE Asia, Iran solar… (see `docs/known-limitations.md`) |
| **`flare-associated-gas`** | 4 regions: Permian, West Siberia, South Iraq, East Saudi. | Iran flaring (no GGFR-equivalent disaggregation). |

Three aspects set this work apart:

1. **Reproducibility-first.** Every loader is deterministic given
   its upstream response. Every figure is regenerable from
   committed source data on a clean `matplotlib`+`pyarrow` install.
2. **Honest coverage.** Gap regions are documented, not invented.
3. **Tier-explicit uncertainty.** Every emitted value carries a
   confidence tier with an empirically-anchored envelope.
```

This subsumes lines 67–84 of the current draft. Word count is preserved.

### Edit-now: reconcile region count

**Driver:** B2/B3 (Code Reviewer) — bundled in GEMINI-1.

**Rationale:** The paper draft already says "128 regions" correctly in `01-background-and-summary.md` line 15 and §3.1 — but the README + paper need to confirm 128 is the canonical number AFTER GEMINI-1's reconciliation lands. If GEMINI-1 finds a higher count (e.g. by counting ISO-NE + NYISO aggregates), the paper draft updates accordingly.

**Action:** confirm region-count alignment between:
- `README.md:3, 17`
- `docs/paper/01-background-and-summary.md:15, 47`
- `docs/paper/03-data-records.md` (region table)
- `docs/paper/figure-captions.md` (any caption mentioning N)

Re-run `scripts/tally-tiers.ts` (post-B2/B3) — that's the source of truth. **No edit needed yet** — wait for GEMINI-1.

### Edit-after-B1: TWh values in figure captions and §4

**Driver:** B1 (CODEX-1, PT15M overcount fix).

**Rationale:** B1 reduces ENTSO-E TWh values by ~75% (per `docs/methodology/uncertainty-recalibration.md`). Every paper number that cites a European-zone TWh is wrong as written.

**Files affected (likely; verify post-B1):**

| File | Symptom | Verification |
|---|---|---|
| `docs/paper/04-technical-validation.md` lines 31-105 | Δ% values for ENTSO-E zones | Re-run `python3 scripts/calibration/empirical_tier_bands.py --by-tier` post-B1; compare table of worst offenders to current draft. |
| `docs/paper/figure-captions.md` lines 80-100 | Figure 4 region counts and tier bands | Regenerate figure 4 (`python3 scripts/validation/figure4_coverage_map.py`) and confirm caption matches output. |
| `docs/paper/figure-captions.md` lines 17-25 | Figure 1 globe pillars (heights ∝ TWh) | Regenerate figure 1; pillar heights for European zones drop ~75%. |
| `docs/paper/03-data-records.md` (any TWh table) | Per-region annual totals | Regenerate from rebuilt parquet. |

**Sequence:** wait for B1 PR merge → regenerate `data/historical/per_region_annual.parquet` → re-run figures → regenerate validation MDs (`build_region_docs.py`) → THEN sweep paper draft. Each upstream regen takes ~minutes; the prose sweep is the long-pole.

### Edit-after-B1: B5 demote neighbour-anchored ENTSO-E zones

**Driver:** B5 (Code Reviewer + my B4 analysis).

**Rationale:** Once B1 corrects the PT15M overcount, the residual large Δ% will be a smaller set: zones with neighbour-extrapolated rates (Switzerland, Italy splits, possibly Greece). These graduate to a new T1c sub-tier (or stay T1 with documented bias — depends on Option A/B/C decision).

**Files affected:**

| File | Action |
|---|---|
| `src/lib/regions.ts` | Switch ~6–10 zones from `tier: "live"` to a new `tier: "live-neighbour-anchored"` (or similar) |
| `src/lib/uncertainty.ts` | Add the new tier to `deriveTier` and `applyUncertainty` |
| `tests/regions.test.ts` | Update tier counts |
| `docs/paper/02-methods.md` lines 174-196 | Add the new tier row to the §2.5 table |
| `docs/paper/05-usage-notes.md` lines 55-64 | Add the new tier row to the §5.2 table |

**Sequence:** B1 must land first. Then I run B4 re-analysis to identify the residual outlier set. Then B5 implementation.

### Edit-after-CODEX-7: T1 → T1a/T1b/T1c subdivision

**Driver:** B4 Option B is the locked decision (`docs/proposals/b4-option-b-decision.md`).

**What changes:** the single "T1 ±15%" envelope splits into three
sub-tiers reflecting calibration-rate provenance. Every "T1" reference
in the paper is annotated to specify which sub-tier; no unqualified "T1"
remains.

**Files touched:**

| File | Edit |
|---|---|
| `docs/paper/02-methods.md` §2.5 tier table | 4 rows → 6 rows (T1a, T1b, T1c, T2, T2-flare, T3). Structural form fixed in `b4-option-b-decision.md`; counts come from `npm run tally:tiers`; T1c envelope number from post-B1 B4 rerun. |
| `docs/paper/05-usage-notes.md` §5.2 tier table | Same 6-row structure. |
| `docs/paper/01-background-and-summary.md` | Tier-count breakdown updates to enumerate T1a/T1b/T1c separately. |
| `docs/paper/04-technical-validation.md` §4.2 worst-offender table | Each zone annotated with its sub-tier classification post-rerun. |
| `docs/paper/figure-captions.md` | Every "T1" mention specifies sub-tier. Figure 4 legend breaks T1 into three bands. |
| `README.md` | Tier breakdown updates to 6-row form. |
| `tests/__golden__/tally-tiers.txt` | Regenerated post-CODEX-7. |

**Predicted T1c population** (per `b4-option-b-decision.md`): Switzerland
(Czech rate), Italy splits — Centre-North, Sicily, Sardinia (peninsular
rate), possibly Greece. ~6 zones. Final list locked when Claude reruns
`empirical_tier_bands.py` post-B1.

**Sequence:** CODEX-1 lands → Claude reruns B4 → CODEX-7 dispatch goes
out with concrete zone lists + envelope number → CODEX-7 merges → this
sweep block executes. Doing the prose sweep before CODEX-7 lands is
wasted work because the new tier names don't exist in tally output yet.

## Sweep order (when ready)

```
GEMINI-1 lands (B2+B3+N1)
  ↓
Edit-now block: ~15 minutes mechanical edits across 6 files
  ↓
CODEX-1 lands (B1)
  ↓
Regenerate parquet + figures + validation MDs (~10 min CI time)
  ↓
Claude runs `empirical_tier_bands.py` against fresh data → identifies
  T1b and T1c zone sets, derives empirical T1c envelope
  ↓
Claude dispatches CODEX-7 (Option B impl: regions.ts + uncertainty.ts +
  tests + tally golden + validation MDs)
  ↓
CODEX-7 lands
  ↓
Edit-after-CODEX-7 block: ~4 hours mechanical paper sweep
  ↓
Final paper sweep, re-typecheck citations, ship
```

## What stays

The paper draft has good bones. Sections that are already correct and don't need rewriting:

- §1 opening hook (line 9-15): factual, accurate, no stale rhetoric.
- §2.1–§2.4: tier-derivation prose is fine; the table at §2.5 is the only stale piece.
- §2.6 (regime-changes) and §2.8 (agentic workflow disclosure): correct as-is.
- §3 (Data Records): structural; no numbers in prose.
- §4.3 cause-class breakdown (lines 53-105): Δ% values change post-B1 but the *structure* (scope-mismatch / definitional / regime / over-under-calibration) is preserved.
- §4.4–§4.5: independent of any council finding.
- §5.1, §5.4–§5.5: no stale rhetoric.
- §6 Code Availability: short, correct.
- `figure-captions.md` figure-caption *structure*: only TWh numbers and tier-band phrasing change.

## Acceptance criteria

The paper rewrite is considered done (Phase-3 ready to ship) when:

1. No occurrence of "T4" remains in `docs/paper/*.md` or the README. (`grep -r "T4" docs/paper/ README.md` returns empty.)
2. No occurrence of "three pillars" remains. (Already clean per 2026-04-25 audit.)
3. Every "T1 ±15%" mention is annotated with its specific sub-tier (T1a, T1b, or T1c) per the locked Option B decision. No unqualified "T1" remains.
4. Every TWh value in §4 and figure captions matches the post-B1 regenerated figures.
5. Region count in README + §1 + figure captions matches `npm run tally:tiers` output.
6. Two-axis taxonomy table appears once in §1.
7. `python3 scripts/validation/build_region_docs.py --check` (per CODEX-6) passes — no docs drift.

## Out of scope

- Reorganising the paper structure. The 6-section Scientific Data template is fine.
- Moving anything into supplementary materials. Stay within the 6 numbered sections.
- Citing this checklist in the paper itself. It's an internal hand-off doc.
