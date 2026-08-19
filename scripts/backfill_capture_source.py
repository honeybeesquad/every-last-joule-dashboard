#!/usr/bin/env python3
"""
One-shot backfill: add a `capture_source` column to the rolling Parquet
history file and stamp every existing row "committed-snapshot".

Run once, by hand, as part of the PR that reworks scripts/append_history.py
to read the deployed dashboard instead of the repo's committed
data/snapshots/last-good/ corpus. Every row in the file as of that cutover
was written by the old script, which read only the committed corpus — so
"committed-snapshot" is an accurate label for all of them, not a guess.

Usage:
    python3 scripts/backfill_capture_source.py
    python3 scripts/backfill_capture_source.py --file path/to/other.parquet

Idempotent: if the column already exists, the script leaves the file
untouched and exits 0 (so re-running it after the real backfill, or in CI,
is harmless).
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    import pyarrow as pa
    import pyarrow.parquet as pq
except ImportError:
    print("ERROR: pyarrow not installed. Run: pip install pyarrow", file=sys.stderr)
    sys.exit(1)

REPO_ROOT = Path(__file__).parent.parent
DEFAULT_HISTORY_FILE = REPO_ROOT / "data" / "historical" / "curtailment_history.parquet"

CAPTURE_SOURCE_COMMITTED = "committed-snapshot"


def backfill(history_file: Path) -> None:
    if not history_file.exists():
        print(f"ERROR: {history_file} does not exist.", file=sys.stderr)
        sys.exit(1)

    table = pq.read_table(history_file)

    if "capture_source" in table.schema.names:
        print(
            f"{history_file} already has a capture_source column "
            f"({table.num_rows} rows) — nothing to do."
        )
        return

    n_rows = table.num_rows
    stamped = pa.array([CAPTURE_SOURCE_COMMITTED] * n_rows, type=pa.string())
    table = table.append_column("capture_source", stamped)

    pq.write_table(table, history_file, compression="snappy")

    print(
        f"Stamped capture_source='{CAPTURE_SOURCE_COMMITTED}' on {n_rows} "
        f"existing rows in {history_file}."
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--file",
        type=Path,
        default=DEFAULT_HISTORY_FILE,
        help="Parquet file to backfill (default: data/historical/curtailment_history.parquet)",
    )
    args = parser.parse_args()
    backfill(args.file)


if __name__ == "__main__":
    main()
