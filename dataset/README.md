# Every Last Joule — Curtailment & Flare Dataset

**Version:** v1.0.0 (tag pending) · **Licence (data):** CC-BY-4.0 · **Licence (code):** MIT (see repo root) · **DOI:** _TBA (minted on v1.0.0 tag via Zenodo)_

A versioned, reproducible synthesis dataset of hourly renewable-electricity curtailment and associated-gas flaring, covering 128 regions across 6 continents. Built to support the Bitcoin-curtailment-matching hypothesis (the "Every Last Joule" thesis) but published as a general-purpose open resource.

## What's in it

- **`data/snapshots/last-good/*.json`** — the current committed snapshot for each region. One JSON per region. Schema in [`SCHEMA.md`](SCHEMA.md).
- **`data/historical/curtailment_history.parquet`** — a rolling Parquet time-series appended after each successful scheduled data refresh (~every 6 hours). One row per region per build. Use DuckDB or pandas. Schema in [`SCHEMA.md`](SCHEMA.md).
- **`docs/methodology/*.md`** — per-source audit trails. Every calibration rate has a provenance document.
- **`docs/validation/<region>.md`** — per-region triangulation against IRENA / Ember / TSO annual reports. _(Populated in S1 — see `docs/academic-model/2026-04-24-submission-plan.md`.)_
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

> Collins, S. (2026). Every Last Joule: an hourly synthesis of renewable-electricity curtailment and associated-gas flaring across 128 regions. _Scientific Data_ (in review). Dataset DOI: _TBA_.

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
- 3 regions use estimated daily shapes scaled to published annual totals: Sichuan, Xinjiang, Iceland. These are clearly labelled; see [`../docs/known-limitations.md`](../docs/known-limitations.md).
- Flare regions (Permian, West Siberia, South Iraq, East Saudi Arabia, others) are correctly modelled as flat 24/7 base-load — flare _is_ continuous, not diurnal.
- Some jurisdictions (Mexico CENACE, most of the Middle East outside flare, much of sub-Saharan Africa) have no public hourly source and are documented as **structural gaps** rather than filled with fiction.

Full caveat list: [`../docs/known-limitations.md`](../docs/known-limitations.md).

## Questions

Open an issue: https://github.com/honeybeesquad/every-last-joule-dashboard/issues

Email: simon@collins.nu
