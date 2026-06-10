#!/usr/bin/env python3
"""
Render Figure 5 of the Scientific Data paper — the top-20-region
annual curtailment timeseries facet grid (2020-2026) — from the
per-region annual rollup.

Pipeline:
  data/historical/per_region_annual.parquet  (built by build_annual_rollup.py)
  → docs/figures/figure5_top20_timeseries.pdf / .png

What the figure shows
---------------------
Small-multiple facet grid (4 cols × 5 rows). Each of the 20 panels is
the 2020-2026 annual curtailment series for one region, ranked by
mean annual TWh across the backfill window. Panel title is the
region id plus the 2024 annual TWh (a stable headline number that
matches the Figure 2 anchor column). Each panel's Y axis autoscales;
cross-panel comparisons are intentional — the reader compares
_shape_, not magnitude, between panels.

The ranking captures the paper's "curtailment is concentrated in a
handful of regions" thesis: Germany, Iberia, MISO, ERCOT together
account for over half of the global annual curtailment even though
the dataset covers 29 live regions plus 99 static ones.

Tier colouring is applied per panel:
- T1-live-TSO: cyan line
- T2-annual-calibrated: amber
- T3-modelled: terracotta

(In v0.5 all top-20 regions happen to be T1; the colouring
infrastructure is kept so new high-curtailment regions promoted from
T2/T3 in v1 are rendered correctly without script changes.)

Run
---
  .venv/bin/python scripts/validation/figure5_top20_timeseries.py
"""

from __future__ import annotations

import argparse
import sys
from collections import defaultdict
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pyarrow.parquet as pq

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
ROLLUP = REPO_ROOT / "data" / "historical" / "per_region_annual.parquet"
DEFAULT_OUT_DIR = REPO_ROOT / "docs" / "figures"

TIER_COLOUR = {
    "T1-live-TSO":          "#38b0d8",
    "T2-annual-calibrated": "#e9c46a",
    "T3-modelled":          "#e76f51",
}

# Number of ranked regions to facet.
TOP_N = 20

# Facet grid shape (rows x cols must equal TOP_N).
N_ROWS, N_COLS = 5, 4


def load_rollup(path: Path) -> list[dict]:
    tbl = pq.read_table(path)
    return tbl.to_pylist()


def rank_regions(rows: list[dict], top_n: int) -> list[dict]:
    """Group rows by region_id, compute mean annual_twh over the
    backfill window, return top-N descending.

    Each output entry is:
      {region_id, mean_twh, latest_twh, tier, years, twh_series}
    where twh_series is a list of (year, twh) sorted by year.
    """
    by_region: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        by_region[r["region_id"]].append(r)

    out = []
    for rid, rs in by_region.items():
        rs_sorted = sorted(rs, key=lambda r: r["year"])
        years = [r["year"] for r in rs_sorted]
        twhs = [r["annual_twh"] for r in rs_sorted]
        mean = sum(twhs) / len(twhs) if twhs else 0.0
        # Latest = highest year present
        latest_twh = twhs[-1] if twhs else 0.0
        latest_year = years[-1] if years else 0
        # 2024 is the paper's reference year for the headline in the
        # panel title; fall back to latest if 2024 missing.
        ref_twh = next((t for y, t in zip(years, twhs) if y == 2024), latest_twh)
        out.append({
            "region_id": rid,
            "mean_twh": mean,
            "ref_twh": ref_twh,
            "latest_year": latest_year,
            "tier": rs_sorted[0].get("confidence_tier", "T2-annual-calibrated"),
            "twh_series": list(zip(years, twhs)),
        })

    out.sort(key=lambda r: -r["mean_twh"])
    return out[:top_n]


def plot(ranked: list[dict], out_dir: Path) -> None:
    if not ranked:
        print("no regions to plot", file=sys.stderr)
        return
    out_dir.mkdir(parents=True, exist_ok=True)

    # Figure size tuned so each facet is ~2.5×1.8 inches.
    fig, axes = plt.subplots(
        N_ROWS, N_COLS,
        figsize=(N_COLS * 2.6 + 0.8, N_ROWS * 1.9 + 0.8),
        sharex=True,
    )
    axes_flat = axes.flatten()

    for idx, region in enumerate(ranked):
        ax = axes_flat[idx]
        colour = TIER_COLOUR.get(region["tier"], "#555555")
        years = [y for y, _ in region["twh_series"]]
        twhs = [t for _, t in region["twh_series"]]
        ax.plot(years, twhs, color=colour, linewidth=1.8, marker="o",
                markersize=4, zorder=3)
        ax.fill_between(years, 0, twhs, color=colour, alpha=0.15, zorder=2)

        # Panel title: "rank. region-id   2024: X.X TWh"
        title = f"{idx + 1}. {region['region_id']}"
        ax.set_title(title, fontsize=9, pad=3, loc="left")

        # Reference TWh annotation inside panel (top-right)
        ax.text(
            0.97, 0.93,
            f"2024: {region['ref_twh']:.2f} TWh",
            transform=ax.transAxes,
            ha="right", va="top",
            fontsize=7,
            color="#333333",
            bbox=dict(boxstyle="round,pad=0.2",
                      facecolor="white", edgecolor="none", alpha=0.8),
        )

        # Axis cosmetics
        ax.set_ylim(bottom=0)
        ax.tick_params(labelsize=7)
        ax.grid(True, which="both", axis="y", linestyle=":",
                linewidth=0.3, alpha=0.5)
        # Only show x-tick labels on bottom row
        if idx < (N_ROWS - 1) * N_COLS:
            ax.tick_params(labelbottom=False)
        else:
            ax.set_xticks(years)

    # Hide any unused axes (shouldn't happen if TOP_N == N_ROWS*N_COLS)
    for idx in range(len(ranked), len(axes_flat)):
        axes_flat[idx].axis("off")

    fig.suptitle(
        f"Figure 5. Top {TOP_N} curtailment regions — annual TWh 2020–2026",
        fontsize=12, y=0.995,
    )

    # One shared y-axis label on the far left
    fig.supylabel("Annual curtailment (TWh)", fontsize=10, x=0.005)

    # Legend of tier colours at bottom
    from matplotlib.lines import Line2D
    legend_handles = [
        Line2D([0], [0], color=TIER_COLOUR["T1-live-TSO"], linewidth=2,
               label="T1 live TSO feed"),
        Line2D([0], [0], color=TIER_COLOUR["T2-annual-calibrated"], linewidth=2,
               label="T2 annual-calibrated"),
        Line2D([0], [0], color=TIER_COLOUR["T3-modelled"], linewidth=2,
               label="T3 modelled"),
    ]
    fig.legend(handles=legend_handles, loc="lower center", ncol=3,
               fontsize=9, framealpha=0.95,
               bbox_to_anchor=(0.5, -0.01))

    fig.tight_layout(rect=[0.015, 0.025, 1.0, 0.97])

    pdf = out_dir / "figure5_top20_timeseries.pdf"
    png = out_dir / "figure5_top20_timeseries.png"
    fig.savefig(pdf, dpi=300, bbox_inches="tight")
    fig.savefig(png, dpi=200, bbox_inches="tight")
    plt.close(fig)

    print(f"wrote {pdf.relative_to(REPO_ROOT)}", file=sys.stderr)
    print(f"wrote {png.relative_to(REPO_ROOT)}", file=sys.stderr)
    print(f"  ranked {len(ranked)} regions, combined 2024 TWh: "
          f"{sum(r['ref_twh'] for r in ranked):.1f}", file=sys.stderr)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--rollup", type=Path, default=ROLLUP)
    ap.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR)
    args = ap.parse_args()

    if not args.rollup.exists():
        print(f"ERROR: {args.rollup} missing — run build_annual_rollup.py first",
              file=sys.stderr)
        return 1

    rows = load_rollup(args.rollup)
    ranked = rank_regions(rows, TOP_N)
    plot(ranked, args.out_dir)
    return 0


if __name__ == "__main__":
    sys.exit(main())
