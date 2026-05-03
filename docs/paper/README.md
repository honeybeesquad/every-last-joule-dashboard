# Scientific Data Data Descriptor — section drafts

This directory contains the draft body sections for the Scientific
Data Data Descriptor manuscript that accompanies the Every Last
Joule curtailment-and-flare dataset. Each file is one structural
section per the journal's submission template.

## Section order and word counts

| # | File | Target words | Draft words | Status |
|---:|---|---:|---:|---|
| 1 | [`01-background-and-summary.md`](01-background-and-summary.md) | 500–700 | ~740 | Skeleton draft (Simon keeps final voice) |
| 2 | [`02-methods.md`](02-methods.md) | 1500–3000 | ~1460 | First draft from methodology docs |
| 3 | [`03-data-records.md`](03-data-records.md) | 500–1000 | ~1320 | First draft from `dataset/SCHEMA.md`; reference-table dense, slightly over upper bound |
| 4 | [`04-technical-validation.md`](04-technical-validation.md) | 1000–2000 | ~1590 | First draft from validation-discrepancies.md |
| 5 | [`05-usage-notes.md`](05-usage-notes.md) | 500–1000 | ~940 | First draft from dataset/README.md + known-limitations.md |
| 6 | [`06-code-availability.md`](06-code-availability.md) | 100–200 | ~190 | First draft |
| — | [`figure-captions.md`](figure-captions.md) | n/a | ~970 | Committed in S2 |

**Body total (ex. figure captions):** ≈ 6,240 words — Scientific
Data's typical envelope is 2,500–4,000 words of body + 5 figures + 3
tables (Nature Portfolio submission template). Section 3 sits
slightly above its individual target because it documents the full
column schema for three Parquet files plus four supporting CSVs/JSON
for the figures; trimming the schema tables would push content into
`dataset/SCHEMA.md` which the section already cross-references.

## Section responsibilities

Per submission plan §Work division
(`docs/academic-model/2026-04-24-submission-plan.md`):

- **Simon keeps voice:** §1 Background & Summary (draft is
  evidence skeleton + proposed argument thread only), final
  editorial pass on every section.
- **Codex/Claude-drafted, Simon-reviewed:** §2–§6.

## Cross-references used by the sections

Each section leans heavily on committed methodology and
validation artefacts rather than duplicating their content. Key
cross-references:

- `src/methodology.md` — public methodology page (§2 primary
  source).
- `docs/methodology/uncertainty.md` — tier model and envelope
  calculation (§2, §4).
- `docs/methodology/historical-backfill.md` — backfill
  reconstruction method (§2, §4).
- `docs/methodology/validation-discrepancies.md` — dataset-level
  discrepancy survey (§4 primary source).
- `docs/methodology/entsoe-rates.md` — per-zone ENTSO-E rate
  audit (§2).
- `docs/methodology/china-provinces.md` — China calibration
  audit (§2, §5).
- `docs/methodology/flare-ercot-brazil.md` — flare + ERCOT +
  Brazil audit (§2, §5).
- `dataset/README.md` — dataset card (§3, §5).
- `dataset/SCHEMA.md` — per-field schema (§3 primary source).
- `dataset/FAIR.md` — FAIR self-assessment (§5, §6).
- `dataset/CITATION.cff` — machine-readable citation (§5, §6).
- `docs/known-limitations.md` — documented-gap + blind-spot
  ledger (§5 primary source).
- `docs/validation/<region>.md` — 130 per-region triangulation
  documents (§4).

## Editorial status and next steps

The sections above are **first drafts** suitable for:

1. Simon's final editorial pass to fix voice, tighten
   arguments, and add the Background & Summary opening hook.
2. Pre-submission review by one or two domain readers (per
   gap-closure plan §S4 "peer review round").
3. Scientific Data editor pre-inquiry to confirm fit before
   formal submission.

Zenodo DOI history: v1.0.0 minted 2026-04-27
(`10.5281/zenodo.19835566`), v1.1.0 minted 2026-05-01
(`10.5281/zenodo.19932977`, stale 202-region content), v1.1.1
minted 2026-05-03 (`10.5281/zenodo.19991315`, canonical 233-region
state). Concept DOI `10.5281/zenodo.19835411` resolves to latest.
Cite version DOI `10.5281/zenodo.19991315` in the paper. Any
remaining `<id>` or "TBA" tokens are bugs to flag.

## Assembly for submission

Scientific Data accepts a single-document manuscript (DOCX or
PDF) for initial submission. The final assembly step — combining
these MDs into a single document with figures inlined, citations
formatted per the journal style, and the author metadata — is
deferred to S5 (weeks 19–22 per gap-closure plan). Until then,
each section lives as its own MD for independent editing and
diff-review.
