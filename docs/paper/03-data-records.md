# Data Records

_Scientific Data Data Descriptor · Section 3 · Target length 500–1000
words._

The dataset consists of three artefact classes: per-region JSON
snapshots (current state, overwritten on each build), a rolling
Parquet history (one row per region per build, appended), and a
seven-year Parquet backfill (one row per region per hour). All are
distributed together at the Zenodo DOI and mirrored on GitHub raw
URLs.

## 3.1 Per-region JSON snapshots

**Location:** `data/snapshots/last-good/<regionId>.json`
**Count:** 128 files, one per region, covering every entry in
`src/lib/regions.ts`.
**Format:** UTF-8 JSON, ≈ 3 KB per file, schema enforced by
`dataset/schema/region-snapshot.schema.json` (JSON Schema Draft 2020-12).
**Cadence:** overwritten on each scheduled build (~every 6 hours
per GitHub Actions cron).

### Record schema

| Field | Type | Description |
|---|---|---|
| `regionId` | `string` | Stable kebab-case ID matching `src/lib/regions.ts`. |
| `profile` | `number[24]` | 30-day trailing average curtailment in GW per UTC hour. Index 0 = 00:00–01:00 UTC. |
| `latestProfile` | `number[24]` | Single-day latest snapshot in GW per UTC hour. |
| `totalTWh` | `number` | 30-day trailing total curtailment in TWh. |
| `peakGW` | `number` | 30-day trailing peak hourly GW. |
| `lastUpdated` | `string` | Calibration-anchor date — `YYYY`, `YYYY-Q#`, or ISO-8601 timestamp. |
| `sourceNote` | `string` | Human-readable provenance (source, window, calibration rate). |
| `sourceStatus` | `"live" \| "cached" \| null` | Fresh fetch (`live`) or last-good served by `withFallback` (`cached`). |
| `fuelShare` | `Record<string, number>` | Fuel split of curtailed energy, fractions 0–1, keys ⊂ `{solar, wind, hydro, geothermal, flare}`. |
| `uncertaintyLowGW` | `number` | Lower bound of the confidence envelope on `peakGW`. |
| `uncertaintyHighGW` | `number` | Upper bound of the confidence envelope on `peakGW`. |
| `confidenceTier` | `string` | One of `T1-live-TSO`, `T2-annual-calibrated`, `T3-modelled`. |

### Example record

```json
{
  "regionId": "caiso",
  "profile": [0.671, 0.590, 0.304, 0.140, ...],
  "latestProfile": [0.82, 0.71, 0.35, 0.18, ...],
  "totalTWh": 0.2699,
  "peakGW": 0.729,
  "lastUpdated": "2026-04-23T14:15:00Z",
  "sourceNote": "EIA CISO solar curtailment 2026-03-25 → 2026-04-23",
  "sourceStatus": "live",
  "fuelShare": {"solar": 0.88, "wind": 0.12},
  "uncertaintyLowGW": 0.620,
  "uncertaintyHighGW": 0.838,
  "confidenceTier": "T1-live-TSO"
}
```

Full field descriptions and update semantics: `dataset/SCHEMA.md`.

## 3.2 Rolling Parquet history

**Location:** `data/historical/curtailment_history.parquet`
**Format:** Apache Parquet 2.6, Snappy compression, typed columns.
**Cadence:** one row per region per scheduled build (~128 rows / 6 h
≈ 17 MB / year), appended by `scripts/append_history.py` via
`.github/workflows/history-append.yml`.
**Granularity:** build-level snapshot — each row captures the
30-day trailing aggregate at the moment the row was written.

### Schema

| Column | Type | Description |
|---|---|---|
| `build_timestamp` | `string` (ISO-8601 UTC) | Time the row was written. |
| `region_id` | `string` | Matches `regionId` in the JSON snapshot. |
| `peak_gw` | `float32` | 30-day trailing peak hourly GW at build time. |
| `total_twh_30d` | `float32` | 30-day trailing total curtailment in TWh. |
| `source_status` | `string` | `"live"`, `"cached"`, or null. |
| `last_updated` | `string` | Calibration-anchor date. |
| `profile_h00` … `profile_h23` | `float32` × 24 | Hourly profile. |
| `uncertainty_low_gw` | `float32` | Lower bound on `peak_gw`. |
| `uncertainty_high_gw` | `float32` | Upper bound on `peak_gw`. |
| `confidence_tier` | `string` | Tier label. |

## 3.3 Seven-year Parquet backfill

**Location:** `data/historical/curtailment_backfill.parquet`
**Format:** Apache Parquet 2.6, Snappy.
**Size:** 2,590,195 rows (≈ 20 MB compressed).
**Coverage window:** 2020-01-01 → 2026-03-31 (partial-year final
year).
**Regions covered:** 29 (all T1-live-TSO; regions without
multi-year upstream archives are not backfilled).
**Partitioning on disk:** flat per-year files at
`data/historical/backfill/<source>_<zone>_<year>.parquet`
(e.g. `eia_caiso_2024.parquet`, `entsoe_germany_2023.parquet`)
for per-year consumption without a full-file read.

### Schema

| Column | Type | Description |
|---|---|---|
| `observation_timestamp` | `string` (ISO-8601 UTC) | Start of the hour the value covers. |
| `region_id` | `string` | Stable region ID, matches the JSON snapshot. |
| `curtailment_gw` | `float32` | Reconstructed hourly curtailment in GW. |
| `fuel` | `string` | `"wind"`, `"solar"`, `"hydro"`, `"geothermal"`, or `"flare"` — the technology the curtailed energy came from. |
| `source` | `string` | Provenance slug: `"entsoe"`, `"eia"`, `"nord-pool"`, …. |
| `rate_applied` | `float32` | Calibration rate used to convert raw generation into curtailment (`0.0` when the source publishes curtailment directly). |
| `rate_source` | `string` | Human-readable provenance of the rate. |

Confidence-tier and uncertainty columns are deliberately *not* on
this file — the per-tier envelope is calibrated against annual
aggregates and lives on the annual rollup (§3.4). Consumers who
need to attach uncertainty to an hourly slice join the rollup on
`region_id`. Full schema, including the rationale for that split,
is in `dataset/SCHEMA.md` § "Parquet hourly backfill".

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

### Schema

| Column | Type | Description |
|---|---|---|
| `region_id` | `string` | Stable region ID. |
| `year` | `int16` | Calendar year. |
| `source` | `string` | First non-null `source` value within the (region, year) partition. |
| `n_hourly_rows` | `int32` | Non-null hours observed for this region in this year (full year = 8,760, leap year = 8,784). |
| `annual_twh` | `float32` | Σ `curtailment_gw` × 1h ÷ 1000 across the year. |
| `peak_gw` | `float32` | Max hourly `curtailment_gw` across the year. |
| `confidence_tier` | `string` | `T1-live-TSO`, `T2-annual-calibrated`, or `T3-modelled`. |
| `tier_fraction` | `float32` | Per-tier envelope half-width (0.15 / 0.20 / 0.40). |
| `uncertainty_low_gw` | `float32` | `peak_gw × (1 − tier_fraction)`, clamped to ≥ 0. |
| `uncertainty_high_gw` | `float32` | `peak_gw × (1 + tier_fraction)`. |
| `uncertainty_low_twh` | `float32` | `annual_twh × (1 − tier_fraction)`, clamped to ≥ 0. |
| `uncertainty_high_twh` | `float32` | `annual_twh × (1 + tier_fraction)`. |

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
**Size:** 2,306 rows × 3 columns (date, eia_total_gwh,
entsoe_total_gwh).
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
**Count:** 132 files.
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
