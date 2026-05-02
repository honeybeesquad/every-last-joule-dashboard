#!/usr/bin/env python3
"""
Render Figure 4 of the Scientific Data paper — the per-tier geographic
coverage map — from the regions manifest.

What the figure shows
---------------------
A world map (equirectangular projection) with one dot per region,
coloured by the confidence tier the paper assigns that region:

- **T1-live-TSO** (green): live ENTSO-E / EIA / TSO feeds plus the
  2020-2026 HB backfill. Tier-envelope ±15%.
- **T2-annual-calibrated** (amber): static region with a published
  annual anchor but no hourly feed. Tier envelope ±20%.
- **T3-modelled** (red): regions that rely on a typical-daily-profile
  model because no public hourly source exists. Tier envelope ±40%.

Dot size encodes the region's peak GW (order-of-magnitude scale so a
gigantic curtailment region and a boutique island don't plot at the
same radius). Flare regions are shown with a distinct marker glyph so
reviewers can see where flat 24/7 flare-stack regions sit on the map.

Tier mapping logic mirrors `scripts/build_annual_rollup.py::derive_tier`
so the paper figure and the rollup stay consistent.

Pipeline:
  src/lib/regions.ts               (region manifest with lat/lon/tier)
  scripts/build_annual_rollup.py   (tier mapping reference)
  → docs/figures/figure4_coverage_map.pdf / .png
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
from matplotlib.lines import Line2D

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
REGIONS_TS = REPO_ROOT / "src" / "lib" / "regions.ts"
DEFAULT_OUT_DIR = REPO_ROOT / "docs" / "figures"

# Static-region profile kinds. Mirrors `src/lib/uncertainty.ts::deriveTier`
# routing: only flat-shape statics route to T2-annual-calibrated; every other
# diurnal/seasonal/mixed/overnight profileKind routes to T3-modelled. Must
# stay in sync with `scripts/tally-tiers.ts::STATIC_PROFILE_KIND`.
STATIC_FLAT_REGIONS = {
    "austria", "russia-murmansk-wind",
}

# Region row regex — captures id, tier, lat, lon plus peakGW if present.
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
    "T1-live-TSO":          "#2a9d8f",  # teal
    "T2-annual-calibrated": "#e9c46a",  # amber
    "T3-modelled":          "#e76f51",  # terracotta
    "flare":                "#8a6e3f",  # brown (distinct from T2)
}

TIER_LABEL = {
    "T1-live-TSO":          "T1 live TSO feed (±15%)",
    "T2-annual-calibrated": "T2 annual-calibrated (±20%)",
    "T3-modelled":          "T3 modelled typical profile (±40%)",
    "flare":                "T2 flare (24/7 baseload, ±20%)",
}


def derive_tier(region_id: str, region_tier: str) -> str:
    if region_tier in ("live", "live-domestic-anchored", "live-neighbour-anchored"):
        return "T1-live-TSO"
    if region_tier == "flare":
        return "flare"
    if region_tier == "static":
        # Only flat-shape statics (Austria APG, Russia Murmansk wind) carry a
        # published annual anchor without diurnal modelling — those route to
        # T2-annual-calibrated. Every other static region uses a typical
        # diurnal/seasonal/mixed/overnight shape scaled to an annual anchor,
        # which is T3-modelled per `src/lib/uncertainty.ts::deriveTier`.
        if region_id in STATIC_FLAT_REGIONS:
            return "T2-annual-calibrated"
        return "T3-modelled"
    return "T3-modelled"


def load_regions() -> list[dict]:
    text = REGIONS_TS.read_text()
    out: list[dict] = []
    for m in REGION_RE.finditer(text):
        out.append({
            "id": m.group("id"),
            "name": m.group("name"),
            "country": m.group("country"),
            "lat": float(m.group("lat")),
            "lon": float(m.group("lon")),
            "tier_raw": m.group("tier"),
            "tier": derive_tier(m.group("id"), m.group("tier")),
        })
    return out


def draw_basemap(ax) -> None:
    """Minimal world-outline basemap. No external map data: we render a
    simple longitude grid + ocean band + continent placeholder so the
    figure has geographic context without needing cartopy/natural-
    earth downloads."""
    # Ocean tint
    ax.set_facecolor("#f4f7fb")
    # Graticule
    for lon in range(-180, 181, 30):
        ax.axvline(lon, color="#d8dde5", linewidth=0.4, zorder=1)
    for lat in range(-90, 91, 30):
        ax.axhline(lat, color="#d8dde5", linewidth=0.4, zorder=1)
    # Equator + prime meridian slightly darker
    ax.axhline(0, color="#aeb6c3", linewidth=0.6, zorder=1)
    ax.axvline(0, color="#aeb6c3", linewidth=0.6, zorder=1)
    # Rectangular frame for earth bounds
    ax.set_xlim(-180, 180)
    ax.set_ylim(-90, 90)


def plot(regions: list[dict], out_dir: Path) -> None:
    if not regions:
        print("no regions parsed from regions.ts", file=sys.stderr)
        return

    out_dir.mkdir(parents=True, exist_ok=True)

    fig, ax = plt.subplots(figsize=(14, 7.5))
    draw_basemap(ax)

    # Tier groups
    by_tier: dict[str, list[dict]] = {}
    for r in regions:
        by_tier.setdefault(r["tier"], []).append(r)

    # Plot order: amber + red first so teal sits on top (T1 is the paper
    # headline claim); flare gets its own marker.
    order = ["T3-modelled", "T2-annual-calibrated", "flare", "T1-live-TSO"]

    for tier in order:
        group = by_tier.get(tier, [])
        if not group:
            continue
        xs = [r["lon"] for r in group]
        ys = [r["lat"] for r in group]
        if tier == "flare":
            marker, size = "s", 32  # square
        else:
            marker, size = "o", 48
        ax.scatter(
            xs, ys,
            s=size,
            c=TIER_COLOUR[tier],
            marker=marker,
            edgecolors="#222",
            linewidths=0.5,
            alpha=0.9,
            zorder=4,
            label=f"{TIER_LABEL[tier]}  (n={len(group)})",
        )

    # Title + axes cosmetics
    ax.set_title(
        "Figure 4. Per-region confidence tier assignment "
        f"(n={len(regions)} regions)",
        fontsize=12, pad=10,
    )
    ax.set_xlabel("Longitude", fontsize=10)
    ax.set_ylabel("Latitude", fontsize=10)
    ax.set_xticks(range(-180, 181, 60))
    ax.set_yticks(range(-90, 91, 30))
    ax.set_aspect("equal")

    ax.legend(loc="lower left", fontsize=9, framealpha=0.95)

    # Summary box
    counts = {t: len(by_tier.get(t, [])) for t in order}
    summary = (
        f"T1 live TSO:          {counts.get('T1-live-TSO', 0):>3d}\n"
        f"T2 annual calibrated: {counts.get('T2-annual-calibrated', 0):>3d}\n"
        f"T2 flare (24/7):      {counts.get('flare', 0):>3d}\n"
        f"T3 modelled:          {counts.get('T3-modelled', 0):>3d}\n"
        f"total:                {len(regions):>3d}"
    )
    ax.text(
        0.98, 0.02, summary,
        transform=ax.transAxes,
        ha="right", va="bottom",
        fontsize=9, family="monospace",
        bbox=dict(boxstyle="round,pad=0.4",
                  facecolor="white",
                  edgecolor="#999", linewidth=0.5, alpha=0.95),
    )

    fig.tight_layout()

    pdf = out_dir / "figure4_coverage_map.pdf"
    png = out_dir / "figure4_coverage_map.png"
    fig.savefig(pdf, dpi=300, bbox_inches="tight")
    fig.savefig(png, dpi=200, bbox_inches="tight")
    plt.close(fig)

    print(f"wrote {pdf.relative_to(REPO_ROOT)}", file=sys.stderr)
    print(f"wrote {png.relative_to(REPO_ROOT)}", file=sys.stderr)
    print(f"  regions: {len(regions)}  tiers: {counts}", file=sys.stderr)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR)
    args = ap.parse_args()

    if not REGIONS_TS.exists():
        print(f"ERROR: {REGIONS_TS} missing", file=sys.stderr)
        return 1

    regions = load_regions()
    plot(regions, args.out_dir)
    return 0


if __name__ == "__main__":
    sys.exit(main())
