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

Under B4 Option B (`docs/proposals/b4-option-b-decision.md`), the
script also classifies each pair by rate-derivation method and proposes
a T1a/T1b/T1c sub-tier for each. The classification table (RATE_DERIVATION)
is hand-curated from `src/data/*.ts` loader source comments; expand it as
new loaders are added.

Usage:
    python3 scripts/calibration/empirical_tier_bands.py
    python3 scripts/calibration/empirical_tier_bands.py --json > out.json
    python3 scripts/calibration/empirical_tier_bands.py --by-tier
    python3 scripts/calibration/empirical_tier_bands.py --by-derivation
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


# Rate-derivation classification table.
#
# This drives the T1a/T1b/T1c assignment under B4 Option B
# (`docs/proposals/b4-option-b-decision.md`). T1c is a *method*
# classification (rate is extrapolated from a neighbour or regional
# proxy), not a residual classification. The combination of |Δ%| > 15%
# AND classification ∈ {neighbour-extrapolated, regional-proxy} is what
# defines a T1c zone.
#
# Categories:
#   own-tso             : rate is published by the region's own TSO or
#                         national statistical agency (T1a default)
#   domestic-anchor-modelled : own-jurisdiction anchor distributed across
#                         sub-zones via modelled percentage shares
#                         (T1b candidate — the *distribution* introduces
#                         uncertainty even if the *rate source* is local)
#   regional-proxy      : rate is a single-zone proxy representing
#                         multiple jurisdictions in a regional aggregate
#                         (T1b/T1c candidate)
#   neighbour-extrapolated : rate is borrowed from a neighbouring zone
#                         because the home jurisdiction publishes none
#                         (T1c definitionally)
#   own-loader-fallback : T2/T3 region using a typical-shape model
#                         scaled to its own annual anchor (not T1)
#
# Zones not listed default to "unclassified" with a warning. Expand as
# new loaders are audited; cite the source code line for each entry.
RATE_DERIVATION: dict[str, str] = {
    # ENTSO-E zones — verified against `src/data/entsoe.json.ts`
    # 2026-04-25 by reading the ZONES array sourceNote/comment fields.
    "germany":          "own-tso",                  # BNetzA 2024
    "iberia":           "own-tso",                  # REE Informe 2024 (Spanish TSO)
    "france":           "own-tso",                  # RTE Bilan Électrique
    "netherlands":      "domestic-anchor-modelled", # IEEFA 2025 synthesis of 2024 Dutch data
    "poland":           "own-tso",                  # URE 2024 redispatch report
    "greece":           "own-tso",                  # HAEE/IPTO 2025 (Greek TSO/regulator)
    "romania":          "own-tso",                  # Transelectrica (default)
    "turkey":           "own-tso",                  # EPIAS Transparency
    "italy-north-zone": "domestic-anchor-modelled", # Terna 2024 0.31 TWh distributed ~35%
    "italy-south":      "domestic-anchor-modelled", # Terna 2024 0.31 TWh distributed ~45%
    "italy-sardinia":   "domestic-anchor-modelled", # Terna 2024 0.31 TWh distributed ~20%
    "sweden-north":     "own-tso",                  # Svenska Kraftnät SE2 (default)
    "sweden-south":     "own-tso",                  # Svenska Kraftnät SE4 (default)
    "hungary":          "own-tso",                  # MAVIR 2024
    "czech-republic":   "own-tso",                  # CEPS 2024
    "bulgaria":         "own-tso",                  # ESO Bulgaria 2024
    "baltics":          "regional-proxy",           # Litgrid wind-only representing EE+LV+LT
    "switzerland":      "neighbour-extrapolated",   # entsoe.json.ts:172-173 — Czech/Hungarian neighbours
    "finland":          "own-tso",                  # Fingrid (default)
    "norway-no1":       "own-tso",                  # Statnett NO1
    "norway-no2":       "own-tso",                  # Statnett NO2
    "norway-no3":       "own-tso",                  # Statnett NO3
    "norway-no4":       "own-tso",                  # Statnett NO4
    "norway-no5":       "own-tso",                  # Statnett NO5
    "denmark-east":     "own-tso",                  # Energinet DK2
    "denmark-west":     "own-tso",                  # Energinet DK1
    # EIA / AEMO / native-TSO loaders — all jurisdictional own-source.
    "ercot-east":       "own-tso",
    "ercot-west":       "own-tso",
    "caiso":            "own-tso",
    "uk-na":            "own-tso",                  # Elexon BMRS
    "iso-ne":           "own-tso",                  # EIA ISO-NE
    "miso":             "own-tso",                  # EIA MISO
    "nyiso":            "own-tso",                  # EIA NYISO
    "spp":              "own-tso",                  # EIA SPP
    "portugal":         "own-tso",                  # REN / ENTSO-E PT zone
    # Add new entries here as loaders are audited.
}


def classify_rate_derivation(region_id: str) -> str:
    """Return rate-derivation category for a region, or 'unclassified'."""
    return RATE_DERIVATION.get(region_id, "unclassified")


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
                "rate_derivation": classify_rate_derivation(rid),
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


def is_t1_tier(tier: str) -> bool:
    """Return True if this confidence-tier label is a T1 variant.

    Snapshot/parquet tier labels seen in practice:
      * "T1-live-TSO"        — current T1 label
      * "live"               — older raw region.tier
      * "T1"                 — bare label
    """
    if not tier:
        return False
    t = tier.lower()
    return t == "live" or t == "t1" or t.startswith("t1-") or t.startswith("live-")


def proposed_subtier(pair: dict) -> str:
    """B4 Option B sub-tier proposal for a single pair.

    Logic (per `docs/proposals/b4-option-b-decision.md`):
      * |Δ%| ≤ 15% AND own-tso              → T1a (well-calibrated)
      * own-tso AND |Δ%| > 15%              → T1a-with-bias (anchor-refresh candidate)
      * domestic-anchor-modelled            → T1b (modelled distribution introduces uncertainty)
      * regional-proxy                      → T1b
      * neighbour-extrapolated              → T1c
      * non-T1 tiers                        → unchanged
      * unclassified                        → flagged for review
    """
    tier = pair.get("tier", "")
    if not is_t1_tier(tier):
        return tier  # T2/T3/flare unchanged
    rd = pair.get("rate_derivation", "unclassified")
    if rd == "neighbour-extrapolated":
        return "T1c"
    if rd in ("domestic-anchor-modelled", "regional-proxy"):
        return "T1b"
    if rd == "own-tso":
        return "T1a-with-bias" if pair["abs_delta_pct"] > 15.0 else "T1a"
    return "T1?-unclassified"


def render_text(pairs: list[dict], by_tier: bool, by_derivation: bool) -> str:
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

    if by_derivation:
        out.append("--- Rate-derivation breakdown (B4 Option B classification) ---")
        derivations = sorted({p["rate_derivation"] for p in pairs})
        for d in derivations:
            d_pairs = [p for p in pairs if p["rate_derivation"] == d]
            ds = summarise(d_pairs)
            out.append(f"  {d:30} (n={ds['n']:>2})  "
                       f"median |Δ%|={ds['median_abs_delta_pct']:>5.1f}%  "
                       f"P67=±{ds['envelope_for_p67_coverage']:>5.1f}%  "
                       f"P95=±{ds['envelope_for_p95_coverage']:>5.1f}%")
        out.append("")

    out.append("--- Worst offenders (top 10 by |Δ%|, with sub-tier proposal) ---")
    worst = sorted(pairs, key=lambda p: -p["abs_delta_pct"])[:10]
    for p in worst:
        out.append(f"  {p['region_id']:22} {p['year']}  "
                   f"Δ={p['delta_pct']:+7.1f}%  "
                   f"{p['rate_derivation']:24}  "
                   f"→ {proposed_subtier(p)}")
    out.append("")

    out.append("--- Best agreement (bottom 10 by |Δ%|) ---")
    best = sorted(pairs, key=lambda p: p["abs_delta_pct"])[:10]
    for p in best:
        out.append(f"  {p['region_id']:22} {p['year']}  "
                   f"Δ={p['delta_pct']:+7.1f}%  "
                   f"{p['rate_derivation']:24}  "
                   f"→ {proposed_subtier(p)}")
    out.append("")

    # Proposed T1c population — useful for CODEX-7 dispatch.
    t1c_pairs = [p for p in pairs if proposed_subtier(p) == "T1c"]
    t1b_pairs = [p for p in pairs if proposed_subtier(p) == "T1b"]
    out.append("--- Proposed Option B sub-tier populations ---")
    out.append(f"  T1c (neighbour-extrapolated, n={len(t1c_pairs)}):")
    for p in sorted(t1c_pairs, key=lambda x: -x["abs_delta_pct"]):
        out.append(f"    {p['region_id']:22} {p['year']}  Δ={p['delta_pct']:+7.1f}%")
    out.append(f"  T1b (domestic-anchor-modelled or regional-proxy, n={len(t1b_pairs)}):")
    for p in sorted(t1b_pairs, key=lambda x: -x["abs_delta_pct"]):
        out.append(f"    {p['region_id']:22} {p['year']}  Δ={p['delta_pct']:+7.1f}%")
    unclassified = [p for p in pairs if p["rate_derivation"] == "unclassified"]
    if unclassified:
        out.append(f"  UNCLASSIFIED (need RATE_DERIVATION entry, n={len(unclassified)}):")
        for p in unclassified:
            out.append(f"    {p['region_id']:22} {p['year']}  Δ={p['delta_pct']:+7.1f}%  ({p['source']})")
    out.append("")
    return "\n".join(out)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true", help="emit machine-readable JSON instead of text report")
    ap.add_argument("--by-tier", action="store_true", help="also break down statistics by confidence_tier")
    ap.add_argument("--by-derivation", action="store_true",
                    help="also break down by rate-derivation classification (B4 Option B sub-tier proposal)")
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
            "by_derivation": {
                d: summarise([p for p in pairs if p["rate_derivation"] == d])
                for d in sorted({p["rate_derivation"] for p in pairs})
            } if args.by_derivation else None,
            "proposed_t1c_zones": sorted({p["region_id"] for p in pairs if proposed_subtier(p) == "T1c"}),
            "proposed_t1b_zones": sorted({p["region_id"] for p in pairs if proposed_subtier(p) == "T1b"}),
            "unclassified_zones": sorted({p["region_id"] for p in pairs if p["rate_derivation"] == "unclassified"}),
            "pairs": pairs,
        }
        print(json.dumps(out, indent=2))
    else:
        print(render_text(pairs, args.by_tier, args.by_derivation))
    return 0


if __name__ == "__main__":
    sys.exit(main())
