# Paper figures (Scientific Data / Nature Portfolio)

This directory contains the rendered figures that accompany the
Scientific Data Data Descriptor submission for the Every Last Joule
curtailment dataset. Every figure is regenerable from committed source
data so a reviewer can reproduce it without needing proprietary assets
or network access.

| Figure | File(s) | Built from | Build command |
|---|---|---|---|
| Figure 2 — Backfill vs. published TSO validation scatter | `figure2_validation_scatter.pdf` / `.png` | `data/historical/figure2_validation_scatter.csv` | `.venv/bin/python scripts/validation/figure2_plot.py` |

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
