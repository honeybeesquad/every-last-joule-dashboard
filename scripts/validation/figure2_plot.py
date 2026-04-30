#!/usr/bin/env python3
"""
Render Figure 2 of the Scientific Data paper — the backfill-vs-TSO
validation scatter with tier-envelope error bars — as a publication-
quality PDF and PNG.

Pipeline:
  data/historical/figure2_validation_scatter.csv  (built by figure2_data.py)
  → docs/figures/figure2_validation_scatter.pdf
  → docs/figures/figure2_validation_scatter.png

Design decisions (for reviewers):
- Log-log axes because TWh values span ~0.03 (iso-ne dispatch-down)
  up to ~23 (Germany BNetzA).
- Y error bars from `backfill_low_twh` / `backfill_high_twh` (the tier
  envelope already stored per-row in the CSV).
- Diagonal y=x reference line in solid grey; ±15% tier band shaded to
  show the T1-live-TSO target envelope.
- Points colour-coded by absolute delta: green (≤15%, within envelope),
  amber (≤50%), red (>50%). Paper narrative must justify every red
  marker in the corresponding per-region Discrepancy analysis.
- Every point labelled with "region-id yr" so reviewers can cross-
  reference the MD in docs/validation/.
- Inset summary (bottom-right): count of points, median |Δ%|, and
  fraction within envelope.

Run
---
  .venv/bin/python scripts/validation/figure2_plot.py
  .venv/bin/python scripts/validation/figure2_plot.py --out custom/dir/

The script depends on matplotlib (installed into .venv for paper
artefacts; not a runtime dependency of the dashboard itself).
"""

from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
from matplotlib.lines import Line2D
from matplotlib.patches import Patch

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
CSV_PATH = REPO_ROOT / "data" / "historical" / "figure2_validation_scatter.csv"
DEFAULT_OUT_DIR = REPO_ROOT / "docs" / "figures"

TIER_FRACTION = 0.15  # T1-live-TSO envelope shaded band


def load_rows(csv_path: Path) -> list[dict]:
    with open(csv_path, newline="") as f:
        return list(csv.DictReader(f))


def classify_delta(abs_pct: float) -> str:
    if abs_pct <= 15.0:
        return "within"
    if abs_pct <= 50.0:
        return "moderate"
    return "material"


COLOURS = {
    "within":   "#2a9d8f",  # teal
    "moderate": "#e9c46a",  # amber
    "material": "#e76f51",  # terracotta
}


def plot(rows: list[dict], out_dir: Path) -> None:
    if not rows:
        print("no rows to plot", file=sys.stderr)
        return

    out_dir.mkdir(parents=True, exist_ok=True)

    anchor = np.array([float(r["tso_anchor_twh"]) for r in rows])
    backfill = np.array([float(r["backfill_twh"]) for r in rows])
    low = np.array([float(r["backfill_low_twh"]) for r in rows])
    high = np.array([float(r["backfill_high_twh"]) for r in rows])
    delta = np.array([float(r["delta_pct"]) for r in rows])
    abs_delta = np.abs(delta)
    labels = [f"{r['region_id']} {r['year']}" for r in rows]

    # asymmetric y errorbar relative to `backfill`
    yerr_lower = np.clip(backfill - low, 0.0, None)
    yerr_upper = np.clip(high - backfill, 0.0, None)

    classes = [classify_delta(x) for x in abs_delta]
    colours = [COLOURS[c] for c in classes]

    fig, ax = plt.subplots(figsize=(9, 9))
    ax.set_xscale("log")
    ax.set_yscale("log")

    # Axes limits: pad one order of magnitude either side.
    lo = min(anchor.min(), backfill.min()) * 0.3
    hi = max(anchor.max(), backfill.max()) * 3.0
    ax.set_xlim(lo, hi)
    ax.set_ylim(lo, hi)

    # y = x diagonal reference
    ref = np.linspace(lo, hi, 200)
    ax.plot(ref, ref, color="#333333", linewidth=1.0, zorder=1,
            label="y = x (perfect agreement)")

    # ±15% tier envelope shaded band
    ax.fill_between(ref,
                    ref * (1 - TIER_FRACTION),
                    ref * (1 + TIER_FRACTION),
                    color="#2a9d8f",
                    alpha=0.10,
                    zorder=0,
                    label=f"±{int(TIER_FRACTION * 100)}% tier envelope")
    # ±50% informational band (soft)
    ax.fill_between(ref, ref * 0.5, ref * 1.5,
                    color="#e9c46a",
                    alpha=0.05,
                    zorder=0)

    # Points with asymmetric error bars
    for i in range(len(rows)):
        ax.errorbar(
            anchor[i], backfill[i],
            yerr=[[yerr_lower[i]], [yerr_upper[i]]],
            fmt="o",
            markersize=7,
            markerfacecolor=colours[i],
            markeredgecolor="#222222",
            markeredgewidth=0.6,
            ecolor=colours[i],
            elinewidth=1.0,
            capsize=3,
            alpha=0.95,
            zorder=3,
        )
        # Label placement: offset slightly up-right, shrink font
        ax.annotate(
            labels[i],
            xy=(anchor[i], backfill[i]),
            xytext=(4, 4),
            textcoords="offset points",
            fontsize=7,
            color="#333333",
            zorder=4,
        )

    ax.set_xlabel("Published TSO / ISO / SoM annual curtailment (TWh)",
                  fontsize=11)
    ax.set_ylabel("Backfill reconstruction annual total (TWh)",
                  fontsize=11)
    ax.set_title(
        "Figure 2. Backfill vs. published TSO annual curtailment "
        f"({len(rows)} region-year pairs)",
        fontsize=12, pad=12,
    )
    ax.grid(True, which="both", linestyle=":", linewidth=0.4, alpha=0.6)

    # Legend: reference line + tier band + class colours
    legend_handles = [
        Line2D([0], [0], color="#333333", linewidth=1.0,
               label="y = x (perfect agreement)"),
        Patch(facecolor="#2a9d8f", alpha=0.15, edgecolor="none",
              label=f"±{int(TIER_FRACTION * 100)}% T1 tier envelope"),
        Line2D([0], [0], marker="o", color="w",
               markerfacecolor=COLOURS["within"],
               markeredgecolor="#222",
               markersize=7,
               label="|Δ| ≤ 15% (within envelope)"),
        Line2D([0], [0], marker="o", color="w",
               markerfacecolor=COLOURS["moderate"],
               markeredgecolor="#222",
               markersize=7,
               label="|Δ| ≤ 50% (moderate)"),
        Line2D([0], [0], marker="o", color="w",
               markerfacecolor=COLOURS["material"],
               markeredgecolor="#222",
               markersize=7,
               label="|Δ| > 50% (material; see MD)"),
    ]
    ax.legend(handles=legend_handles, loc="upper left", fontsize=9,
              framealpha=0.95)

    # Inset summary stats box (lower right)
    median_abs = float(np.median(abs_delta))
    within_env = int(np.sum(abs_delta <= TIER_FRACTION * 100))
    summary = (
        f"n = {len(rows)} region-year pairs\n"
        f"median |Δ%| = {median_abs:.1f}%\n"
        f"within envelope = {within_env}/{len(rows)} "
        f"({100 * within_env / len(rows):.0f}%)"
    )
    ax.text(
        0.98, 0.02, summary,
        transform=ax.transAxes,
        ha="right", va="bottom",
        fontsize=9,
        bbox=dict(boxstyle="round,pad=0.4",
                  facecolor="white",
                  edgecolor="#999", linewidth=0.5, alpha=0.95),
    )

    fig.tight_layout()

    pdf = out_dir / "figure2_validation_scatter.pdf"
    png = out_dir / "figure2_validation_scatter.png"
    fig.savefig(pdf, dpi=300, bbox_inches="tight")
    fig.savefig(png, dpi=200, bbox_inches="tight")
    plt.close(fig)

    print(f"wrote {pdf.relative_to(REPO_ROOT)}", file=sys.stderr)
    print(f"wrote {png.relative_to(REPO_ROOT)}", file=sys.stderr)
    print(
        f"  n={len(rows)}  median |Δ%|={median_abs:.1f}%  "
        f"within_envelope={within_env}/{len(rows)}",
        file=sys.stderr,
    )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", type=Path, default=CSV_PATH)
    ap.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR)
    args = ap.parse_args()

    if not args.csv.exists():
        print(
            f"ERROR: {args.csv} missing — run figure2_data.py first",
            file=sys.stderr,
        )
        return 1

    rows = load_rows(args.csv)
    plot(rows, args.out_dir)
    return 0


if __name__ == "__main__":
    sys.exit(main())
