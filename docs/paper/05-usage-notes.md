# Usage Notes

_Scientific Data Data Descriptor · Section 5 · Target length 500–1000
words._

## 5.1 Loading the dataset

This descriptor is **v1.4.0**: 459 regions, renewables only. Version
DOI `10.5281/zenodo.22837934`. Concept DOI `10.5281/zenodo.19835411`.
v1.3.2 (`10.5281/zenodo.20570864`) is the last cut that included
flare.

### Python (pandas + pyarrow)

```python
import pandas as pd

# Seven-year backfill — 2.59M hourly rows, 29 T1 archives
url = ("https://raw.githubusercontent.com/honeybeesquad/"
       "every-last-joule-dashboard/main/"
       "data/historical/curtailment_backfill.parquet")
df = pd.read_parquet(url)

germany_2024 = (df.query("region_id == 'germany' and "
                         "observation_timestamp >= '2024-01-01' and "
                         "observation_timestamp < '2025-01-01'")
                  .assign(month=lambda d: d.observation_timestamp.str[:7])
                  .groupby("month")["curtailment_gw"].sum() / 1000.0)
```

The `germany` backfill id is the older national rate-model series.
Live Germany is eight TSO × fuel regions from netztransparenz.

### Python (DuckDB, no load into memory)

```python
import duckdb
con = duckdb.connect()
result = con.execute("""
    SELECT region_id, year(observation_timestamp) AS year,
           SUM(curtailment_gw) / 1000.0 AS annual_twh
    FROM read_parquet('curtailment_backfill.parquet')
    WHERE year(observation_timestamp) = 2024
    GROUP BY region_id, year
    ORDER BY annual_twh DESC
""").df()
```

### Single-region snapshot (Python stdlib only)

```python
import json, urllib.request
url = ("https://raw.githubusercontent.com/honeybeesquad/"
       "every-last-joule-dashboard/main/"
       "data/snapshots/last-good/caiso.json")
snap = json.load(urllib.request.urlopen(url))
print(f"CAISO peak GW: {snap['peakGW']:.2f}  "
      f"(tier {snap['confidenceTier']}, "
      f"±{(snap['uncertaintyHighGW'] - snap['peakGW']):.2f} GW)")
```

Some snapshot files are dicts of regions. Do not sum payload ids in
`KNOWN_AGGREGATE_IDS` (`north-sea-wind`, `turkey`, …) with their
children.

## 5.2 Understanding the confidence tier

Check `confidenceTier` before using a region's hours:

| Tier | Envelope | Treatment |
|---|---|---|
| `T1a-live-tso` | ±15% (or 2σ where backfill ≥ 3 yrs) | Live feed + own-jurisdiction rate. Defensible for most analyses; read the per-region MD for scope mismatches. |
| `T1b-live-domestic-anchored` | ±50% (empirical) | Live feed + domestic or split rate. Germany’s eight TSO-fuel regions, Italy’s fourteen, Netherlands, Peru solar, Colombia. |
| `T1c-live-neighbour-anchored` | ±35.5% (empirical) | Switzerland (Czech CEPS rate). |
| `T2-annual-calibrated` | ±20% | Seven flat annuals plus sixteen EIA-930 BAs (live shape, external rate). Annuals are stronger than hours. |
| `T3-modelled` | ±40% | Typical shape on a published annual. Order-of-magnitude. Do not treat hour-level values as measured events. |

There is no `T2-flare`. Full math: `docs/methodology/uncertainty.md`.
Live counts: `npm run tally:tiers`.

## 5.3 Documented coverage gaps

No hourly series is invented for a jurisdiction with no public hourly
source.

- **Mexico (CENACE).** No unauthenticated hourly curtailment feed from
  outside MX. Absent, not modelled.
- **Most of the Middle East.** No public hourly feed; small T3
  estimates on published annuals. See `docs/known-limitations.md`.
- **Sub-Saharan Africa outside Eskom.** South Africa wind/solar are
  T1a via the Eskom portal. Other grids have patchy generation and
  little curtailment accounting.
- **Central Asia and most of Russia.** European Russia hydro is T3;
  Murmansk wind is T2; Kazakhstan wind is T3. The rest is absent.
- **Chinese provincial hours.** 27 provinces are T3, scaled to NEA
  utilisation and published annuals. No public provincial hourly API.
  See `docs/methodology/china-provinces.md`.

India SLDCs are not T1a. Maharashtra is T2 (MSLDC monthly).
Rajasthan, Gujarat, Tamil Nadu, Karnataka, and Andhra Pradesh are T3.
Rajasthan’s modelled ~6 TWh/yr sits far above RRVPNL’s 2026 PDF floor.

Full ledger: `docs/known-limitations.md`.

## 5.4 Known blind spots

- **Self-curtailment is invisible.** Owner throttling at negative
  prices does not appear in dispatch-down statistics. Published
  numbers are a **lower bound on visible waste**.
- **Intra-hour economic curtailment.** ERCOT 5-min and ENTSO-E 15-min
  intervals can show shed that averages out at the hour. Sub-hourly
  users should read the native feeds.
- **Definitional heterogeneity.** “Curtailment” is not one quantity
  across TSOs. The per-region MDs say what each source publishes.

## 5.5 Recommended citation

Machine-readable: `dataset/CITATION.cff` (**v1.4.0**).
Version DOI: `10.5281/zenodo.22837934`. Concept DOI:
`10.5281/zenodo.19835411`.

Cite the **version you used**. This descriptor is v1.4.0 (459
regions, renewables only). Do not cite it as Scientific Data in review.

> Collins, S. (2026). Every Last Joule: an hourly synthesis of
> renewable-electricity curtailment across 459 regions. Dataset
> version v1.4.0. https://doi.org/10.5281/zenodo.22837934

For the archived v1.3.2 cut (385 regions, includes flare):

> Collins, S. (2026). Every Last Joule: an hourly synthesis of
> renewable-electricity curtailment and associated-gas flaring
> across 385 regions. Dataset version v1.3.2.
> https://doi.org/10.5281/zenodo.20570864

## 5.6 Licensing

- **Data** — CC-BY-4.0. `dataset/LICENSE`.
- **Code** — MIT. Repository root `LICENSE`.

## 5.7 Versioning

Minor bumps for new regions, schema changes, or material rate updates.
Patch bumps for documentation and envelope-internal refinements.
Cite the tag you used. History: `dataset/CHANGELOG.md`.

## 5.8 Re-use

- Hourly profiles for capacity-expansion or unit-commitment models,
  filtered by `confidenceTier`.
- Peak-GW × duration surfaces for interruptible load.
- Multi-year trend work on the 29-region backfill (Figure 3).
- Cross-jurisdiction accounting using the validation MDs.

## 5.9 How to report issues

- GitHub: https://github.com/honeybeesquad/every-last-joule-dashboard/issues
- Email: simon@collins.nu
- Source corrections: region, the anchor, and the URL. Valid
  corrections land in `docs/validation/<region>.md` on the next minor.

## Cross-references

- `dataset/README.md`, `dataset/SCHEMA.md`, `dataset/FAIR.md`
- `docs/known-limitations.md`
