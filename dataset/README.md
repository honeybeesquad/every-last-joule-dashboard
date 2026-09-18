# Every Last Joule — Curtailment Dataset

**Version:** v1.4.0 · **Licence (data):** CC-BY-4.0 · **Licence (code):** MIT (see repo root) · **DOI (this version):** pending the `v1.4.0` GitHub release · **DOI (always-latest):** [10.5281/zenodo.19835411](https://doi.org/10.5281/zenodo.19835411)

A versioned, reproducible synthesis dataset of hourly renewable-electricity curtailment across **459 regions** in 191 countries and territories (solar, wind, hydro, geothermal). Built to support the Bitcoin-curtailment-matching hypothesis (the "Every Last Joule" thesis) but published as a general-purpose open resource.

Associated-gas flaring was in versions through v1.3.2 ([10.5281/zenodo.20570864](https://doi.org/10.5281/zenodo.20570864)) and was removed on 18 June 2026. It is not in this cut.

## What's in it

- **`data/snapshots/last-good/*.json`** — the current committed snapshot for each region. One JSON per region. Schema in [`SCHEMA.md`](SCHEMA.md).
- **`data/source-verified-floor/<year>.csv`** — conservative annual floor rows that have cleared source verification. As of 2026-09-10, `2025.csv` holds 18 rows / 43.2 TWh — Brazil ONS state/fuel constrained-off (ONS's own frustrated-generation definition) and Chile CEN SEN-wide wind/solar reductions; absence from this file is missing/not-yet-verified, not zero.
- **`data/historical/curtailment_history.parquet`** — a rolling Parquet time-series appended after each successful scheduled data refresh (~every 6 hours). One row per region per build. Use DuckDB or pandas. Schema in [`SCHEMA.md`](SCHEMA.md).
- **`data/historical/curtailment_backfill.parquet`** — seven-year hourly reconstruction (2020-01-01 → 2026-04-24) for 29 regions whose upstream archive supports multi-year history. 2,590,195 rows × 7 columns, Snappy-compressed (~20 MB). Built by `scripts/backfill/`; methodology in `docs/methodology/historical-backfill.md`.
- **`data/historical/per_region_annual.parquet`** — annual rollup derived from the backfill (203 rows = 29 regions × 7 years); feeds Figures 2 and 5.
- **`data/historical/figure2_validation_scatter.csv`** — 23 region-year anchor pairs with published TSO / ISO / IMM / SoM / GGFR / IRENA / Ember annual curtailment totals vs. our backfill reconstruction. Machine-readable evidence table for Figure 2.
- **`data/historical/figure3_daily_global.csv`** — daily global sum 2020-01-01 → 2026-04-24 (2,306 days), stacked by source platform. Feeds Figure 3.
- **`docs/methodology/*.md`** — per-source audit trails. Every calibration rate has a provenance document.
- **`docs/validation/<region>.md`** — one triangulation note per canonical region (plus a directory README and `_template.md`) against published TSO / ISO / IMM / SoM / IRENA / Ember annuals.
- **`docs/figures/figure{1..5}_*.{pdf,png}`** — the five publication-grade figures committed in the repository alongside the regeneration scripts in `scripts/validation/`.
- **`docs/paper/*.md`** — draft Scientific Data Data Descriptor body sections and journal-ready figure captions.
- **`docs/known-limitations.md`** — running ledger of every caveat we surface in the paper.
- **`src/methodology.md`** — public-facing methodology page (same source of truth as the paper Methods section).

## How to use it

### Python

```python
import pandas as pd
df = pd.read_parquet(
    "https://raw.githubusercontent.com/honeybeesquad/"
    "every-last-joule-dashboard/main/data/historical/"
    "curtailment_history.parquet"
)
df.query("region_id == 'caiso'").plot(x="build_timestamp", y="peak_gw")
```

### DuckDB

```sql
SELECT region_id, AVG(total_twh_30d) AS mean_twh
FROM read_parquet('curtailment_history.parquet')
WHERE build_timestamp >= '2026-01-01'
GROUP BY region_id
ORDER BY mean_twh DESC;
```

### Snapshot JSON (single region, latest)

```python
import json, urllib.request
url = "https://raw.githubusercontent.com/honeybeesquad/every-last-joule-dashboard/main/data/snapshots/last-good/caiso-wind.json"
snap = json.load(urllib.request.urlopen(url))
print(snap["peakGW"], snap["sourceStatus"], snap["lastUpdated"])
```

## Citation

If you use this dataset in academic work, please cite:

> Collins, S. (2026). Every Last Joule: an hourly synthesis of renewable-electricity curtailment across 459 regions. Dataset version v1.4.0. Concept DOI: [10.5281/zenodo.19835411](https://doi.org/10.5281/zenodo.19835411). The v1.4.0 version DOI is minted when the GitHub release publishes.

Machine-readable citation metadata in [`CITATION.cff`](CITATION.cff).

## Reproducibility

Every figure on the live dashboard (https://everylastjoule.com) and every row in the Parquet archive is regenerable from:
1. A tagged commit of this repository
2. The relevant upstream public-source API keys (see [`../README.md`](../README.md) for env var list — ENTSO-E, EIA, ERCOT, Elexon; all are free with registration)

No proprietary data. No manual post-processing. The loaders in `src/data/*.json.ts` are deterministic given the upstream responses.

## Versioning

- **Minor version** (v1.x.0) bumped when region set changes, schema evolves, or a material calibration rate is updated.
- **Patch version** (v1.0.x) bumped for documentation-only changes and calibration refinements within published uncertainty bands.
- **Every tag** auto-archives to Zenodo with a versioned DOI. Cite the version you actually used.

See [`CHANGELOG.md`](CHANGELOG.md) for release history.

## Querying version history

`data/historical/version-history.csv` records each region's headline numbers across every dataset release. One row per region per version; sorted by version then region_id.

Example DuckDB query — how did Brazil Bahia wind curtailment change across releases?

```sql
SELECT version, region_id, total_twh, confidence_tier
FROM 'data/historical/version-history.csv'
WHERE region_id = 'brazil-bahia-wind'
ORDER BY version;
```

To compare all regions between two versions:

```sql
SELECT a.region_id,
       a.total_twh AS twh_v132,
       b.total_twh AS twh_v131,
       round(a.total_twh - b.total_twh, 4) AS delta
FROM 'data/historical/version-history.csv' a
JOIN 'data/historical/version-history.csv' b
  ON a.region_id = b.region_id
 AND a.version = '1.3.2'
 AND b.version = '1.3.1'
ORDER BY abs(delta) DESC;
```

Regenerate for a new release: `npm run version-history` (run after version bump, alongside the Zenodo mint).

## Scope and limitations

The short version:
- This is a **synthesis** dataset. Most regions mix live upstream feeds (ENTSO-E, EIA, AEMO NEMWeb, Elexon BMRS, ONS Brazil, and others) with published annual calibration (IRENA, Ember, TSO annual reports).
- **v1.4.0** (`npm run tally:tiers`): **T1a 160, T1b 26, T1c 1, T2 23, T3 249 — total 459**, matching `scripts/ci/golden/tier-counts.json`. No flare bucket. T2 is seven annual-anchored flats plus sixteen EIA-930 second-tier US balancing authorities (live shape, external rate).
- **In the archived v1.3.2 deposit**, <!-- tier-counts:ignore --> the 385 regions break down by confidence tier as **158 T1-live-TSO** (148 T1a own-jurisdiction, 9 T1b domestic-anchored, 1 T1c neighbour-anchored), **6 T2-annual-calibrated** (flat-base statics on a published annual), and **213 T3-modelled**. Those three figures sum to 377, not 385: the remainder is the T2-flare bucket, which that sentence never named. `STATUS.md` records the adjacent 2026-06-10 golden as `T1a=149, T1b=10, T1c=1, T2=6, T2-flare=8, T3=211 (total 385)`.
- Every region carries `confidenceTier` so consumers can filter by precision; see [`../docs/methodology/uncertainty.md`](../docs/methodology/uncertainty.md), [`../docs/methodology/tier-classification-guide.md`](../docs/methodology/tier-classification-guide.md) and [`../docs/known-limitations.md`](../docs/known-limitations.md).
- Some jurisdictions (Mexico CENACE, much of sub-Saharan Africa) have no public hourly source and are documented as **structural gaps** rather than filled with fiction.

Full caveat list: [`../docs/known-limitations.md`](../docs/known-limitations.md).

## Questions

Open an issue: https://github.com/honeybeesquad/every-last-joule-dashboard/issues

Email: simon@collins.nu
