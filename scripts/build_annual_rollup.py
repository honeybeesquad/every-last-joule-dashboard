#!/usr/bin/env python3
"""
Build `data/historical/per_region_annual.parquet` — a per-region, per-year
summary derived from the hourly backfill partitions under
`data/historical/backfill/`.

Purpose
-------
The hourly archive (`curtailment_backfill.parquet`) is the raw dataset.
This annual rollup is the analysis-ready view:

  - one row per (region_id, year)
  - annual TWh, peak GW, year-over-year hourly-row count
  - confidence tier per region (T1a/T1b/T1c/T2/T3) derived from the regions.ts
    manifest — see `src/lib/uncertainty.ts::deriveTier`
  - symmetric uncertainty envelope on the peak GW, applied at the tier's
    default fraction (T1a ±15%, T1b ±50%, T1c ±35.5%, T2 ±20%, T3 ±40%).
    Once the HB backfill is
    stable across ≥3 years, the T1 envelope should be replaced by 2σ of
    observed annual peakGW (TODO when backfill stabilises).
  - same envelope fraction applied to annual TWh so downstream consumers
    can quote a calibrated total

This is the primary input for Figure 2 (validation scatter) and Figure 4
(tier coverage) of the Scientific Data descriptor paper, and it is the
smallest parquet we ship to Zenodo that carries the uncertainty claim.

Schema
------
region_id            str
year                 int16
source               str       "eia" | "entsoe" | ... (first non-null)
n_hourly_rows        int32     non-null hours in the partition for this year
annual_twh           float32   ∑ curtailment_gw × 1h / 1000
peak_gw              float32   max hourly curtailment_gw across the year
confidence_tier      str       "T1a-live-tso" | "T1b-live-domestic-anchored" |
                                "T1c-live-neighbour-anchored" |
                                "T2-annual-calibrated" | "T3-modelled"
uncertainty_low_gw   float32   peak_gw × (1 - tier_fraction), clamped to ≥ 0
uncertainty_high_gw  float32   peak_gw × (1 + tier_fraction)
uncertainty_low_twh  float32   annual_twh × (1 - tier_fraction), clamped to ≥ 0
uncertainty_high_twh float32   annual_twh × (1 + tier_fraction)
tier_fraction        float32   fractional half-width applied

Run
---
  python3 scripts/build_annual_rollup.py
  python3 scripts/build_annual_rollup.py --out custom/path.parquet

Re-run is safe (idempotent) and cheap (seconds on the full 2020–2026 set).
"""

from __future__ import annotations

import argparse
import re
import sys
from collections import defaultdict
from pathlib import Path

import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.parquet as pq

REPO_ROOT = Path(__file__).resolve().parent.parent
BACKFILL_DIR = REPO_ROOT / "data" / "historical" / "backfill"
DEFAULT_OUT = REPO_ROOT / "data" / "historical" / "per_region_annual.parquet"

REGIONS_TS = REPO_ROOT / "src" / "lib" / "regions.ts"
_REGION_ROW_RE = re.compile(
    r'id:\s*"(?P<id>[a-z0-9-]+)".*?tier:\s*"(?P<tier>live|live-domestic-anchored|live-neighbour-anchored|anchored|estimated)"',
    re.DOTALL,
)

# Mirror of src/lib/uncertainty.ts::TIER_DEFAULT_FRACTION — the TS source is
# authoritative; update both in lockstep or you break the paper's internal
# consistency claim.
TIER_DEFAULT_FRACTION: dict[str, float] = {
    "T1-live-TSO":          0.15,
    "T1a-live-tso":         0.15,
    "T1b-live-domestic-anchored": 0.50,
    "T1c-live-neighbour-anchored": 0.355,
    "T2-annual-calibrated": 0.20,
    "T3-modelled":          0.40,
    "T4-structural-gap":    0.00,
}

REGION_TIER_TO_CONFIDENCE_TIER: dict[str, str] = {
    "live": "T1a-live-tso",
    "live-domestic-anchored": "T1b-live-domestic-anchored",
    "live-neighbour-anchored": "T1c-live-neighbour-anchored",
    "anchored": "T2-annual-calibrated",
    "estimated": "T3-modelled",
}

# Whole-ISO aggregate region ids that exist in the backfill archive but
# not in `src/lib/regions.ts`. The dashboard ships split sub-regions
# (e.g. `nyiso-zones-d-e` + `nyiso-rest`) because that is the right
# granularity for the globe; the backfill stays at the EIA feed's
# natural whole-ISO unit because that matches the published TSO annual
# anchors used for paper validation. Treat these as T1a-live-tso — the
# backfill rows come from the same live EIA hourly feed as the split
# dashboard regions.
BACKFILL_AGGREGATE_TIERS: dict[str, str] = {
    "nyiso":  "T1a-live-tso",
    "iso-ne": "T1a-live-tso",
}


def load_regions_manifest() -> dict[str, str]:
    """Parse regions.ts -> {region_id: RegionTier}."""
    text = REGIONS_TS.read_text()
    out: dict[str, str] = {}
    for m in _REGION_ROW_RE.finditer(text):
        out[m.group("id")] = m.group("tier")
    return out


def derive_tier(region_id: str, region_tier: str | None) -> str | None:
    """Same rules as src/lib/uncertainty.ts::deriveTier, plus a hard-coded
    override for whole-ISO backfill aggregates that the dashboard ships
    as split sub-regions (see BACKFILL_AGGREGATE_TIERS)."""
    if region_tier in REGION_TIER_TO_CONFIDENCE_TIER:
        return REGION_TIER_TO_CONFIDENCE_TIER[region_tier]
    # Not in regions.ts — check the whole-ISO aggregate override.
    if region_id in BACKFILL_AGGREGATE_TIERS:
        return BACKFILL_AGGREGATE_TIERS[region_id]
    return None


def extract_year(partition_name: str) -> int | None:
    m = re.search(r"_(\d{4})\.parquet$", partition_name)
    return int(m.group(1)) if m else None


def aggregate_partitions(parts: list[Path]) -> list[dict]:
    """Load every partition, sum hourly curtailment to annual TWh, track peak GW.

    Partitions key on (source, region_id, year). Fuel breakdown collapses —
    annual_twh and peak_gw are totals across all fuels because the paper's
    validation claim is about total curtailment, not a fuel-resolved one.
    """
    agg: dict[tuple[str, int], dict] = {}
    for p in parts:
        year = extract_year(p.name)
        if year is None:
            continue
        try:
            t = pq.read_table(p, columns=["region_id", "curtailment_gw", "source"])
        except Exception as exc:
            print(f"  skip {p.name}: {exc}", file=sys.stderr)
            continue
        if t.num_rows == 0:
            continue

        region_ids = t.column("region_id").to_pylist()
        curtailment = t.column("curtailment_gw").to_pylist()
        sources = t.column("source").to_pylist()

        # First pass: per-(region, hour-timestamp) are already unique in the
        # deduped partitions for single-fuel sources; for multi-fuel ENTSO-E
        # partitions we have one row per (timestamp, fuel), so curtailment_gw
        # sums correctly across rows of the same timestamp. Annual TWh is
        # ∑ curtailment_gw × 1h / 1000; peak GW is max across all rows (which
        # means peak of ANY single fuel in an hour, which is the published
        # interpretation — see paper methodology §peak).
        region_peak: dict[str, float] = defaultdict(float)
        region_sum_gw: dict[str, float] = defaultdict(float)
        region_rows: dict[str, int] = defaultdict(int)
        region_source: dict[str, str] = {}

        for rid, gw, src in zip(region_ids, curtailment, sources):
            if gw is None or gw < 0:
                continue
            gw = float(gw)
            if gw > region_peak[rid]:
                region_peak[rid] = gw
            region_sum_gw[rid] += gw
            region_rows[rid] += 1
            if rid not in region_source and src:
                region_source[rid] = str(src)

        for rid, peak in region_peak.items():
            key = (rid, year)
            entry = agg.setdefault(
                key,
                {
                    "region_id": rid,
                    "year": year,
                    "source": region_source.get(rid, ""),
                    "n_hourly_rows": 0,
                    "annual_gw_hours": 0.0,
                    "peak_gw": 0.0,
                },
            )
            entry["n_hourly_rows"] += region_rows[rid]
            entry["annual_gw_hours"] += region_sum_gw[rid]
            if peak > entry["peak_gw"]:
                entry["peak_gw"] = peak

    # Finalise: gw·h → TWh
    out = []
    for entry in agg.values():
        annual_twh = entry.pop("annual_gw_hours") / 1000.0
        entry["annual_twh"] = annual_twh
        out.append(entry)
    return out


def apply_uncertainty(rows: list[dict], manifest: dict[str, str]) -> list[dict]:
    for row in rows:
        rid = row["region_id"]
        region_tier = manifest.get(rid)
        tier = derive_tier(rid, region_tier)
        if tier is None:
            # Zones that appear in backfill but not regions.ts (e.g. pre-split
            # ENTSO-E bundle IDs). Preserve peak/annual but emit null tier.
            row["confidence_tier"] = None
            row["uncertainty_low_gw"] = None
            row["uncertainty_high_gw"] = None
            row["uncertainty_low_twh"] = None
            row["uncertainty_high_twh"] = None
            row["tier_fraction"] = None
            continue
        frac = TIER_DEFAULT_FRACTION[tier]
        peak = row["peak_gw"]
        twh = row["annual_twh"]
        row["confidence_tier"] = tier
        row["tier_fraction"] = float(frac)
        row["uncertainty_low_gw"] = max(0.0, peak * (1.0 - frac))
        row["uncertainty_high_gw"] = peak * (1.0 + frac)
        row["uncertainty_low_twh"] = max(0.0, twh * (1.0 - frac))
        row["uncertainty_high_twh"] = twh * (1.0 + frac)
    return rows


SCHEMA = pa.schema([
    pa.field("region_id",            pa.string()),
    pa.field("year",                 pa.int16()),
    pa.field("source",               pa.string()),
    pa.field("n_hourly_rows",        pa.int32()),
    pa.field("annual_twh",           pa.float32()),
    pa.field("peak_gw",              pa.float32()),
    pa.field("confidence_tier",      pa.string()),
    pa.field("tier_fraction",        pa.float32()),
    pa.field("uncertainty_low_gw",   pa.float32()),
    pa.field("uncertainty_high_gw",  pa.float32()),
    pa.field("uncertainty_low_twh",  pa.float32()),
    pa.field("uncertainty_high_twh", pa.float32()),
])


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    ap.add_argument("--pattern", default="*.parquet")
    args = ap.parse_args()

    parts = sorted(BACKFILL_DIR.glob(args.pattern))
    if not parts:
        print(f"no partitions under {BACKFILL_DIR}", file=sys.stderr)
        return 1
    print(f"aggregating {len(parts)} partitions ...")

    rows = aggregate_partitions(parts)
    manifest = load_regions_manifest()
    rows = apply_uncertainty(rows, manifest)

    # Stable sort — diffs across rebuilds are minimal
    rows.sort(key=lambda r: (r["region_id"], r["year"]))

    # Re-shape dict → schema order
    ordered = []
    for r in rows:
        ordered.append({f.name: r.get(f.name) for f in SCHEMA})

    table = pa.Table.from_pylist(ordered, schema=SCHEMA)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    pq.write_table(table, args.out, compression="snappy")

    size_kb = args.out.stat().st_size / 1024
    n_tiered = int(pc.sum(pc.is_valid(table.column("confidence_tier"))).as_py())
    n_null_tier = table.num_rows - n_tiered
    print(f"\nrollup → {args.out.relative_to(REPO_ROOT)}")
    print(f"  rows: {table.num_rows}  size: {size_kb:.1f} KB")
    print(f"  tiers assigned: {n_tiered}  null-tier (manifest miss): {n_null_tier}")
    by_tier: dict[str, int] = defaultdict(int)
    for t in table.column("confidence_tier").to_pylist():
        by_tier[t or "(none)"] += 1
    for k, v in sorted(by_tier.items()):
        print(f"    {k}: {v}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
