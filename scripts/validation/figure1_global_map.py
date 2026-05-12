#!/usr/bin/env python3
"""
Render Figure 1 of the Scientific Data paper — the global curtailment
map at current snapshot — from the regions manifest and snapshot cache.

Pipeline:
  src/lib/regions.ts                         (lat/lon/tier per region)
  data/snapshots/last-good/*.json            (current peak GW per region)
  → docs/figures/figure1_global_map.pdf / .png

What the figure shows
---------------------
A world map with one dot per region. Each dot is:
- **Coloured** by confidence tier (same palette as Figure 4):
  T1-live-TSO (cyan), T2-annual-calibrated (amber), T3-modelled
  (terracotta), flare (brown square).
- **Sized** by current peak GW (√-scaled so that a 10 GW pillar
  doesn't obliterate a 0.1 GW one, but the hotspot ranking is still
  legible).

This is the paper's "what does global curtailment look like right
now?" figure — the geographic summary a reviewer sees before the
deeper discrepancy work in Figure 2. Figure 4 (same basemap) strips
out the size encoding to make the tier coverage claim in isolation;
this figure reintroduces the magnitude encoding so the reader sees
where the big hotspots are.

Data sourcing
-------------
- Lat/lon/tier come from `src/lib/regions.ts` via the same regex
  parser used for Figure 4.
- Peak GW comes from `data/snapshots/last-good/<region>.json`. For
  multi-region loader outputs (AEMO, ERCOT split, Norway zones,
  Brazil clusters, etc.), the loader-level file is a dict keyed by
  region_id; we walk the dict. Regions with no snapshot fall back to
  a minimum-size dot so they're still visible (shows coverage) but
  visually deprioritised.

Run
---
  .venv/bin/python scripts/validation/figure1_global_map.py
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
from matplotlib.lines import Line2D
from matplotlib.patches import Patch

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
REGIONS_TS = REPO_ROOT / "src" / "lib" / "regions.ts"
SNAPSHOTS_DIR = REPO_ROOT / "data" / "snapshots" / "last-good"
DEFAULT_OUT_DIR = REPO_ROOT / "docs" / "figures"

# Must stay in sync with scripts/validation/figure4_coverage_map.py
# and scripts/build_annual_rollup.py
# Only these two statics have a flat shape and route to T2-annual-calibrated;
# all other statics use a diurnal/seasonal/mixed shape → T3-modelled.
STATIC_FLAT_REGIONS = {
    "austria", "russia-murmansk-wind",
}

# tier values: "live" (T1a), "live-domestic-anchored" (T1b),
# "live-neighbour-anchored" (T1c), "static" (T2/T3), "flare" (T2-flare).
REGION_RE = re.compile(
    r'\{\s*id:\s*"(?P<id>[a-z0-9-]+)",'
    r'\s*name:\s*"(?P<name>[^"]+)",'
    r'\s*country:\s*"(?P<country>[^"]+)",'
    r'\s*lat:\s*(?P<lat>-?[\d.]+),'
    r'\s*lon:\s*(?P<lon>-?[\d.]+),'
    r'\s*tier:\s*"(?P<tier>live-domestic-anchored|live-neighbour-anchored|live|static|flare)"'
    r'.*?\}',
    re.DOTALL,
)

TIER_COLOUR = {
    "T1-live-TSO":          "#38b0d8",
    "T2-annual-calibrated": "#e9c46a",
    "T3-modelled":          "#e76f51",
    "flare":                "#8a6e3f",
}

TIER_LABEL = {
    "T1-live-TSO":          "T1 live TSO feed",
    "T2-annual-calibrated": "T2 annual-calibrated",
    "T3-modelled":          "T3 modelled typical profile",
    "flare":                "T2 flare (24/7 baseload)",
}


def derive_tier(region_id: str, region_tier: str) -> str:
    if region_tier in ("live", "live-domestic-anchored", "live-neighbour-anchored"):
        return "T1-live-TSO"
    if region_tier == "flare":
        return "flare"
    if region_tier == "static":
        if region_id in STATIC_FLAT_REGIONS:
            return "T2-annual-calibrated"
        return "T3-modelled"
    return "T3-modelled"


def load_regions() -> list[dict]:
    text = REGIONS_TS.read_text()
    out = []
    for m in REGION_RE.finditer(text):
        rid = m.group("id")
        out.append({
            "id": rid,
            "name": m.group("name"),
            "country": m.group("country"),
            "lat": float(m.group("lat")),
            "lon": float(m.group("lon")),
            "tier": derive_tier(rid, m.group("tier")),
        })
    return out


def load_peak_gws() -> dict[str, float]:
    """Walk every JSON in data/snapshots/last-good and collect
    (region_id, peakGW) pairs. Handles both single-region and multi-
    region (dict-of-regions) snapshot shapes."""
    out: dict[str, float] = {}
    if not SNAPSHOTS_DIR.exists():
        return out

    for f in sorted(SNAPSHOTS_DIR.glob("*.json")):
        try:
            data = json.loads(f.read_text())
        except (OSError, json.JSONDecodeError) as e:
            print(f"  skip {f.name}: {e}", file=sys.stderr)
            continue
        if not isinstance(data, dict):
            continue

        # Single-region shape: has regionId + peakGW at the top level
        if "regionId" in data and "peakGW" in data:
            out[data["regionId"]] = float(data["peakGW"])
            continue

        # Multi-region dict shape: keys are region ids (or aliases)
        for k, v in data.items():
            if isinstance(v, dict) and "peakGW" in v:
                rid = v.get("regionId", k)
                out[rid] = float(v["peakGW"])

    return out


def size_from_peak(peak_gw: float) -> float:
    """Scatter-marker size from peak GW. Uses sqrt so a 10 GW region
    is ~3x a 1 GW region, not 10x. Minimum size keeps dormant regions
    visible without occluding the hotspots."""
    if peak_gw <= 0:
        return 15.0
    return 15.0 + np.sqrt(peak_gw) * 70.0


def draw_basemap(ax) -> None:
    """Mirror of figure4_coverage_map.draw_basemap — ocean tint +
    graticule + earth frame, no external map data."""
    ax.set_facecolor("#f4f7fb")
    for lon in range(-180, 181, 30):
        ax.axvline(lon, color="#d8dde5", linewidth=0.4, zorder=1)
    for lat in range(-90, 91, 30):
        ax.axhline(lat, color="#d8dde5", linewidth=0.4, zorder=1)
    ax.axhline(0, color="#aeb6c3", linewidth=0.6, zorder=1)
    ax.axvline(0, color="#aeb6c3", linewidth=0.6, zorder=1)
    ax.set_xlim(-180, 180)
    ax.set_ylim(-90, 90)


def plot(regions: list[dict], peak_gws: dict[str, float], out_dir: Path) -> None:
    if not regions:
        print("no regions parsed", file=sys.stderr)
        return
    out_dir.mkdir(parents=True, exist_ok=True)

    fig, ax = plt.subplots(figsize=(14, 7.5))
    draw_basemap(ax)

    # Group by tier; plot T3 first, T1 last so the headline-claim
    # regions render on top.
    by_tier: dict[str, list[dict]] = {}
    for r in regions:
        peak = peak_gws.get(r["id"], 0.0)
        r_aug = dict(r, peak_gw=peak, marker_size=size_from_peak(peak))
        by_tier.setdefault(r["tier"], []).append(r_aug)

    order = ["T3-modelled", "T2-annual-calibrated", "flare", "T1-live-TSO"]
    for tier in order:
        group = by_tier.get(tier, [])
        if not group:
            continue
        xs = [r["lon"] for r in group]
        ys = [r["lat"] for r in group]
        sizes = [r["marker_size"] for r in group]
        marker = "s" if tier == "flare" else "o"
        ax.scatter(
            xs, ys,
            s=sizes,
            c=TIER_COLOUR[tier],
            marker=marker,
            edgecolors="#222",
            linewidths=0.4,
            alpha=0.85,
            zorder=4,
        )

    # Label top-8 regions by peak GW so the headline hotspots carry
    # their names on the figure (rest stay dots-only for readability).
    all_with_peak = [(r["id"], r["lon"], r["lat"], peak_gws.get(r["id"], 0.0))
                     for r in regions]
    top_labelled = sorted(all_with_peak, key=lambda x: -x[3])[:8]
    for rid, lon, lat, peak in top_labelled:
        if peak <= 0:
            continue
        ax.annotate(
            f"{rid}\n{peak:.1f} GW",
            xy=(lon, lat),
            xytext=(6, 6),
            textcoords="offset points",
            fontsize=7,
            color="#111",
            bbox=dict(boxstyle="round,pad=0.2",
                      facecolor="white", edgecolor="#888",
                      linewidth=0.3, alpha=0.85),
            zorder=6,
        )

    # Title + axes cosmetics
    n_regions = len(regions)
    covered = sum(1 for r in regions if peak_gws.get(r["id"], 0.0) > 0)
    ax.set_title(
        "Figure 1. Global curtailment snapshot "
        f"(n={n_regions} regions, {covered} with live peak GW data)",
        fontsize=12, pad=10,
    )
    ax.set_xlabel("Longitude", fontsize=10)
    ax.set_ylabel("Latitude", fontsize=10)
    ax.set_xticks(range(-180, 181, 60))
    ax.set_yticks(range(-90, 91, 30))
    ax.set_aspect("equal")

    # Legend with three entries: tier colours + size reference
    legend_elems = [
        Line2D([0], [0], marker="o", color="w",
               markerfacecolor=TIER_COLOUR["T1-live-TSO"],
               markeredgecolor="#222", markersize=9,
               label=TIER_LABEL["T1-live-TSO"]),
        Line2D([0], [0], marker="o", color="w",
               markerfacecolor=TIER_COLOUR["T2-annual-calibrated"],
               markeredgecolor="#222", markersize=9,
               label=TIER_LABEL["T2-annual-calibrated"]),
        Line2D([0], [0], marker="s", color="w",
               markerfacecolor=TIER_COLOUR["flare"],
               markeredgecolor="#222", markersize=8,
               label=TIER_LABEL["flare"]),
        Line2D([0], [0], marker="o", color="w",
               markerfacecolor=TIER_COLOUR["T3-modelled"],
               markeredgecolor="#222", markersize=9,
               label=TIER_LABEL["T3-modelled"]),
    ]
    ax.legend(handles=legend_elems, loc="lower left", fontsize=8,
              framealpha=0.95, title="Confidence tier",
              title_fontsize=9)

    # Size-legend inset (top-right): three reference dots showing the
    # √ scaling so the reader can eyeball GW from dot area.
    from matplotlib.patches import FancyBboxPatch
    size_ref_gws = [0.1, 1.0, 10.0]
    ref_ax = fig.add_axes([0.82, 0.82, 0.16, 0.12])
    ref_ax.set_facecolor("white")
    for i, g in enumerate(size_ref_gws):
        ref_ax.scatter(0.25, 0.7 - i * 0.3, s=size_from_peak(g),
                       c="#aaaaaa", edgecolors="#222", linewidths=0.4)
        ref_ax.text(0.55, 0.7 - i * 0.3, f"{g} GW peak",
                    fontsize=8, va="center", color="#333")
    ref_ax.set_xlim(0, 1)
    ref_ax.set_ylim(0, 1)
    ref_ax.set_xticks([])
    ref_ax.set_yticks([])
    for spine in ref_ax.spines.values():
        spine.set_edgecolor("#999")
        spine.set_linewidth(0.5)
    ref_ax.set_title("Dot size", fontsize=8, pad=2)

    fig.tight_layout()

    pdf = out_dir / "figure1_global_map.pdf"
    png = out_dir / "figure1_global_map.png"
    fig.savefig(pdf, dpi=300, bbox_inches="tight")
    fig.savefig(png, dpi=200, bbox_inches="tight")
    plt.close(fig)

    total_peak = sum(peak_gws.get(r["id"], 0.0) for r in regions)
    print(f"wrote {pdf.relative_to(REPO_ROOT)}", file=sys.stderr)
    print(f"wrote {png.relative_to(REPO_ROOT)}", file=sys.stderr)
    print(f"  regions: {n_regions}  with peak GW: {covered}  "
          f"sum peak GW: {total_peak:.1f}", file=sys.stderr)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR)
    args = ap.parse_args()

    if not REGIONS_TS.exists():
        print(f"ERROR: {REGIONS_TS} missing", file=sys.stderr)
        return 1

    regions = load_regions()
    peak_gws = load_peak_gws()
    plot(regions, peak_gws, args.out_dir)
    return 0


if __name__ == "__main__":
    sys.exit(main())
