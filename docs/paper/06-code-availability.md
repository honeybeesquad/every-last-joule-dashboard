# Code Availability

_Scientific Data Data Descriptor · Section 6 · Target length 100–200
words._

All code used to build, validate, and render the dataset is
publicly available in the repository under an MIT licence
(dataset content remains under CC-BY-4.0; see `dataset/LICENSE`):

- **Repository:**
  https://github.com/honeybeesquad/every-last-joule-dashboard
- **Tagged release:** `v1.0.0` (matches the Zenodo-archived
  DOI).
- **Languages:** TypeScript (Observable Framework data
  loaders), Python 3.12+ (historical backfill, validation,
  figure rendering).
- **Key dependencies:** Observable Framework (dashboard build);
  `matplotlib ≥ 3.10` and `pyarrow ≥ 15` (figure scripts, isolated
  in a local `.venv` per `docs/figures/README.md`).
- **External APIs used** (free, registration required): ENTSO-E
  Transparency Platform, EIA Hourly Electric Grid Monitor,
  Elexon BMRS. No paid tier is used.
- **Agentic workflow artefacts:**
  `scripts/validation/enrich_*.py` (automated validation-MD
  enrichment),
  `docs/academic-model/2026-04-25-gap-closure-plan.md`
  (sprint plan executed by the authoring process),
  `docs/superpowers/` (agent-workflow documentation).

**Regeneration:** Clean-room regeneration of every figure and
every Parquet file from a tagged commit is documented in
`dataset/README.md §Reproducibility`,
`docs/methodology/historical-backfill.md` (backfill chain), and
`docs/figures/README.md` (figure chain). No proprietary data or
manual post-processing is involved at any step.

**Scheduled builds** run via GitHub Actions (`.github/workflows/`)
on a ~6-hour cadence, appending to the rolling Parquet history
and overwriting the per-region JSON snapshots.
