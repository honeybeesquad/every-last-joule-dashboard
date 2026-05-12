# Every Last Joule

Hourly renewable-electricity curtailment and associated-gas flaring across **384 regions** on six continents. Live dashboard at **[everylastjoule.com](https://everylastjoule.com)**.

This repository contains both the published dataset (the academic artefact) and the dashboard build that produces it (the engineering artefact).

## Where to start

- **You're reading the paper** → [`docs/paper/`](docs/paper/) — Scientific Data Data Descriptor draft (background, methods, data records, technical validation, usage notes, code availability) plus journal-ready figure captions.
- **You want the dataset** → [`dataset/README.md`](dataset/README.md) — schema, citation, FAIR scorecard, and load examples for Python / DuckDB / direct JSON. Versioned, CC-BY-4.0, reproducible from a clean clone.
- **You want to look at a region's calibration** → [`docs/validation/<region>.md`](docs/validation/) — 130 per-region triangulation files vs. published TSO / ISO / IMM / SoM / IRENA / Ember / GGFR annual totals, with diagnostic prose for every material discrepancy.
- **You want the methodology** → [`src/methodology.md`](src/methodology.md) (public-facing) and [`docs/methodology/uncertainty.md`](docs/methodology/uncertainty.md) (tier model, envelope rationale).
- **You want to run the dashboard locally** → see "Develop" below.

## What this dataset is

A versioned, reproducible synthesis of hourly curtailment series, with **per-region provenance, calibration rate, and confidence tier** on every emitted row. The 384 regions break down across the T1a/T1b/T1c (live), T2 / T2-flare (annual-calibrated), and T3 (modelled) tiers — run `npm run tally:tiers` for the authoritative current breakdown and per-bucket region list.

A seven-year hourly reconstruction (2020-01-01 → 2026-04-24, **2,590,195 rows × 29 regions**) is published alongside the live snapshots in [`data/historical/curtailment_backfill.parquet`](data/historical/). Methodology in [`docs/methodology/historical-backfill.md`](docs/methodology/historical-backfill.md).

## Develop

Requires Node 20 (`nvm use`).

    npm install            # install deps
    npm run dev            # local Observable Framework preview
    npm run build          # produce a static dist/
    npm test               # vitest unit tests
    npm run typecheck      # tsc --noEmit
    npm run validate       # validate every committed snapshot against the schema
    npm run tally:tiers    # print the canonical T1 / T2 / T2-flare / T3 tally

CI runs `typecheck`, `test`, `validate`, and `tally:tiers` on every push and PR — see [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

Live data loaders need free upstream API tokens (`ENTSOE_TOKEN`, `EIA_API_KEY`, `ELEXON_API_KEY`, optional `ERCOT_*` bundle); see [`docs/data-source-log.md`](docs/data-source-log.md). Without them the build still succeeds — every loader wraps its fetch in [`src/lib/resilient.ts::withFallback`](src/lib/resilient.ts), which serves the last-good committed snapshot from `data/snapshots/last-good/`.

## Repository layout

| Path | What's there |
|---|---|
| `dataset/` | Academic-facing entry point — README, SCHEMA, CITATION.cff, FAIR.md, CHANGELOG, schema JSON. |
| `docs/paper/` | Scientific Data manuscript draft (six body sections + figure captions). |
| `docs/methodology/` | Per-source audit trails — ENTSO-E rate calibration, China provinces, flare/ERCOT/Brazil, historical-backfill, uncertainty. |
| `docs/validation/` | 130 per-region triangulation files vs. published anchors (plus a directory README and `_template.md`). |
| `docs/figures/` | Five publication-grade figures (PDF + PNG) regeneratable from `scripts/validation/figure*.py`. |
| `data/snapshots/last-good/` | One JSON per loader; the resilient-fetch fallback corpus. |
| `data/historical/` | Rolling Parquet history + seven-year backfill + figure-2/3 source CSVs. |
| `src/` | Observable Framework dashboard source (data loaders, lib, components, methodology page). |
| `scripts/` | Validators, tier tally, backfill loaders, figure generators, append-history job. |

## Citation

> Collins, S. (2026). _Every Last Joule: an hourly synthesis of renewable-electricity curtailment and associated-gas flaring across 384 regions._ Scientific Data (in review). Dataset version: v1.3.1; Zenodo version DOI [10.5281/zenodo.20136284](https://doi.org/10.5281/zenodo.20136284); concept DOI [10.5281/zenodo.19835411](https://doi.org/10.5281/zenodo.19835411) always resolves to latest.

Machine-readable: [`dataset/CITATION.cff`](dataset/CITATION.cff).

## Licence

Code: MIT (see `LICENSE`). Data: CC-BY-4.0 (see [`dataset/LICENSE`](dataset/LICENSE)).

## Contact

Open an issue: https://github.com/honeybeesquad/every-last-joule-dashboard/issues — or email simon@collins.nu.
