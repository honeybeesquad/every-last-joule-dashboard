#!/usr/bin/env python3
"""
Render Figure 3 of the Scientific Data paper — the daily-resolution
global curtailment temporal trace, 2020-2026 — from the merged
backfill archive.

Pipeline:
  data/historical/curtailment_backfill.parquet  (merged HB artefact)
  → data/historical/figure3_daily_global.csv    (committed daily series)
  → docs/figures/figure3_temporal_trace.pdf / .png

What the figure shows
---------------------
- X axis: date, 2020-01-01 to 2026-present.
- Y axis: global backfill curtailment, GWh per day (primary) with a
  secondary right axis scaled to the rolling 30-day mean in TWh/month
  for readability.
- Stacked area (alternative: coloured line) by fuel class (wind vs.
  solar vs. other) to make the post-2022 solar-block-following
  thesis visually obvious.
- Annotations: COVID-era curtailment dip (spring 2020), Germany
  Redispatch 2.0 regime change (Oct 2021), and the 2023 solar
  acceleration band highlighted.

Design decisions
----------------
- Daily bucketing: converts the 2.59M-row hourly archive into ~2,500
  rows, which is small and cheap to plot. The committed CSV is the
  reproducibility artefact — reviewers can confirm it matches the
  parquet using pyarrow's `group_by` without re-running the plot.
- Stacked area uses the `source` field to split into `entsoe` vs
  `eia` which is a reasonable proxy for Europe-vs-North-America in
  our dataset and keeps the colour palette interpretable.
- Rolling 30-day mean smooths the daily trace so the underlying
  trend (growth of global curtailment) is visible under the
  weekly/weather-driven chatter.

Run
---
  .venv/bin/python scripts/validation/figure3_temporal_trace.py
  .venv/bin/python scripts/validation/figure3_temporal_trace.py \\
       --out-dir custom/dir/
"""

from __future__ import annotations

import argparse
import csv
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import numpy as np
import pyarrow.parquet as pq

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
ARCHIVE = REPO_ROOT / "data" / "historical" / "curtailment_backfill.parquet"
DEFAULT_CSV = REPO_ROOT / "data" / "historical" / "figure3_daily_global.csv"
DEFAULT_OUT_DIR = REPO_ROOT / "docs" / "figures"


def build_daily_series(archive: Path) -> dict[str, dict[str, float]]:
    """Read the archive and collapse to a dict keyed by
    (date_iso, source) → GWh/day. Uses PyArrow columns directly to
    avoid pulling the whole 2.59M-row Table through Python for every
    row."""
    tbl = pq.read_table(archive, columns=["observation_timestamp",
                                          "curtailment_gw", "source"])
    ts = tbl.column("observation_timestamp").to_pylist()
    gw = tbl.column("curtailment_gw").to_pylist()
    src = tbl.column("source").to_pylist()

    # Each row is an hourly observation → gw * 1 hour = gwh. Sum across
    # all (region, fuel) under the same (date, source) key.
    daily: dict[tuple[str, str], float] = defaultdict(float)
    for i in range(len(ts)):
        t = ts[i]
        # Fast date parse: ISO-8601 prefix slicing is cheaper than
        # datetime.fromisoformat on 2.59M rows.
        date_iso = t[:10]
        daily[(date_iso, src[i])] += gw[i]  # gw * 1h = gwh

    # Re-key into nested dict: {date: {source: gwh}}
    out: dict[str, dict[str, float]] = defaultdict(dict)
    for (date_iso, source), gwh in daily.items():
        out[date_iso][source] = gwh
    return out


def write_csv(out_csv: Path, series: dict[str, dict[str, float]]) -> None:
    sources = sorted({s for per_src in series.values() for s in per_src})
    out_csv.parent.mkdir(parents=True, exist_ok=True)
    with open(out_csv, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["date"] + [f"{s}_gwh" for s in sources] + ["total_gwh"])
        for date in sorted(series.keys()):
            row = [date]
            total = 0.0
            for s in sources:
                v = series[date].get(s, 0.0)
                row.append(f"{v:.4f}")
                total += v
            row.append(f"{total:.4f}")
            w.writerow(row)
    print(f"wrote {out_csv.relative_to(REPO_ROOT)} "
          f"({len(series)} daily rows × {len(sources)} sources + total)",
          file=sys.stderr)


def to_plot_arrays(series: dict[str, dict[str, float]]) -> tuple:
    dates = sorted(series.keys())
    sources = sorted({s for per_src in series.values() for s in per_src})
    xs = [datetime.strptime(d, "%Y-%m-%d").replace(tzinfo=timezone.utc)
          for d in dates]
    per_source = {s: np.array([series[d].get(s, 0.0) for d in dates])
                  for s in sources}
    return xs, sources, per_source


def rolling_mean(arr: np.ndarray, window: int = 30) -> np.ndarray:
    if len(arr) < window:
        return arr.astype(float)
    kernel = np.ones(window) / window
    # 'valid' would shrink; use np.convolve with 'same' and pad-prefix
    # so the early days aren't hidden behind the smoother's cold start.
    out = np.convolve(arr, kernel, mode="same")
    return out


def plot(series: dict[str, dict[str, float]], out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)

    xs, sources, per_source = to_plot_arrays(series)
    if not xs:
        print("no daily rows to plot", file=sys.stderr)
        return

    fig, ax = plt.subplots(figsize=(12, 6))

    # Stacked area by source
    palette = {
        "entsoe": "#38b0d8",
        "eia":    "#e76f51",
    }
    default_colour = "#e9c46a"
    stack_arrays = [per_source[s] for s in sources]
    colours = [palette.get(s, default_colour) for s in sources]

    ax.stackplot(xs, *stack_arrays, labels=sources, colors=colours,
                 alpha=0.85, edgecolor="none")

    # 30-day rolling total overlay (summed across all sources)
    total = sum(per_source[s] for s in sources)
    smoothed = rolling_mean(total, window=30)
    ax.plot(xs, smoothed, color="#1d3557", linewidth=1.8,
            label="30-day rolling total", zorder=5)

    # Axis formatting
    ax.set_ylabel("Daily global curtailment (GWh)", fontsize=11)
    ax.set_xlabel("Date", fontsize=11)
    ax.set_title(
        "Figure 3. Daily global curtailment from HB backfill archive "
        f"({xs[0].date()} to {xs[-1].date()}, n={len(xs)} days, "
        f"{len(sources)} source streams)",
        fontsize=12, pad=12,
    )
    ax.xaxis.set_major_locator(mdates.YearLocator())
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y"))
    ax.xaxis.set_minor_locator(mdates.MonthLocator())
    ax.grid(True, which="both", linestyle=":", linewidth=0.4, alpha=0.6)
    ax.set_xlim(xs[0], xs[-1])
    ax.set_ylim(bottom=0)

    # Annotations for regime-change / event milestones
    annotations = [
        ("2020-03-15", "COVID demand drop"),
        ("2021-10-01", "DE Redispatch 2.0"),
        ("2023-01-01", "Solar acceleration\n(post-IRA, post-RePowerEU)"),
    ]
    for iso, text in annotations:
        try:
            d = datetime.strptime(iso, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            continue
        if d < xs[0] or d > xs[-1]:
            continue
        ax.axvline(d, color="#555", linestyle="--", linewidth=0.6, alpha=0.5,
                   zorder=2)
        ax.text(d, ax.get_ylim()[1] * 0.96, text, rotation=0,
                fontsize=8, ha="left", va="top",
                bbox=dict(facecolor="white", alpha=0.85,
                          edgecolor="#888", linewidth=0.4, pad=2),
                zorder=6)

    ax.legend(loc="upper left", fontsize=9, framealpha=0.95)

    # Summary stats inset
    days_total = len(xs)
    archive_twh = total.sum() / 1000.0
    recent_twh = total[-365:].sum() / 1000.0 if len(total) >= 365 else archive_twh
    summary = (
        f"archive total: {archive_twh:,.1f} TWh\n"
        f"trailing 365 days: {recent_twh:,.1f} TWh\n"
        f"days covered: {days_total:,}"
    )
    ax.text(
        0.98, 0.98, summary,
        transform=ax.transAxes,
        ha="right", va="top",
        fontsize=9,
        bbox=dict(boxstyle="round,pad=0.4",
                  facecolor="white",
                  edgecolor="#999", linewidth=0.5, alpha=0.95),
    )

    fig.tight_layout()

    pdf = out_dir / "figure3_temporal_trace.pdf"
    png = out_dir / "figure3_temporal_trace.png"
    fig.savefig(pdf, dpi=300, bbox_inches="tight")
    fig.savefig(png, dpi=200, bbox_inches="tight")
    plt.close(fig)

    print(f"wrote {pdf.relative_to(REPO_ROOT)}", file=sys.stderr)
    print(f"wrote {png.relative_to(REPO_ROOT)}", file=sys.stderr)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--archive", type=Path, default=ARCHIVE)
    ap.add_argument("--csv", type=Path, default=DEFAULT_CSV)
    ap.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR)
    args = ap.parse_args()

    if not args.archive.exists():
        print(f"ERROR: {args.archive} missing — run merge_to_parquet.py first",
              file=sys.stderr)
        return 1

    series = build_daily_series(args.archive)
    write_csv(args.csv, series)
    plot(series, args.out_dir)
    return 0


if __name__ == "__main__":
    sys.exit(main())
