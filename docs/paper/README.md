# Scientific Data Data Descriptor — section drafts

Draft body for a Scientific Data Data Descriptor of the Every Last
Joule curtailment dataset. One file per journal section. This is a
**draft**. It is not in review.

The public DARI argument lives in `src/paper.md` (and
`docs/dari/paper.html`). This folder is the dataset descriptor:
what the files are, how they were built, how they were checked.

## v1.4.0 vs archived v1.3.2

| | v1.4.0 (this draft) | v1.3.2 |
|---|---|---|
| Regions | **459** | 385 |
| Scope | Renewables only (solar, wind, hydro, geothermal) | Curtailment + associated-gas flaring |
| Tiers | T1a 160, T1b 26, T1c 1, T2 23, T3 249 | Includes a T2-flare bucket |
| Version DOI | `10.5281/zenodo.22837934` | `10.5281/zenodo.20570864` |

These drafts describe **v1.4.0** (`10.5281/zenodo.22837934`). Cite
the version you used. Concept DOI `10.5281/zenodo.19835411` resolves
to latest. v1.3.2 is a different artefact and is not silently
rewritten.

Figures 1 and 4 still need a regen pass (`docs/figures/`). The
committed images show the pre-purge flare palette.

## Section order

| # | File | Target words | Status |
|---:|---|---:|---|
| 1 | [`01-background-and-summary.md`](01-background-and-summary.md) | 500–700 | Rewritten for HEAD; Simon keeps final voice |
| 2 | [`02-methods.md`](02-methods.md) | 1500–3000 | HEAD methods; backfill still 29 regions |
| 3 | [`03-data-records.md`](03-data-records.md) | 500–1000 | 459; no `T2-flare`; capture_source split kept |
| 4 | [`04-technical-validation.md`](04-technical-validation.md) | 1000–2000 | 23-pair scatter kept; §4.5–4.8 on HEAD |
| 5 | [`05-usage-notes.md`](05-usage-notes.md) | 500–1000 | v1.4.0 load paths; v1.3.2 archived citation kept |
| 6 | [`06-code-availability.md`](06-code-availability.md) | 100–200 | v1.4.0 tag; `10.5281/zenodo.22837934` |
| — | [`figure-captions.md`](figure-captions.md) | n/a | 459 counts; regen flagged |

The combined file
[`every-last-joule-scientific-data-draft.md`](every-last-joule-scientific-data-draft.md)
is a pointer, not a second manuscript.

## Cross-references

- `src/methodology.md` — public methodology (CI-gated counts)
- `docs/methodology/uncertainty.md`, `historical-backfill.md`,
  `validation-discrepancies.md`, `entsoe-rates.md`,
  `china-provinces.md`
- `dataset/README.md`, `SCHEMA.md`, `FAIR.md`, `CITATION.cff`
- `docs/known-limitations.md`
- `docs/validation/<region>.md`

## Assembly

Scientific Data wants a single DOCX or PDF. Combining these MDs,
inlining regenerated figures, and formatting citations is still
ahead of any submission. Do not claim the journal has it.

Zenodo history: v1.0.0 `10.5281/zenodo.19835566` … v1.3.2
`10.5281/zenodo.20570864` (last flare-inclusive mint). v1.4.0
`10.5281/zenodo.22837934`. Concept DOI `10.5281/zenodo.19835411`
resolves to latest.
