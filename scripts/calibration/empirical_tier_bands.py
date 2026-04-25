#!/usr/bin/env python3
"""
Empirical T1 tier-band recalibration.

Council finding (B4): only 4/23 backfill region-years fall inside the
nominal T1 ±15% envelope; median |Δ%| ≈ 53.4%. This script makes that
auditable: it joins `data/historical/per_region_annual.parquet` to
`scripts/validation/external-anchors.json`, computes Δ% per region-year
where both backfill and a TSO anchor exist, and runs a coverage-frequency
analysis — at what envelope width do P50, P67, P90, P95 of region-years
fall inside?

Usage:
    python3 scripts/calibration/empirical_tier_bands.py
    python3 scripts/calibration/empirical_tier_bands.py --json > out.json
    python3 scripts/calibration/empirical_tier_bands.py --by-tier
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from statistics import median

try:
    import pyarrow.parquet as pq
except ImportError:
    print("pyarrow required (pip install pyarrow)", file=sys.stderr)
    sys.exit(2)

REPO = Path(__file__).resolve().parent.parent.parent
PARQUET = REPO / "data" / "historical" / "per_region_annual.parquet"
ANCHORS = REPO / "scripts" / "validation" / "external-anchors.json"


def load_backfill() -> list[dict]:
    """Return one row per (region_id, year) from the rollup parquet."""
    return pq.read_table(PARQUET).to_pylist()


def load_anchors() -> dict[str, dict]:
    """Strip metadata keys (start with `_`) from the anchors file."""
    raw = json.loads(ANCHORS.read_text())
    return {k: v for k, v in raw.items() if not k.startswith("_")}


def collect_pairs(backfill: list[dict], anchors: dict[str, dict]) -> list[dict]:
    """For every (region, year) with both backfill and an anchor, build a
    comparison record. Anchors come either from the `tso_annual_twh`
    per-year dict or — as a coarser fallback — from the headline
    `tso_annual_latest` string parsed for the most-recent year.

    Returns a list of dicts:
        {region, year, backfill_twh, anchor_twh, delta_pct, abs_delta_pct,
         tier, source}
    """
    pairs: list[dict] = []
    for row in backfill:
        rid = row["region_id"]
        year = int(row["year"])
        anchor = anchors.get(rid, {})
        per_year = anchor.get("tso_annual_twh") or {}
        # Per-year dict keys may be int or str; normalise.
        anchor_twh = per_year.get(str(year))
        if anchor_twh is None:
            anchor_twh = per_year.get(year)
        if anchor_twh is None:
            continue  # No per-year anchor for this row; skip.
        try:
            anchor_twh = float(anchor_twh)
        except (TypeError, ValueError):
            continue
        if anchor_twh <= 0:
            continue
        bf = float(row["annual_twh"])
        delta_pct = (bf - anchor_twh) / anchor_twh * 100.0
        pairs.append(
            {
                "region_id": rid,
                "year": year,
                "backfill_twh": bf,
                "anchor_twh": anchor_twh,
                "delta_pct": delta_pct,
                "abs_delta_pct": abs(delta_pct),
                "tier": row["confidence_tier"],
                "source": row["source"],
            }
        )
    return pairs


def coverage_at_band(pairs: list[dict], band_pct: float) -> float:
    """Fraction of pairs whose |Δ%| ≤ band_pct."""
    if not pairs:
        return 0.0
    inside = sum(1 for p in pairs if p["abs_delta_pct"] <= band_pct)
    return inside / len(pairs)


def percentile(pairs: list[dict], pct: float) -> float:
    """Pct-th percentile of |Δ%| (e.g. pct=50 → median, pct=95 → P95)."""
    if not pairs:
        return float("nan")
    vals = sorted(p["abs_delta_pct"] for p in pairs)
    if pct <= 0:
        return vals[0]
    if pct >= 100:
        return vals[-1]
    k = (len(vals) - 1) * pct / 100.0
    f = int(k)
    c = min(f + 1, len(vals) - 1)
    if f == c:
        return vals[f]
    return vals[f] + (vals[c] - vals[f]) * (k - f)


def envelope_for_coverage(pairs: list[dict], target_coverage: float) -> float:
    """Smallest envelope-width (%) that contains ≥ target_coverage of pairs.

    Equivalent to the (target_coverage)-th percentile of |Δ%|, since pairs
    inside any band B are exactly those with |Δ%| ≤ B.
    """
    return percentile(pairs, target_coverage * 100.0)


def summarise(pairs: list[dict]) -> dict:
    """Headline statistics for a set of pairs."""
    if not pairs:
        return {"n": 0}
    deltas = [p["delta_pct"] for p in pairs]
    abs_deltas = [p["abs_delta_pct"] for p in pairs]
    return {
        "n": len(pairs),
        "median_signed_delta_pct": median(deltas),
        "median_abs_delta_pct": median(abs_deltas),
        "max_abs_delta_pct": max(abs_deltas),
        "pct_inside_15": coverage_at_band(pairs, 15.0),
        "pct_inside_20": coverage_at_band(pairs, 20.0),
        "pct_inside_30": coverage_at_band(pairs, 30.0),
        "pct_inside_40": coverage_at_band(pairs, 40.0),
        "pct_inside_50": coverage_at_band(pairs, 50.0),
        "pct_inside_75": coverage_at_band(pairs, 75.0),
        "pct_inside_100": coverage_at_band(pairs, 100.0),
        "envelope_for_p50_coverage": envelope_for_coverage(pairs, 0.50),
        "envelope_for_p67_coverage": envelope_for_coverage(pairs, 0.67),
        "envelope_for_p90_coverage": envelope_for_coverage(pairs, 0.90),
        "envelope_for_p95_coverage": envelope_for_coverage(pairs, 0.95),
    }


def render_text(pairs: list[dict], by_tier: bool) -> str:
    out: list[str] = []
    out.append("=" * 72)
    out.append("Empirical T1 tier-band recalibration")
    out.append("=" * 72)
    out.append("")
    out.append(f"Source data: {PARQUET.relative_to(REPO)}")
    out.append(f"Anchor file: {ANCHORS.relative_to(REPO)}")
    out.append("")

    summary = summarise(pairs)
    out.append("--- Headline (all anchored region-years) ---")
    if summary["n"] == 0:
        out.append("No anchor pairs found. Aborting.")
        return "\n".join(out)
    out.append(f"Anchored region-years (pairs):       {summary['n']}")
    out.append(f"Median signed Δ%:                    {summary['median_signed_delta_pct']:+.1f}%")
    out.append(f"Median |Δ%|:                         {summary['median_abs_delta_pct']:.1f}%")
    out.append(f"Max |Δ%|:                            {summary['max_abs_delta_pct']:.1f}%")
    out.append("")
    out.append("Coverage at fixed envelope widths:")
    for w in (15, 20, 30, 40, 50, 75, 100):
        cov = summary[f"pct_inside_{w}"]
        out.append(f"   ±{w:>3}%  →  {cov*100:>5.1f}% of region-years inside")
    out.append("")
    out.append("Envelope width required for target coverage:")
    out.append(f"   P50 coverage  →  ±{summary['envelope_for_p50_coverage']:>5.1f}%")
    out.append(f"   P67 coverage  →  ±{summary['envelope_for_p67_coverage']:>5.1f}%")
    out.append(f"   P90 coverage  →  ±{summary['envelope_for_p90_coverage']:>5.1f}%")
    out.append(f"   P95 coverage  →  ±{summary['envelope_for_p95_coverage']:>5.1f}%")
    out.append("")

    if by_tier:
        tiers = sorted({p["tier"] for p in pairs})
        for tier in tiers:
            tier_pairs = [p for p in pairs if p["tier"] == tier]
            ts = summarise(tier_pairs)
            out.append(f"--- Tier breakdown: {tier} (n={ts['n']}) ---")
            out.append(f"  Median |Δ%|: {ts['median_abs_delta_pct']:.1f}%   "
                       f"P67 envelope: ±{ts['envelope_for_p67_coverage']:.1f}%   "
                       f"P95 envelope: ±{ts['envelope_for_p95_coverage']:.1f}%")
            out.append("")

    out.append("--- Worst offenders (top 10 by |Δ%|) ---")
    worst = sorted(pairs, key=lambda p: -p["abs_delta_pct"])[:10]
    for p in worst:
        out.append(f"  {p['region_id']:25} {p['year']}  "
                   f"backfill={p['backfill_twh']:>7.3f} TWh  "
                   f"anchor={p['anchor_twh']:>7.3f} TWh  "
                   f"Δ={p['delta_pct']:+7.1f}%  ({p['tier']})")
    out.append("")

    out.append("--- Best agreement (bottom 10 by |Δ%|) ---")
    best = sorted(pairs, key=lambda p: p["abs_delta_pct"])[:10]
    for p in best:
        out.append(f"  {p['region_id']:25} {p['year']}  "
                   f"backfill={p['backfill_twh']:>7.3f} TWh  "
                   f"anchor={p['anchor_twh']:>7.3f} TWh  "
                   f"Δ={p['delta_pct']:+7.1f}%  ({p['tier']})")
    out.append("")
    return "\n".join(out)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true", help="emit machine-readable JSON instead of text report")
    ap.add_argument("--by-tier", action="store_true", help="also break down statistics by confidence_tier")
    args = ap.parse_args()

    backfill = load_backfill()
    anchors = load_anchors()
    pairs = collect_pairs(backfill, anchors)

    if args.json:
        out = {
            "summary": summarise(pairs),
            "by_tier": {
                tier: summarise([p for p in pairs if p["tier"] == tier])
                for tier in sorted({p["tier"] for p in pairs})
            } if args.by_tier else None,
            "pairs": pairs,
        }
        print(json.dumps(out, indent=2))
    else:
        print(render_text(pairs, args.by_tier))
    return 0


if __name__ == "__main__":
    sys.exit(main())
