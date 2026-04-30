#!/usr/bin/env python3
"""
Emit the raw data for Figure 2 of the Scientific Data paper — the
"backfill vs. published TSO anchor" validation scatter.

One CSV row per (region_id, year) pair where we have BOTH a backfill
annual total (from data/historical/per_region_annual.parquet) AND a
published TSO annual anchor (from scripts/validation/external-anchors.json).

Schema of the emitted CSV:

  region_id            str       e.g. "caiso"
  region_name          str       human-facing label from regions.ts / aggregates
  year                 int       e.g. 2024
  confidence_tier      str       "T1-live-TSO" | "T2-annual-calibrated" | ...
  tier_fraction        float     symmetric fractional half-width (0.15 etc.)
  backfill_twh         float     our reconstructed annual total
  backfill_low_twh     float     lower bound = backfill_twh × (1 - tier_fraction)
  backfill_high_twh    float     upper bound = backfill_twh × (1 + tier_fraction)
  tso_anchor_twh       float     published TSO / Ember / IRENA annual
  delta_pct            float     100 × (backfill_twh - tso_anchor_twh) / tso_anchor_twh
  anchor_source        str       short provenance tag from external-anchors.json

Run
---
  python3 scripts/validation/figure2_data.py
  python3 scripts/validation/figure2_data.py --out custom/path.csv

The output is deterministic — re-running regenerates the CSV from the
current rollup + anchor set. This means the figure itself (to be
produced by a downstream matplotlib / R / gnuplot pass) is always
traceable back to a committed rollup.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from pathlib import Path

import pyarrow.parquet as pq

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
ROLLUP_PATH = REPO_ROOT / "data" / "historical" / "per_region_annual.parquet"
ANCHORS_PATH = REPO_ROOT / "scripts" / "validation" / "external-anchors.json"
REGIONS_TS = REPO_ROOT / "src" / "lib" / "regions.ts"
DEFAULT_OUT = REPO_ROOT / "data" / "historical" / "figure2_validation_scatter.csv"

# Mirror of BACKFILL_AGGREGATE_REGIONS in build_region_docs.py. Whole-ISO
# aggregates are not in regions.ts but still appear in the rollup + anchors.
AGGREGATE_NAMES: dict[str, str] = {
    "nyiso":  "NYISO (whole ISO)",
    "iso-ne": "ISO-NE (whole ISO)",
}

_REGION_NAME_RE = re.compile(
    r'id:\s*"(?P<id>[a-z0-9-]+)",\s*name:\s*"(?P<name>[^"]+)"',
    re.DOTALL,
)


def load_region_names() -> dict[str, str]:
    """Map region_id -> display name from regions.ts."""
    out: dict[str, str] = dict(AGGREGATE_NAMES)
    text = REGIONS_TS.read_text()
    for m in _REGION_NAME_RE.finditer(text):
        out.setdefault(m.group("id"), m.group("name"))
    return out


def load_rollup_rows() -> list[dict]:
    t = pq.read_table(ROLLUP_PATH)
    return t.to_pylist()


def load_anchors() -> dict[str, dict]:
    return json.loads(ANCHORS_PATH.read_text())


def build_rows(
    rollup: list[dict],
    anchors: dict[str, dict],
    names: dict[str, str],
) -> list[dict]:
    """Join (region, year) across rollup and anchors. Emit only pairs
    where BOTH a backfill total and a TSO anchor exist for that year."""
    rows: list[dict] = []
    # Index rollup by (region_id, year) for cheap lookup
    idx: dict[tuple[str, int], dict] = {}
    for r in rollup:
        idx[(r["region_id"], int(r["year"]))] = r

    for region_id, anchor in sorted(anchors.items()):
        # Skip metadata keys (e.g. _description, _schema_version) that aren't
        # region anchors.
        if not isinstance(anchor, dict) or region_id.startswith("_"):
            continue
        yearly = anchor.get("tso_annual_twh") or {}
        for year_key, twh in sorted(yearly.items(), key=lambda kv: int(kv[0])):
            year = int(year_key)
            key = (region_id, year)
            r = idx.get(key)
            if r is None:
                continue  # backfill doesn't cover this region-year yet
            if r.get("annual_twh") is None or twh in (None, 0):
                continue
            try:
                tso_twh = float(twh)
            except (TypeError, ValueError):
                continue
            backfill_twh = float(r["annual_twh"])
            delta_pct = (backfill_twh - tso_twh) / tso_twh * 100.0
            tier_fraction = r.get("tier_fraction") or 0.0
            rows.append({
                "region_id": region_id,
                "region_name": names.get(region_id, region_id),
                "year": year,
                "confidence_tier": r.get("confidence_tier") or "",
                "tier_fraction": round(float(tier_fraction), 4),
                "backfill_twh": round(backfill_twh, 4),
                "backfill_low_twh": round(float(r.get("uncertainty_low_twh") or 0.0), 4),
                "backfill_high_twh": round(float(r.get("uncertainty_high_twh") or 0.0), 4),
                "tso_anchor_twh": round(tso_twh, 4),
                "delta_pct": round(delta_pct, 2),
                "anchor_source": (anchor.get("tso_annual_latest") or "")[:200],
            })
    return rows


def write_csv(out: Path, rows: list[dict]) -> None:
    fieldnames = [
        "region_id", "region_name", "year",
        "confidence_tier", "tier_fraction",
        "backfill_twh", "backfill_low_twh", "backfill_high_twh",
        "tso_anchor_twh", "delta_pct",
        "anchor_source",
    ]
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in rows:
            w.writerow(r)


def summarise(rows: list[dict]) -> None:
    if not rows:
        print("no validation pairs emitted — are rollup + anchors both populated?",
              file=sys.stderr)
        return
    print(f"wrote {len(rows)} (region, year) validation pairs",
          file=sys.stderr)
    abs_deltas = sorted(abs(r["delta_pct"]) for r in rows)
    median = abs_deltas[len(abs_deltas) // 2]
    within_tier = sum(1 for r in rows
                      if abs(r["delta_pct"]) <= r["tier_fraction"] * 100)
    print(f"  median |Δ%|: {median:.1f}%", file=sys.stderr)
    print(f"  within tier envelope: {within_tier}/{len(rows)} "
          f"({100*within_tier/len(rows):.0f}%)", file=sys.stderr)
    # Worst 3 offenders
    worst = sorted(rows, key=lambda r: abs(r["delta_pct"]), reverse=True)[:3]
    print("  worst gaps:", file=sys.stderr)
    for r in worst:
        print(f"    {r['region_id']:<16s} {r['year']}  "
              f"backfill={r['backfill_twh']:.3f} TWh  "
              f"anchor={r['tso_anchor_twh']:.3f} TWh  "
              f"Δ={r['delta_pct']:+.1f}%", file=sys.stderr)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = ap.parse_args()

    if not ROLLUP_PATH.exists():
        print(f"ERROR: {ROLLUP_PATH} missing - run build_annual_rollup.py first",
              file=sys.stderr)
        return 1
    if not ANCHORS_PATH.exists():
        print(f"ERROR: {ANCHORS_PATH} missing", file=sys.stderr)
        return 1

    names = load_region_names()
    rollup = load_rollup_rows()
    anchors = load_anchors()
    rows = build_rows(rollup, anchors, names)
    write_csv(args.out, rows)
    print(f"\nfigure2 data → {args.out.relative_to(REPO_ROOT)}", file=sys.stderr)
    summarise(rows)
    return 0


if __name__ == "__main__":
    sys.exit(main())
