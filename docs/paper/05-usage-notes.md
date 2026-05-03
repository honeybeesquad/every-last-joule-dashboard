# Usage Notes

_Scientific Data Data Descriptor · Section 5 · Target length 500–1000
words._

## 5.1 Loading the dataset

### Python (pandas + pyarrow)

```python
import pandas as pd

# Seven-year backfill — 2.59M hourly rows, 29 T1 regions
url = ("https://raw.githubusercontent.com/honeybeesquad/"
       "every-last-joule-dashboard/v1.1.1/"
       "data/historical/curtailment_backfill.parquet")
df = pd.read_parquet(url)

# Germany 2024 monthly totals
germany_2024 = (df.query("region_id == 'germany' and "
                         "observation_timestamp >= '2024-01-01' and "
                         "observation_timestamp < '2025-01-01'")
                  .assign(month=lambda d: d.observation_timestamp.str[:7])
                  .groupby("month")["curtailment_gw"].sum() / 1000.0)
```

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
       "every-last-joule-dashboard/v1.1.1/"
       "data/snapshots/last-good/caiso.json")
snap = json.load(urllib.request.urlopen(url))
print(f"CAISO peak GW: {snap['peakGW']:.2f}  "
      f"(tier {snap['confidenceTier']}, "
      f"±{(snap['uncertaintyHighGW'] - snap['peakGW']):.2f} GW)")
```

## 5.2 Understanding the confidence tier

Before using a region's values, check its `confidenceTier`:

| Tier | Envelope | Treatment guidance |
|---|---|---|
| `T1a-live-tso` | ±15% (or 2σ where backfill ≥ 3 yrs) | Live hourly feed + own-jurisdiction calibration rate (TSO/regulator). Defensible for most analyses; see per-region validation MD for any scope mismatch. |
| `T1b-live-domestic-anchored` | ±50% (empirical) | Live feed + domestic-stat-agency or modelled-share rate. Italy-Sardinia, Italy-North-Zone, Netherlands, Baltics. Use with anchor-aware caveats. |
| `T1c-live-neighbour-anchored` | ±35.5% (empirical) | Live feed + rate extrapolated from neighbouring zone. Switzerland (Czech CEPS rate). |
| `T2-annual-calibrated` | ±20% | Annual total is anchored; hourly shape is reconstructed from live generation × rate. Defensible for annual totals, use with caution at hour level. |
| `T2 flare` | ±20%, flat 24/7 | Flare is continuous; the flat profile is methodologically correct, not a data gap. |
| `T3-modelled` | ±40% | Static annual + typical shape. Treat as order-of-magnitude estimate; do not use hour-level reconstructions for modelling. |

Full tier methodology: `docs/methodology/uncertainty.md`.

## 5.3 Documented coverage gaps

The dataset does not publish hourly values for jurisdictions with
no public hourly upstream source. Explicit gaps:

- **Mexico (CENACE).** CENACE redirects to error pages from
  outside-MX IPs; no unauthenticated hourly curtailment feed.
  Absent from the dataset, not modelled.
- **Most of the Middle East outside flare basins** (UAE,
  non-flare Saudi, Egypt, Oman). No public hourly feed; small
  fallback estimates appear as T3-modelled (typical solar shape
  scaled to a published annual) — see `docs/known-limitations.md`.
- **Sub-Saharan Africa outside ESKOM**. Eskom (South Africa)
  is T1a-live-tso via the data portal; other sub-Saharan grids
  have patchy published generation and no curtailment accounting.
- **Central Asia and Russia outside W. Siberia flare.** Russian
  European grid carries a 1 TWh/yr T3-modelled hydro-seasonal
  fallback; Murmansk wind is a T2-annual-calibrated flat estimate;
  Central Asia is absent beyond Kazakhstan (T3 wind).
- **Chinese provincial-level hourly.** All 27 Chinese provinces
  surface as T3-modelled — typical diurnal/seasonal shapes (solar
  cosine, wind broad-overnight, monthly-seasonal hydro, or
  mixed fuel-share per province) scaled to NEA 2024 provincial
  utilisation rates and published annual generation. No public
  hourly API exists for any Chinese province; see
  `docs/methodology/china-provinces.md`.

Full documented-gap ledger: `docs/known-limitations.md`.

## 5.4 Known blind spots in the phenomenon being measured

Even within regions where upstream feeds exist, curtailment
reporting systematically under-captures certain behaviours:

- **Self-curtailment is invisible.** Asset owners throttling
  output in response to negative prices do not appear in
  system-operator dispatch-down statistics. Book research
  places the true total at 50–70% of the invisible figure in
  ERCOT and some European markets. The published numbers are a
  **lower bound on visible waste**, not an upper bound on
  available waste.
- **Intra-hour economic curtailment.** Sub-hour market clearing
  behaviours (5-min dispatch intervals in ERCOT, 15-min in
  ENTSO-E) may show curtailment that averages out at hourly
  resolution. The dataset operates at hourly resolution
  deliberately (cross-comparability across sources); sub-hourly
  users should consult the native upstream feeds.
- **Definitional heterogeneity across sources.** "Curtailment"
  is not a single harmonised quantity across TSOs. Per-region
  validation MDs document what each source publishes and how
  our reconstruction aligns.

## 5.5 Recommended citation

Machine-readable citation metadata: `dataset/CITATION.cff`.
Zenodo-minted version DOI for v1.1.1: `10.5281/zenodo.19991315`.
Concept DOI (resolves to latest version): `10.5281/zenodo.19835411`.

Preferred human citation:

> Collins, S. (2026). Every Last Joule: an hourly synthesis of
> renewable-electricity curtailment and associated-gas flaring
> across 233 regions. Scientific Data.
> https://doi.org/10.5281/zenodo.19991315

Cite the **version DOI** (not the concept DOI) when writing
reproducible analyses; concept DOI is appropriate when citing
"the dataset as a whole" across versions.

## 5.6 Licensing

- **Data** — Creative Commons Attribution 4.0 International
  (CC-BY-4.0). See `dataset/LICENSE`. Attribution required;
  commercial and derivative use permitted.
- **Code** — MIT. See repository root `LICENSE`.

## 5.7 Versioning

Semantic versioning. Minor bumps (`v1.x.0`) for new regions,
schema changes, or material calibration rate updates. Patch
bumps (`v1.0.x`) for documentation and calibration refinements
within published uncertainty envelopes. Every tag is archived to
Zenodo with a versioned DOI. Cite the version you actually used.

Release history: `dataset/CHANGELOG.md`.

## 5.8 Re-use suggestions

Examples of analyses this dataset supports:

- **Power-systems modelling.** Hourly curtailment profiles per
  region, suitable as input to capacity-expansion or
  unit-commitment models (PyPSA, plexos, GenX).
- **Interruptible-load siting.** Peak-GW × duration-hour
  surfaces for candidate demand-response or flexible-load
  deployments.
- **Renewable-integration policy.** Multi-year trend analysis
  (Figure 3 shows this is visible in the data) for evaluating
  transmission-investment timelines vs. curtailment growth.
- **Bitcoin-curtailment matching.** The dataset was built to
  support this hypothesis-test; the companion paper uses it
  directly.
- **Cross-jurisdiction curtailment accounting.** The per-region
  validation MDs and `docs/methodology/validation-discrepancies.md`
  make the definitional differences between TSOs explicit,
  enabling apples-to-apples comparison.

## 5.9 How to report issues

- **GitHub Issues:**
  https://github.com/honeybeesquad/every-last-joule-dashboard/issues
- **Email:** simon@collins.nu
- **Data-source corrections:** open an issue with the region,
  the anchor you want to compare against, and the URL. The
  `docs/validation/<region>.md` workflow will incorporate valid
  corrections in the next minor release.

## Cross-references

- `dataset/README.md` — complete dataset card with short
  tutorial.
- `dataset/SCHEMA.md` — full field schema.
- `dataset/FAIR.md` — FAIR self-assessment (§7: re-use
  guidance).
- `docs/known-limitations.md` — complete documented-gap and
  blind-spot ledger.
