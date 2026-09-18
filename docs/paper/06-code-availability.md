# Code Availability

_Scientific Data Data Descriptor · Section 6 · Target length 100–200
words._

Code is MIT; dataset content is CC-BY-4.0 (`dataset/LICENSE`).

- **Repository:**
  https://github.com/honeybeesquad/every-last-joule-dashboard
- **Tagged release:** `v1.4.0` (version DOI
  `10.5281/zenodo.22837934`; concept DOI
  `10.5281/zenodo.19835411`) — 459 regions, renewables only.
  v1.3.2 (`10.5281/zenodo.20570864`) is the last mint that included
  flare.
- **Languages:** TypeScript (Observable Framework loaders);
  Python 3.12+ (backfill, validation, figures).
- **Key dependencies:** Observable Framework; `matplotlib ≥ 3.10`
  and `pyarrow ≥ 15` (see `docs/figures/README.md`).
- **External APIs** (free, registration required): ENTSO-E
  Transparency, EIA Hourly Electric Grid Monitor, Elexon BMRS.
  Germany’s live path uses netztransparenz OAuth2.

**Regeneration.** A tagged commit plus those keys rebuilds the
Parquet files and figures. No proprietary step.
`dataset/README.md`, `docs/methodology/historical-backfill.md`,
and `docs/figures/README.md` list the chain.

**Reproducer.** `scripts/reproduce/reproduce_2024_ercot_west.py`
(`npm run reproduce:ercot-west`) rebuilds the 2024 ERCOT-West
partition from the EIA API and matches the committed Parquet to
0.1% on row count and aggregate `curtailment_gw`. ~30 seconds.
The wrapper’s only ERCOT-West-specific constants are
`ISO = "ercot-west"` and `YEAR = 2024`.

Scheduled builds (~6 h) append the rolling Parquet history and
overwrite per-region JSON snapshots.
