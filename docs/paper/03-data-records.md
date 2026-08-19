# Data Records

_Scientific Data Data Descriptor · Section 3 · Target length 500–1000
words._

The dataset consists of three artefact classes: per-region JSON
snapshots (current state, overwritten on each build), a rolling
Parquet history (one row per region per build, appended), and a
seven-year Parquet backfill (one row per region per hour). All are
distributed together at the Zenodo DOI and mirrored on GitHub raw
URLs. Per-column types, units, nullability, and update semantics
for every artefact below are documented in
[`dataset/SCHEMA.md`](../../dataset/SCHEMA.md); §3 here gives only
the locations, sizes, cadences, and cross-references reviewers need
to navigate the records.

## 3.1 Per-region JSON snapshots

**Location:** `data/snapshots/last-good/<regionId>.json`
**Count:** 461 entries emitted, one per region, covering every entry in
`src/lib/regions.ts`.
**Format:** UTF-8 JSON, ≈ 3 KB per file, schema enforced by
`dataset/schema/region-snapshot.schema.json` (JSON Schema Draft 2020-12).
**Cadence:** overwritten on each scheduled build (~every 3 hours
per GitHub Actions cron).

Field-by-field description and an example record live in
`dataset/SCHEMA.md` § "Per-region JSON snapshot". The
`confidenceTier` enum is one of `T1a-live-tso`,
`T1b-live-domestic-anchored`, `T1c-live-neighbour-anchored`,
`T2-annual-calibrated`, `T2-flare`, or `T3-modelled` (legacy
`T1-live-TSO` is retained as an alias for pre-2026-04-25
snapshots).

Six loaders (`aemo`, `brazil-ne`, `entsoe`, `ercot`,
`ercot-native`, `norway`) emit a single JSON file containing a
`Record<regionId, RegionData>` rather than a single record; each
value matches the per-region schema above.

## 3.2 Rolling Parquet history

**Location:** `data/historical/curtailment_history.parquet`
**Format:** Apache Parquet 2.6, Snappy compression, typed columns.
**Cadence:** one row per region per scheduled build, appended by
`scripts/append_history.py` via `.github/workflows/history-append.yml`.
**Granularity:** build-level snapshot. For rows with
`capture_source == "deployed-build"`, each row captures the 30-day
trailing aggregate read from the deployed dashboard at the moment the
row was written.

**Capture-source discontinuity:** rows are labelled by
`capture_source`, which is the load-bearing definition of which era a
row belongs to (the dates below are descriptive, not a filter
boundary - the cutover is identified by the first
`capture_source == "deployed-build"` row, not a fixed calendar date).
`capture_source == "committed-snapshot"` rows (earliest 2026-04-23)
came from a version of `scripts/append_history.py` that read the
repository's committed fallback corpus rather than the deployed
dashboard, so they re-stamp a fresh `build_timestamp` on data that
only actually changed when the corpus was recommitted. That era's 854
builds carry just 35 distinct global totals, including flat stretches
from 2026-06-25 to 2026-08-01 and from 2026-08-03 to 2026-08-19, and
cover 274 regions per build. Once the reworked script first runs after
this PR merges, `deployed-build` rows read the dashboard's live
payloads directly and cover approximately 446 distinct regions per
build (de-duplicated on `regionId` by an explicit freshness rule -
most recent `lastSuccessAt` wins, ties broken by `sourceStatus` - not
by payload path order; some regions, such as `jordan`, are served by
more than one payload file in the same build), including AEMO's
per-plant regions alongside its state aggregates -
summing a build is still correct, because the state aggregates
exclude the named per-plant DUIDs since PR #298. Full accounting, and
guidance for de-duplicating the committed-snapshot era, in
`dataset/SCHEMA.md` § "Parquet rolling history".

Column list and types in `dataset/SCHEMA.md` § "Parquet rolling
history".

## 3.3 Seven-year Parquet backfill

**Location:** `data/historical/curtailment_backfill.parquet`
**Format:** Apache Parquet 2.6, Snappy.
**Size:** 2,590,195 rows (≈ 20 MB compressed).
**Coverage window:** 2020-01-01 → 2026-04-24 (partial-year final
year).
**Regions covered:** 29 (all T1a-live-tso; regions without
multi-year upstream archives are not backfilled).
**Partitioning on disk:** flat per-year files at
`data/historical/backfill/<source>_<zone>_<year>.parquet`
(e.g. `eia_caiso_2024.parquet`, `entsoe_germany_2023.parquet`)
for per-year consumption without a full-file read.

Column list in `dataset/SCHEMA.md` § "Parquet hourly backfill".
Confidence-tier and uncertainty columns are deliberately *not* on
this file — the per-tier envelope is calibrated against annual
aggregates and lives on the annual rollup (§3.4). Consumers who
need to attach uncertainty to an hourly slice join the rollup on
`region_id`.

The backfill is the source of truth for Figures 2, 3, and 5. Figure
4 is independent (tier-assignment only, no hourly data). Figure 1
uses the latest snapshot, not the backfill.

## 3.4 Per-region annual rollup

**Location:** `data/historical/per_region_annual.parquet`
**Size:** 203 rows (29 regions × 7 years).
**Built by:** `scripts/build_annual_rollup.py` from the backfill.
**Purpose:** feeds Figure 5 (top-20 timeseries) and the validation
scatter (Figure 2). This is the file that carries the calibrated
uncertainty envelope; the hourly backfill (§3.3) does not.

Column list in `dataset/SCHEMA.md` § "Parquet annual rollup",
including `tier_fraction` (0.15 T1a / 0.50 T1b / 0.355 T1c / 0.20
T2 / 0.40 T3) and the four `uncertainty_*` bounds derived from it.

## 3.5 Validation scatter CSV

**Location:** `data/historical/figure2_validation_scatter.csv`
**Size:** 23 rows (region-year anchor pairs).
**Built by:** `scripts/validation/figure2_data.py` from
`per_region_annual.parquet` + `scripts/validation/external-anchors.json`.
**Columns:** `region_id`, `region_name`, `year`, `confidence_tier`,
`tier_fraction`, `backfill_twh`, `backfill_low_twh`,
`backfill_high_twh`, `tso_anchor_twh`, `delta_pct`, `anchor_source`.

Published anchors are cited per row in the `anchor_source` column
and traced in detail in `scripts/validation/external-anchors.json`,
which is the machine-readable counterpart to the TSO/IMM/SoM
citation trail documented in `docs/validation/<region>.md`.

## 3.6 Daily global CSV (Figure 3 input)

**Location:** `data/historical/figure3_daily_global.csv`
**Size:** 2,306 rows × 4 columns (`date`, `eia_gwh`,
`entsoe_gwh`, `total_gwh`).
**Built by:** `scripts/validation/figure3_temporal_trace.py`.
**Purpose:** committed alongside `curtailment_backfill.parquet` so
reviewers can reproduce Figure 3 without re-merging the 2.59M-row
archive.

## 3.7 Source anchor table

**Location:** `scripts/validation/external-anchors.json`
**Records:** 123 per-region anchor entries keyed by `regions.ts`
ID. Each entry carries a `tso_annual_latest` summary plus, where
the source publishes them, year-specific fields
(`tso_annual_2023`, `tso_annual_2024`, …) with quoted phrases and
URLs. The strict subset of 23 region-year pairs where a backfilled
year aligns to an exact-year TSO total populates the Figure 2
scatter (§3.5); the broader pool backs the per-region validation
MDs (§3.8) and the discrepancy analysis in §4.

## 3.8 Per-region validation MDs

**Location:** `docs/validation/<region>.md`
**Count:** 468 per-region files (plus a directory `README.md` and a
`_template.md` scaffold = 470 *.md total in the directory).
**Format:** Markdown prose.
**Per-file sections:** upstream source(s), calibration anchor,
discrepancy analysis, v0.5 decision. Generated and enriched via
`scripts/validation/enrich_discrepancy.py` with rule 4 enforced
("say 'no anchor extracted' rather than making one up").

## 3.9 Regeneration chain

Every artefact above is regenerable from upstream sources via
the loaders in `src/data/*.json.ts`. The order of regeneration
for a full rebuild is:

1. Live loaders populate `data/snapshots/last-good/*.json`.
2. `scripts/backfill/` loaders populate the per-year
   partitions of `data/historical/backfill/`.
3. `scripts/backfill/merge_to_parquet.py` consolidates those into
   `curtailment_backfill.parquet`.
4. `scripts/build_annual_rollup.py` produces
   `per_region_annual.parquet`.
5. Figure scripts under `scripts/validation/figure*.py` read
   the parquet artefacts and emit PDF + PNG.

The chain is deterministic; same inputs produce same bytes on
`matplotlib ≥ 3.10` and `pyarrow ≥ 15`.
