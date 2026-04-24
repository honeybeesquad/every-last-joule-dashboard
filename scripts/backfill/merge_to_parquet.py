#!/usr/bin/env python3
"""
Consolidate year-partitioned per-source backfill Parquet files into a single
`data/historical/curtailment_backfill.parquet` archive.

Run at the end of HB.5 (and ad-hoc while agents are still producing partitions,
to check progress). Idempotent: running it again just rebuilds the archive
from the current partition set.

Usage:
  python scripts/backfill/merge_to_parquet.py [--out PATH]
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
PARTITION_DIR = REPO_ROOT / "data" / "historical" / "backfill"
DEFAULT_OUT = REPO_ROOT / "data" / "historical" / "curtailment_backfill.parquet"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT,
                    help=f"Output Parquet path (default: {DEFAULT_OUT.relative_to(REPO_ROOT)})")
    ap.add_argument("--pattern", default="*.parquet",
                    help="Glob pattern inside partition dir (default: *.parquet)")
    args = ap.parse_args()

    parts = sorted(PARTITION_DIR.glob(args.pattern))
    if not parts:
        print(f"no partitions found in {PARTITION_DIR}", file=sys.stderr)
        return 1

    tables = []
    total_rows = 0
    for p in parts:
        t = pq.read_table(p)
        tables.append(t)
        total_rows += t.num_rows
        print(f"  {p.name}: {t.num_rows:,} rows")

    merged = pa.concat_tables(tables, promote_options="default")
    # Stable sort so diffs across rebuilds are minimal
    merged = merged.sort_by([
        ("region_id", "ascending"),
        ("observation_timestamp", "ascending"),
    ])

    args.out.parent.mkdir(parents=True, exist_ok=True)
    pq.write_table(merged, args.out, compression="snappy")
    size_mb = args.out.stat().st_size / (1024 * 1024)
    print(f"\nmerged {len(parts)} partitions → {args.out.relative_to(REPO_ROOT)}")
    print(f"  rows: {total_rows:,}  size: {size_mb:.1f} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
