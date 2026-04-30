# Target journal and submission ladder

Last updated: 2026-04-24

## Primary target

**Scientific Data** (Nature Portfolio). Impact factor ≈5–6.

- Flagship venue for *descriptor papers* — dataset-focused, not hypothesis-driven. That matches what this project actually is: a versioned, reproducible curtailment dataset with live feeds and documented calibration.
- Open access as standard.
- Initial review ~6–8 weeks.
- Acceptance rate ≈30–40%.
- Acceptance gives the dataset a durable citation graph (DOI, versioned references, cross-linking from other Nature Portfolio papers).

## Ladder if rejected

In order of preference:

1. **Energy Data in Brief** (Elsevier). Shorter format, open-access option, ~4-week review. Lower prestige but still peer-reviewed and indexed.
2. **Data in Brief** (Elsevier, generic). Last-resort peer-reviewed venue. Not prestigious but indexed and citable.
3. **Environmental Research Letters**. Only if reframed as a *methods* paper rather than a dataset descriptor. Riskier fit but higher visibility than Data in Brief.

## Preprint

- **DARI Working Paper series**, posted simultaneously with the Scientific Data submission.
- DARI working paper number assigned the same week the submission goes in.
- Zero effect on peer review — Scientific Data explicitly permits preprints.
- Gives Simon an immediately citable artifact while the review cycle runs.

## Why this matters for ongoing work

Every defensibility audit (ENTSO-E calibration rates, China province sources, flare/ERCOT/Brazil assumptions, Europe completeness) is being run against the Scientific Data bar: every modelled figure must cite a reachable public source, every assumption must be explicit, every limitation must be documented in `docs/known-limitations.md` and surfaced in `src/methodology.md`.

If a figure can't be defended in the reviewer response letter, it shouldn't be in the dataset.

## Open items (for submission prep)

- Submission timeline (target quarter TBD).
- Figure specifications for the descriptor paper (separate from dashboard figures).
- Reviewer-response dry run once the ENTSO-E + China + flare audits are merged.
- DARI working paper draft in parallel.
