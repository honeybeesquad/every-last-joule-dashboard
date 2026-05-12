# Every Last Joule — Curtailment & Flare Dataset

**Version:** v1.3.1 · **Licence (data):** CC-BY-4.0 · **Licence (code):** MIT (see repo root) · **DOI (this version):** [10.5281/zenodo.20136284](https://doi.org/10.5281/zenodo.20136284) · **DOI (always-latest):** [10.5281/zenodo.19835411](https://doi.org/10.5281/zenodo.19835411)

A versioned, reproducible synthesis dataset of hourly renewable-electricity curtailment and associated-gas flaring, covering 384 regions across 6 continents. Built to support the Bitcoin-curtailment-matching hypothesis (the "Every Last Joule" thesis) but published as a general-purpose open resource.

## What's in it

- **`data/snapshots/last-good/*.json`** — the current committed snapshot for each region. One JSON per region. Schema in [`SCHEMA.md`](SCHEMA.md).
- **`data/historical/curtailment_history.parquet`** — a rolling Parquet time-series appended after each successful scheduled data refresh (~every 6 hours). One row per region per build. Use DuckDB or pandas. Schema in [`SCHEMA.md`](SCHEMA.md).
- **`data/historical/curtailment_backfill.parquet`** — seven-year hourly reconstruction (2020-01-01 → 2026-04-24) for 29 regions whose upstream archive supports multi-year history. 2,590,195 rows × 7 columns, Snappy-compressed (~20 MB). Built by `scripts/backfill/`; methodology in `docs/methodology/historical-backfill.md`.
- **`data/historical/per_region_annual.parquet`** — annual rollup derived from the backfill (203 rows = 29 regions × 7 years); feeds Figures 2 and 5.
- **`data/historical/figure2_validation_scatter.csv`** — 23 region-year anchor pairs with published TSO / ISO / IMM / SoM / GGFR / IRENA / Ember annual curtailment totals vs. our backfill reconstruction. Machine-readable evidence table for Figure 2.
- **`data/historical/figure3_daily_global.csv`** — daily global sum 2020-01-01 → 2026-04-24 (2,306 days), stacked by source platform. Feeds Figure 3.
- **`docs/methodology/*.md`** — per-source audit trails. Every calibration rate has a provenance document.
- **`docs/validation/<region>.md`** — 130 per-region triangulation documents (plus a directory README and a `_template.md` scaffold) against published TSO / ISO / IMM / SoM / GGFR / IRENA / Ember annual reports, with commit-grade diagnostic prose per region.
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
    "every-last-joule-dashboard/v0-build/data/historical/"
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
url = "https://raw.githubusercontent.com/honeybeesquad/every-last-joule-dashboard/v0-build/data/snapshots/last-good/caiso.json"
snap = json.load(urllib.request.urlopen(url))
print(snap["peakGW"], snap["sourceStatus"], snap["lastUpdated"])
```

## Citation

If you use this dataset in academic work, please cite:

> Collins, S. (2026). Every Last Joule: an hourly synthesis of renewable-electricity curtailment and associated-gas flaring across 384 regions. _Scientific Data_ (in review). Dataset DOI: [10.5281/zenodo.19835411](https://doi.org/10.5281/zenodo.19835411).

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

## Scope and limitations

The short version:
- This is a **synthesis** dataset. Most regions mix live upstream feeds (ENTSO-E, EIA, AEMO NEMWeb, Elexon BMRS, ONS Brazil, and others) with published annual calibration (IRENA, Ember, GGFR, TSO annual reports).
- The 384 regions break down by confidence tier as **159 T1-live-TSO** (149 T1a own-jurisdiction, 9 T1b domestic-anchored, 1 T1c neighbour-anchored), **6 T2-annual-calibrated** (flat-base statics on a published annual), **8 T2-flare** (24/7 baseload, methodologically correct for flare — Permian, West Siberia, South Iraq, East Saudi Arabia, Qatar, Kuwait, Russia Yamal-Nenets, Russia East Siberia), and **211 T3-modelled** (typical diurnal/seasonal/mixed/overnight shape scaled to a published annual anchor — Ireland (Republic and Northern), Peru, South Africa, Chinese provinces, most of South Asia, Africa, Middle East outside flare, Latin America outside Brazil/Atacama, Hawaii). Every region carries `confidenceTier` so consumers can filter by precision; see [`../docs/methodology/uncertainty.md`](../docs/methodology/uncertainty.md) and [`../docs/known-limitations.md`](../docs/known-limitations.md).
- Flare regions (Permian, West Siberia, South Iraq, East Saudi Arabia, Qatar, Kuwait, Russia Yamal-Nenets, Russia East Siberia) are correctly modelled as flat 24/7 base-load — flare _is_ continuous, not diurnal.
- Some jurisdictions (Mexico CENACE, much of sub-Saharan Africa) have no public hourly source and are documented as **structural gaps** rather than filled with fiction.

Full caveat list: [`../docs/known-limitations.md`](../docs/known-limitations.md).

## Questions

Open an issue: https://github.com/honeybeesquad/every-last-joule-dashboard/issues

Email: simon@collins.nu
