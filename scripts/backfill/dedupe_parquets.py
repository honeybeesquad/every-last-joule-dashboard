#!/usr/bin/env python3
"""
One-off cleanup: dedupe (observation_timestamp, fuel) in existing backfill
parquets. Necessary because earlier `write_partition` appended on rerun,
stacking smoke-test + fan-out output. `write_partition` now overwrites by
default, but existing files already contain duplicates — this script fixes
them in place.

For each parquet under data/historical/backfill/:
  - read it
  - dedupe by (observation_timestamp, fuel) keeping first occurrence
  - write it back if any rows were dropped
  - log before/after row counts
"""
from __future__ import annotations

import sys
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
BACKFILL_DIR = REPO_ROOT / "data" / "historical" / "backfill"


def dedupe_table(t: pa.Table) -> tuple[pa.Table, int, int]:
    """Return (deduped_table, rows_before, rows_after)."""
    before = t.num_rows
    ts = t.column("observation_timestamp").to_pylist()
    fuels = t.column("fuel").to_pylist()
    seen: set[tuple[str, str]] = set()
    keep_idx: list[int] = []
    for i, key in enumerate(zip(ts, fuels)):
        if key in seen:
            continue
        seen.add(key)
        keep_idx.append(i)
    if len(keep_idx) == before:
        return t, before, before
    deduped = t.take(keep_idx)
    return deduped, before, deduped.num_rows


def main() -> int:
    if not BACKFILL_DIR.exists():
        print(f"no backfill dir: {BACKFILL_DIR}", file=sys.stderr)
        return 1
    files = sorted(BACKFILL_DIR.glob("*.parquet"))
    changed = 0
    for f in files:
        try:
            t = pq.read_table(f)
        except Exception as e:
            print(f"skip {f.name}: read error {e}", file=sys.stderr)
            continue
        deduped, before, after = dedupe_table(t)
        if after < before:
            pq.write_table(deduped, f, compression="snappy")
            changed += 1
            print(f"  {f.name:50s} {before:6d} -> {after:6d}  (-{before-after})")
        else:
            print(f"  {f.name:50s} {before:6d}  ok")
    print(f"deduped {changed} / {len(files)} files")
    return 0


if __name__ == "__main__":
    sys.exit(main())
