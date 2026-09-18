# Data Records

_Scientific Data Data Descriptor · Section 3 · Target 500–1000 words._

Three artefact classes, all at the Zenodo concept DOI and on GitHub: per-region JSON snapshots, a rolling Parquet history, and a seven-year hourly backfill. Field-level schema: `dataset/SCHEMA.md`.

The records below describe **v1.4.0** (459 regions, renewables only; version DOI `10.5281/zenodo.22837934`). Concept DOI `10.5281/zenodo.19835411`. v1.3.2 (`10.5281/zenodo.20570864`) still includes flare.

## 3.1 Per-region JSON snapshots

**Location:** `data/snapshots/last-good/<source>.json` (one file per loader; some files hold many regions).
**Canonical count:** 459 region ids in `src/lib/regions.ts`.
**Schema:** `dataset/schema/region-snapshot.schema.json`.
**Cadence:** overwritten on each scheduled build (~3 hours).

`confidenceTier` is one of `T1a-live-tso`, `T1b-live-domestic-anchored`, `T1c-live-neighbour-anchored`, `T2-annual-calibrated`, `T3-modelled`. Legacy `T1-live-TSO` is an alias of T1a on pre-2026-04-25 snapshots. There is no `T2-flare`.

Some loaders emit a dict of regions (`aemo`, `brazil-ne`, `entsoe`, `ercot`, `norway`, per-plant files). A few payload ids (`north-sea-wind`, `turkey`, …) are pre-split aggregates; they are not in `REGIONS` and must not be summed with their children. List: `KNOWN_AGGREGATE_IDS` in `scripts/ci/check-tier-coherence.ts`.

## 3.2 Rolling Parquet history

**Location:** `data/historical/curtailment_history.parquet`
**Cadence:** one row per region per scheduled append (`scripts/append_history.py`).
**Granularity:** build-level snapshot. Rows with `capture_source == "deployed-build"` are the 30-day trailing aggregate read from the live dashboard at write time.

**Capture-source discontinuity.** `capture_source` is the load-bearing split. `committed-snapshot` rows (from 2026-04-23) were written by a script that read the repo’s fallback corpus, not production, so they re-stamped stale data with a fresh `build_timestamp`. That era’s 854 builds hold 35 distinct global totals. `deployed-build` rows start after the 2026-08-19 rewrite and cover ~446 distinct region ids per build after de-duplication (freshest `lastSuccessAt` wins). Full accounting: `dataset/SCHEMA.md`.

## 3.3 Seven-year Parquet backfill

**Location:** `data/historical/curtailment_backfill.parquet`
**Size:** 2,590,195 rows.
**Window:** 2020-01-01 → 2026-04-24.
**Regions:** 29, the T1 archives that exist (ENTSO-E + EIA families). Per-year partitions under `data/historical/backfill/`.

Figures 2, 3, and 5 read this file. Figure 4 reads `regions.ts` only. Figure 1 reads the latest snapshots.

## 3.4 Annual rollup

**Location:** `data/historical/per_region_annual.parquet`
**Size:** 203 rows (29 regions × 7 years).
**Built by:** `scripts/build_annual_rollup.py`.
Carries the tier envelope; the hourly backfill does not.

## 3.5–3.6 Figure inputs

- `data/historical/figure2_validation_scatter.csv` — 23 region-year anchor pairs.
- `data/historical/figure3_daily_global.csv` — 2,306 daily rows, EIA vs ENTSO-E.

## 3.7 Source anchors

`scripts/validation/external-anchors.json` — per-region TSO/IMM/SoM annuals. The 23 pairs that align to a backfill year feed Figure 2.

## 3.8 Per-region validation notes

`docs/validation/<region>.md` — one note per canonical region, plus a directory README and `_template.md`. Generated via `scripts/validation/build_region_docs.py`; manual blocks survive regen.

## 3.9 Regeneration

1. Live loaders → snapshots.
2. `scripts/backfill/` → per-year partitions.
3. `merge_to_parquet.py` → `curtailment_backfill.parquet`.
4. `build_annual_rollup.py` → annual file.
5. `scripts/validation/figure*.py` → PDF/PNG.

Deterministic on `matplotlib ≥ 3.10` and `pyarrow ≥ 15`.
