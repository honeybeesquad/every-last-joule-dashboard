# Schema

Two artifacts are published: per-region JSON snapshots (one file per region, overwritten on each build) and a rolling Parquet time-series (appended after each successful build).

## Per-region JSON snapshot

Location: `data/snapshots/last-good/<regionId>.json`

One file per region. Overwritten on each scheduled build. Historical values accessible via the Parquet archive or Zenodo-archived tags.

### Fields

| Field | Type | Description | Nullable |
|---|---|---|---|
| `regionId` | `string` | Stable ID matching `src/lib/regions.ts`. Kebab-case. E.g. `caiso`, `ercot-west`, `brazil-ne-ceara`. | No |
| `profile` | `number[24]` | 30-day trailing **average** curtailment in GW per UTC hour. Index 0 = 00:00–01:00 UTC. | No |
| `latestProfile` | `number[24]` | Single-day latest snapshot in GW per UTC hour. For intraday dashboards. | No |
| `totalTWh` | `number` | 30-day trailing total curtailment in TWh (sum of `profile` × 24 × 30). | No |
| `peakGW` | `number` | 30-day trailing peak hourly GW. | No |
| `lastUpdated` | `string` | Calibration-anchor date. Format varies by source: `YYYY` (annual anchor), `YYYY-Q#` (quarterly), or ISO-8601 (live). | No |
| `lastSuccessAt` | `string` | ISO-8601 UTC timestamp when the snapshot was last successfully refreshed. | No |
| `sourceNote` | `string` | Human-readable provenance. E.g. `"ENTSO-E Transparency B19 dispatch-down 2026-01 → 2026-04 · rate 0.04"`. | No |
| `sourceStatus` | `"live" \| "cached" \| "degraded" \| null` | `live` = fresh fetch succeeded; `cached` = recent `withFallback` last-good; `degraded` = stale last-good beyond the configured threshold. Null only for purely static regions. | Yes |
| `fuelShare` | `Record<string, number>` | Fuel-type split of the curtailed energy, fractions 0–1, keys in `{solar, wind, hydro, geothermal, flare}`. May be empty for flare-only regions. | No (may be `{}`) |
| `confidenceTier` | `string` | One of `"T1-live-TSO"`, `"T2-annual-calibrated"`, `"T3-modelled"`. Derived deterministically by `src/lib/uncertainty.ts::deriveTier`. See `docs/methodology/uncertainty.md`. | Yes (legacy snapshots may pre-date S2 enrichment) |
| `uncertaintyLowGW` | `number` | Lower bound of the per-tier envelope on `peakGW`. `max(0, peakGW − δ)`. | Yes |
| `uncertaintyHighGW` | `number` | Upper bound of the per-tier envelope on `peakGW`. `peakGW + δ`. | Yes |
| `generationProfile` | `number[24]` | Optional 30-day trailing average **gross renewable generation** in GW per UTC hour. Companion to `profile` as part of the v1.0.0 two-output positioning: when present, exposes the gross renewable generation that the curtailment estimate was computed against. The contract is locked in v1.0.0; loaders populate the field progressively across v1.x. | Yes (absent on loaders that have not yet exposed generation as a first-class field) |
| `generationTotalTWh` | `number` | Optional 30-day trailing total gross renewable generation in TWh. Companion to `generationProfile`. | Yes |

### Example

```json
{
  "regionId": "caiso",
  "profile": [0.671, 0.590, 0.304, 0.140, ...24 values],
  "latestProfile": [0.82, 0.71, 0.35, 0.18, ...24 values],
  "totalTWh": 0.2699,
  "peakGW": 0.729,
  "lastUpdated": "2026-04-23T14:15:00Z",
  "sourceNote": "EIA CISO solar curtailment 2026-03-25 → 2026-04-23",
  "sourceStatus": "live",
  "fuelShare": {"solar": 0.88, "wind": 0.12},
  "confidenceTier": "T1-live-TSO",
  "uncertaintyLowGW": 0.620,
  "uncertaintyHighGW": 0.838
}
```

### Multi-region snapshots

Six loaders (`aemo`, `brazil-ne`, `entsoe`, `ercot`, `ercot-native`, `norway`) emit a single JSON file containing a `Record<regionId, RegionData>` rather than a single record. The keys are stable region IDs from `src/lib/regions.ts`; each value matches the per-region schema above.

### JSON Schema

Machine-readable version: [`schema/region-snapshot.schema.json`](schema/region-snapshot.schema.json), covering the per-region shape including the S2 uncertainty fields (`confidenceTier`, `uncertaintyLowGW`, `uncertaintyHighGW`) and the v1.0.0 two-output generation fields (`generationProfile`, `generationTotalTWh`).

### Two-output positioning (v1.0.0+)

The dataset documents both gross renewable generation and the curtailment fraction derived from it. The curtailment fields (`profile`, `totalTWh`, `peakGW`) are required and populated for every region. The generation fields (`generationProfile`, `generationTotalTWh`) are optional and reserved in the v1.0.0 schema contract; individual loaders expose them as the upstream feed permits, so the absence of `generationProfile` for a given region snapshot means the loader has not yet been migrated to the two-output convention, not that generation is unmeasured. Consumers that only need curtailment can ignore the generation fields entirely; consumers that need supply-side renewable totals should filter to records with non-null `generationTotalTWh`.

## Parquet rolling history

Location: `data/historical/curtailment_history.parquet`

One row per region per successful scheduled build. Appended by `scripts/append_history.py` via `.github/workflows/history-append.yml` (daily at 02:00 UTC plus on every successful refresh).

Compression: Snappy. Format: Parquet 2.6. Typical size: ~100 bytes per row × 128 regions × ~4 builds/day ≈ **17 MB / year**.

### Columns

| Column | Type | Description |
|---|---|---|
| `build_timestamp` | `string` (ISO-8601 UTC, sortable) | Time the row was written. Equivalent to tag timestamp for tagged builds. |
| `region_id` | `string` | Matches `regionId` in the JSON snapshot. |
| `peak_gw` | `float32` | 30-day trailing peak hourly GW at build time. |
| `total_twh_30d` | `float32` | 30-day trailing total curtailment in TWh at build time. |
| `source_status` | `string` | `"live"`, `"cached"`, `"degraded"`, or null. |
| `last_updated` | `string` | Calibration-anchor date. |
| `last_success_at` | `string` | ISO-8601 UTC timestamp when the snapshot was last successfully refreshed. |
| `confidence_tier` | `string` | `"T1-live-TSO"`, `"T2-annual-calibrated"`, or `"T3-modelled"`. (`"T4-structural-gap"` is reserved in the enum but never emitted — structural-gap regions do not appear in the dataset at all.) |
| `uncertainty_low_gw` | `float32` | Lower bound of the per-tier envelope on `peak_gw` (`max(0, peak_gw − δ)`). |
| `uncertainty_high_gw` | `float32` | Upper bound of the per-tier envelope on `peak_gw` (`peak_gw + δ`). |
| `profile_h00` … `profile_h23` | `float32` × 24 | Average curtailment in GW per UTC hour, matching JSON `profile`. |

The three confidence-tier columns were added by the S2 uncertainty sprint (2026-04-24). Rows written before that date carry null values in those columns; `pyarrow.concat_tables(promote_options="default")` fills them on the next append, so the committed Parquet may contain a mix of pre-S2 and post-S2 rows depending on when it was last refreshed.

The confidence tier is derived deterministically from `Region.tier` plus the loader's profile kind by `src/lib/uncertainty.ts::deriveTier`. The envelope half-width δ is per-tier (2σ from backfill where available, otherwise ±15% / ±20% / ±40% of `peak_gw`). Full methodology in `docs/methodology/uncertainty.md`.

### Example query

```python
import pandas as pd
df = pd.read_parquet("data/historical/curtailment_history.parquet")

# Mean peak GW per region over the last 90 days
recent = df[df.build_timestamp >= (pd.Timestamp.utcnow() - pd.Timedelta(days=90)).isoformat()]
recent.groupby("region_id")["peak_gw"].mean().sort_values(ascending=False).head(20)
```

## Parquet hourly backfill

Location: `data/historical/curtailment_backfill.parquet`

A seven-year hourly reconstruction (2020-01-01 → 2026-04-24) for the 29 regions whose upstream source supports multi-year history: 20 ENTSO-E bidding zones (16 main zones plus the four Norway NO domains NO1–NO4 fetched as ENTSO-E NO zones; NO5 is in the live feed but not the backfill — the upstream archive at the bidding-zone level lacks the multi-year depth required for reconstruction) and 9 EIA balancing-authority series (CAISO, MISO, NYISO, ISO-NE, PJM, SPP, BPA, plus the two ERCOT sub-zones `ercot-east` and `ercot-west` reconstructed from the BA-level feed). Produced by `scripts/backfill/<source>/backfill_<zone>.py` (per-zone) and consolidated by `scripts/backfill/merge_to_parquet.py`. Methodology in `docs/methodology/historical-backfill.md`.

Current size: **2,590,195 rows × 7 columns (≈ 20 MB Snappy-compressed)**. Per-year partitioned copies live under `data/historical/backfill/<source>_<zone>_<year>.parquet` for per-year consumption without a full-file read.

### Columns

| Column | Type | Description |
|---|---|---|
| `observation_timestamp` | `string` (ISO-8601 UTC, sortable) | Start of the hour the value covers. |
| `region_id` | `string` | Matches `regionId` in the JSON snapshot and in the rolling history. |
| `curtailment_gw` | `float32` | Curtailed energy averaged over the hour, in GW. |
| `fuel` | `string` | `"wind"`, `"solar"`, `"hydro"`, `"geothermal"`, or `"flare"` — the technology the curtailed energy came from. |
| `source` | `string` | Provenance slug. The current backfill carries `"entsoe"` (20 ENTSO-E zones, including the four Norway NO domains) and `"eia"` (9 U.S. balancing-authority series). Mirrors the loader name in `src/data/`. |
| `rate_applied` | `float32` | Calibration rate used to convert raw generation into curtailment. `0.0` when the source publishes curtailment directly (so no rate-multiplication is needed). |
| `rate_source` | `string` | Human-readable provenance of the rate (e.g. `"ENTSO-E B19 dispatch-down 2026"`). |

Confidence-tier and uncertainty columns are not on the hourly file — the per-tier envelope is calibrated against annual aggregates, so it lives on the annual rollup below. To attach uncertainty to an hourly slice, join `region_id` against `per_region_annual.parquet`.

## Parquet annual rollup

Location: `data/historical/per_region_annual.parquet`

The analysis-ready view of the hourly backfill: one row per (`region_id`, `year`), with annual TWh, peak GW, and the calibrated uncertainty envelope. Produced by `scripts/build_annual_rollup.py`. This is the primary input for Figure 2 (validation scatter) and Figure 5 (top-20 multi-year timeseries) of the Scientific Data descriptor. Figure 4 (tier coverage) reads region tiers directly from `src/lib/regions.ts` and does not depend on this rollup; Figure 1 reads the latest live snapshots.

Current size: **203 rows × 12 columns** (29 regions × 7 years).

### Columns

| Column | Type | Description |
|---|---|---|
| `region_id` | `string` | Matches `regionId` in the JSON snapshot and the hourly archive. |
| `year` | `int16` | Calendar year of the aggregated rows. |
| `source` | `string` | First non-null `source` value within the (region, year) partition (e.g. `"entsoe"`). |
| `n_hourly_rows` | `int32` | Non-null hours observed for this region in this year. A full year is 8,760 (8,784 in a leap year). |
| `annual_twh` | `float32` | Σ `curtailment_gw` × 1h ÷ 1000 across the year. |
| `peak_gw` | `float32` | Max hourly `curtailment_gw` across the year. |
| `confidence_tier` | `string` | `"T1-live-TSO"`, `"T2-annual-calibrated"`, or `"T3-modelled"` per `src/lib/uncertainty.ts::deriveTier`. |
| `tier_fraction` | `float32` | Per-tier envelope half-width (`0.15` / `0.20` / `0.40`). |
| `uncertainty_low_gw` | `float32` | `peak_gw × (1 − tier_fraction)`, clamped to ≥ 0. |
| `uncertainty_high_gw` | `float32` | `peak_gw × (1 + tier_fraction)`. |
| `uncertainty_low_twh` | `float32` | `annual_twh × (1 − tier_fraction)`, clamped to ≥ 0. |
| `uncertainty_high_twh` | `float32` | `annual_twh × (1 + tier_fraction)`. |

Once the historical backfill stabilises across ≥3 years, the T1 envelope should be replaced by 2σ of observed annual peakGW; until then it is the ±15% default. Full methodology in `docs/methodology/uncertainty.md`.

## Schema versioning

Schema changes are SemVer-bumped:
- **Adding nullable fields** — patch bump.
- **Adding required fields or changing types** — minor bump (old readers keep working; new fields ignored).
- **Removing or renaming fields** — major bump.

Schema version is embedded in the dataset via the `CITATION.cff` `version` field and the Zenodo DOI resolves to the exact schema of that tag.
