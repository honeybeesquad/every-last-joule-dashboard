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
| `sourceNote` | `string` | Human-readable provenance. E.g. `"ENTSO-E Transparency B19 dispatch-down 2026-01 → 2026-04 · rate 0.04"`. | No |
| `sourceStatus` | `"live" \| "cached" \| null` | `live` = fresh fetch succeeded; `cached` = `withFallback` served last-good. Null only for purely static regions. | Yes |
| `fuelShare` | `Record<string, number>` | Fuel-type split of the curtailed energy, fractions 0–1, keys in `{solar, wind, hydro, geothermal, flare}`. May be empty for flare-only regions. | No (may be `{}`) |

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
  "fuelShare": {"solar": 0.88, "wind": 0.12}
}
```

### JSON Schema

Machine-readable version: [`schema/region-snapshot.schema.json`](schema/region-snapshot.schema.json) (emitted by S0 scaffolding, to be expanded during S2 when uncertainty fields land).

## Parquet historical archive

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
| `source_status` | `string` | `"live"`, `"cached"`, or null. |
| `last_updated` | `string` | Calibration-anchor date. |
| `profile_h00` … `profile_h23` | `float32` × 24 | Average curtailment in GW per UTC hour, matching JSON `profile`. |

### Uncertainty columns (added S2)

To be added during S2 (Wks 7–10 of the submission plan). Placeholder column names below; finalised when methodology per tier lands.

| Column | Type | Description |
|---|---|---|
| `uncertainty_low_gw` | `float32` | Lower bound of the 95% interval on `peak_gw`. |
| `uncertainty_high_gw` | `float32` | Upper bound of the 95% interval on `peak_gw`. |
| `confidence_tier` | `string` | `"T1-live-TSO"`, `"T2-annual-calibrated"`, `"T3-modelled"`, `"T4-structural-gap"`. |

The confidence tier is derived deterministically from the loader type; the uncertainty band is derived from a per-tier uncertainty model documented in `docs/methodology/uncertainty.md` (to be written in S2).

### Example query

```python
import pandas as pd
df = pd.read_parquet("data/historical/curtailment_history.parquet")

# Mean peak GW per region over the last 90 days
recent = df[df.build_timestamp >= (pd.Timestamp.utcnow() - pd.Timedelta(days=90)).isoformat()]
recent.groupby("region_id")["peak_gw"].mean().sort_values(ascending=False).head(20)
```

## Historical backfill (planned)

A separate Parquet file `data/historical/curtailment_backfill.parquet` will be produced during the Historical Backfill sprint (see `docs/academic-model/2026-04-25-gap-closure-plan.md`), containing hourly curtailment values reconstructed from upstream archives for every region whose source supports multi-year history (ENTSO-E, EIA, AEMO NEMWeb, Elexon, ONS Brazil, Nord Pool). Schema will mirror the rolling history but with `build_timestamp` replaced by `observation_timestamp` (hourly UTC) and `peak_gw` / `total_twh_30d` fields replaced by `curtailment_gw` (the actual measured hourly value).

## Schema versioning

Schema changes are SemVer-bumped:
- **Adding nullable fields** — patch bump.
- **Adding required fields or changing types** — minor bump (old readers keep working; new fields ignored).
- **Removing or renaming fields** — major bump.

Schema version is embedded in the dataset via the `CITATION.cff` `version` field and the Zenodo DOI resolves to the exact schema of that tag.
