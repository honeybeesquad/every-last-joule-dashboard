# Paper figures (Scientific Data / Nature Portfolio)

This directory contains the rendered figures that accompany the
Scientific Data Data Descriptor submission for the Every Last Joule
curtailment dataset. Every figure is regenerable from committed source
data so a reviewer can reproduce it without needing proprietary assets
or network access.

| Figure | File(s) | Built from | Build command |
|---|---|---|---|
| Figure 1 — Global curtailment snapshot (dots sized by peak GW) | `figure1_global_map.pdf` / `.png` | `src/lib/regions.ts` + `data/snapshots/last-good/*.json` | `.venv/bin/python scripts/validation/figure1_global_map.py` |
| Figure 2 — Backfill vs. published TSO validation scatter | `figure2_validation_scatter.pdf` / `.png` | `data/historical/figure2_validation_scatter.csv` | `.venv/bin/python scripts/validation/figure2_plot.py` |
| Figure 3 — Daily global curtailment temporal trace (2020–2026) | `figure3_temporal_trace.pdf` / `.png` | `data/historical/curtailment_backfill.parquet` → `data/historical/figure3_daily_global.csv` | `.venv/bin/python scripts/validation/figure3_temporal_trace.py` |
| Figure 4 — Per-region confidence tier coverage map | `figure4_coverage_map.pdf` / `.png` | `src/lib/regions.ts` | `.venv/bin/python scripts/validation/figure4_coverage_map.py` |
| Figure 5 — Top-20 region annual curtailment timeseries (2020–2026) | `figure5_top20_timeseries.pdf` / `.png` | `data/historical/per_region_annual.parquet` | `.venv/bin/python scripts/validation/figure5_top20_timeseries.py` |

## Regeneration pipeline

Figure 2 depends on two committed artefacts:

1. **`data/historical/per_region_annual.parquet`** — the per-region,
   per-year rollup produced by `scripts/build_annual_rollup.py` after
   the HB backfill fan-out has landed all partitions.
2. **`scripts/validation/external-anchors.json`** — the hand-curated
   set of published TSO / ISO / Potomac Economics State-of-the-Market
   annual curtailment numbers, with year-keyed `tso_annual_twh`
   entries for every region-year that appears in Figure 2.

The CSV that feeds the plot is emitted by
`scripts/validation/figure2_data.py`, which joins those two artefacts.
The plot script `scripts/validation/figure2_plot.py` reads the CSV
and writes both a PDF (for the manuscript) and a PNG (for web /
preview). The build chain is deterministic — same inputs produce the
same figure byte-for-byte on matplotlib ≥ 3.10.

## Python dependency note

The plot script depends on `matplotlib` and `numpy`, which are not
runtime dependencies of the Observable Framework dashboard. They are
pinned in a local `.venv` created specifically for paper artefact
regeneration:

```
python3 -m venv .venv
.venv/bin/pip install matplotlib pyarrow
```

This isolation is intentional — the dashboard build (`npm run build`)
must not pull scientific-Python packages into the deployment
environment.

## Figure 2 methodology

See the companion narrative in:

- `docs/methodology/uncertainty.md` — the tier model that defines the
  ±15% T1-live-TSO envelope shaded on Figure 2.
- `docs/methodology/historical-backfill.md` — how the Y-axis values
  are reconstructed (generation × calibrated rate, applied uniformly
  across the 2020–2026 backfill window).
- `docs/validation/<region>.md` — per-region Discrepancy analysis for
  every point on the scatter; material (>50% |Δ%|) offsets are named
  and diagnosed individually.
- `docs/methodology/validation-discrepancies.md` — dataset-level
  survey of all 23 Figure 2 pairs, grouped by gap magnitude with the
  diagnostic category for each material discrepancy and the v1
  recalibration candidates that are deferred from this submission.

## Figure 3 methodology

The daily trace collapses the 2.59 M-row hourly archive
(`curtailment_backfill.parquet`) to a ~2,306-row daily series keyed by
`(date, source)`. Each row in the archive represents a single
(region, fuel, hour) curtailment observation; one hour of a value in
GW equals one GWh of energy, so the daily total is a direct sum of
`curtailment_gw` values under each date bucket. The intermediate CSV
`data/historical/figure3_daily_global.csv` is committed alongside the
figure so a reviewer can reproduce the plot without re-merging the
full archive.

The annotations on the trace (COVID demand drop, Germany Redispatch
2.0 regime change in October 2021, the 2023 solar-acceleration band)
are chosen because each corresponds to a methodological or policy
event that the paper's narrative references explicitly. The 30-day
rolling mean overlay smooths out weekly / weather-driven noise so the
underlying growth trend is visible under the chatter.

## Figure 4 methodology

Figure 4 visualises the tier assignment for every region in the manifest
(`src/lib/regions.ts`). A regex parser extracts `(id, name, country,
lat, lon, tier)` rows and `derive_tier()` — whose logic mirrors
`scripts/build_annual_rollup.py::derive_tier` exactly — maps each region
to one of four confidence tiers:

- **T1-live-TSO (±15%, teal)** — regions with live ENTSO-E / EIA / TSO
  hourly feeds plus the 2020–2026 historical backfill reconstruction.
- **T2-annual-calibrated (±20%, amber)** — static regions with a
  published annual anchor but no hourly feed.
- **T2 flare (±20%, brown square marker)** — oil/gas associated-gas
  flaring regions whose correct hourly shape is 24/7 baseload.
- **T3-modelled (±40%, terracotta)** — the handful of regions that
  rely on a typical-daily-profile model because no public hourly
  source exists (`sichuan`, `xinjiang`, `iceland`, `ukraine`, and the
  three Hawaii islands).

The basemap is hand-rolled (graticule + ocean tint + earth frame) to
avoid a cartopy / natural-earth dependency; a reviewer can regenerate
the figure on a clean Python install with only `matplotlib` and
`numpy` in scope. Plot order is T3 → T2 → flare → T1 so the T1 dots
(the paper's headline live-feed claim) render on top and are never
occluded by ambers beneath them.

## Figure 1 methodology

Figure 1 is the paper's geographic opening shot — what does current
global curtailment look like _right now_, and where are the biggest
hotspots? Every region in `src/lib/regions.ts` appears as a dot on
an equirectangular world map (same basemap code as Figure 4) with:

- **Colour** from the confidence tier (`derive_tier()` matches
  Figure 4 and `scripts/build_annual_rollup.py` exactly).
- **Size** from the latest `peakGW` in
  `data/snapshots/last-good/<region>.json`. For single-region
  snapshots the file is a flat object with `regionId` + `peakGW`;
  for multi-region loaders (AEMO, Norway zones, Brazil clusters,
  ERCOT split, etc.) the file is a dict keyed by region id and every
  entry contributes a dot. Marker area scales with √peakGW so a 10
  GW pillar doesn't visually annihilate a 0.1 GW one; a three-dot
  reference legend inside the figure shows the size-to-GW mapping.

Regions in the manifest that have no snapshot (a handful of
high-coverage regions where the loader hasn't successfully landed a
live fetch yet) plot at the minimum size so the map still shows full
geographic coverage without pretending to have data we don't.

The top 8 regions by current peak GW are labelled on the figure;
everything below that is dot-only to keep the map readable.

## Figure 5 methodology

Figure 5 is a 4×5 facet grid of the top 20 regions by mean annual
curtailment across the backfill window (2020–2026). The ranking is
computed from `data/historical/per_region_annual.parquet` — the same
artefact that feeds Figure 2 and the per-region validation MDs. Each
panel is a single region's annual TWh trace with the 2024 headline
number annotated inline; panels share the X axis (year) but each
autoscales its Y axis so small regions (nyiso, iso-ne, norway-no1)
are readable alongside continental-scale ones (germany, iberia,
miso).

The figure's narrative payoff is the paper's "curtailment is
concentrated" thesis: the top-3 regions (Germany, Iberia, MISO)
alone account for ~51% of the combined top-20 annual total across
the 2020–2026 window. The 2026 dip visible in every panel is the
partial-year artefact — the backfill window ends at the date the
archive was merged, so 2026 carries only partial-year totals.

Tier colouring is applied per panel; in v0.5 all 20 top regions are
T1-live-TSO, so all lines render in teal. The dispatch infrastructure
for T2/T3 colouring is in place so any v1 rate-recalibration that
promotes new regions into the top 20 (see
`docs/methodology/validation-discrepancies.md`) renders correctly
without script changes.
