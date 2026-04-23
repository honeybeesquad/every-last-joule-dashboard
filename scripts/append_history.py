#!/usr/bin/env python3
"""
Append the current committed snapshots to the rolling Parquet history file.

Called by .github/workflows/history-append.yml after each successful data refresh.
Reads every data/snapshots/last-good/*.json file and appends one row per region
to data/historical/curtailment_history.parquet.

Schema
------
build_timestamp  str     ISO-8601 UTC of this run (sortable)
region_id        str     matches RegionData.regionId
peak_gw          float32 current 30-day peak GW
total_twh_30d    float32 current 30-day curtailment TWh
source_status    str     "live" | "cached" | null
last_updated     str     calibration date (YYYY, YYYY-Q#, or ISO)
profile_h00..h23 float32 24 hourly average GW values (UTC)
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    import pyarrow as pa
    import pyarrow.parquet as pq
except ImportError:
    print("ERROR: pyarrow not installed. Run: pip install pyarrow", file=sys.stderr)
    sys.exit(1)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
REPO_ROOT = Path(__file__).parent.parent
SNAPSHOTS_DIR = REPO_ROOT / "data" / "snapshots" / "last-good"
HISTORY_FILE = REPO_ROOT / "data" / "historical" / "curtailment_history.parquet"

# Non-region snapshots to skip
SKIP_IDS = {"cbeci", "anchor"}

# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------
HOUR_FIELDS = [pa.field(f"profile_h{h:02d}", pa.float32()) for h in range(24)]
SCHEMA = pa.schema([
    pa.field("build_timestamp", pa.string()),
    pa.field("region_id",       pa.string()),
    pa.field("peak_gw",         pa.float32()),
    pa.field("total_twh_30d",   pa.float32()),
    pa.field("source_status",   pa.string()),
    pa.field("last_updated",    pa.string()),
] + HOUR_FIELDS)


def build_rows(now: datetime) -> list[dict]:
    rows: list[dict] = []
    ts = now.strftime("%Y-%m-%dT%H:%M:%SZ")

    for snap_path in sorted(SNAPSHOTS_DIR.glob("*.json")):
        region_id = snap_path.stem

        if region_id in SKIP_IDS:
            continue

        try:
            data: dict = json.loads(snap_path.read_text())
        except Exception as exc:
            print(f"  skip {region_id}: {exc}", file=sys.stderr)
            continue

        profile: list = data.get("profile") or []
        if len(profile) != 24:
            # Multi-region loaders (e.g. entsoe.json) emit a dict of regions.
            if isinstance(data, dict) and not data.get("profile"):
                for sub_id, sub_data in data.items():
                    if isinstance(sub_data, dict) and len(sub_data.get("profile", [])) == 24:
                        rows.append(_make_row(ts, sub_data.get("regionId", sub_id), sub_data))
            continue

        rows.append(_make_row(ts, data.get("regionId", region_id), data))

    return rows


def _make_row(ts: str, region_id: str, data: dict) -> dict:
    profile: list = data.get("profile", [])
    row: dict = {
        "build_timestamp": ts,
        "region_id":       str(region_id),
        "peak_gw":         float(data.get("peakGW") or 0),
        "total_twh_30d":   float(data.get("totalTWh") or 0),
        "source_status":   str(data.get("sourceStatus") or ""),
        "last_updated":    str(data.get("lastUpdated") or ""),
    }
    for h in range(24):
        row[f"profile_h{h:02d}"] = float(profile[h]) if h < len(profile) else 0.0
    return row


def main() -> None:
    now = datetime.now(timezone.utc).replace(microsecond=0)
    print(f"Building snapshot rows for {now.isoformat()} …")

    rows = build_rows(now)
    if not rows:
        print("No valid snapshot rows found — skipping.", file=sys.stderr)
        sys.exit(0)

    new_table = pa.Table.from_pylist(rows, schema=SCHEMA)

    HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)

    if HISTORY_FILE.exists():
        existing = pq.read_table(HISTORY_FILE, schema=SCHEMA)
        combined = pa.concat_tables([existing, new_table])
    else:
        combined = new_table

    pq.write_table(combined, HISTORY_FILE, compression="snappy")

    n_new = len(new_table)
    n_total = len(combined)
    unique_builds = combined.column("build_timestamp").unique().to_pylist()
    print(
        f"Appended {n_new} region rows at {now.isoformat()}.\n"
        f"Total rows: {n_total} across {len(unique_builds)} build snapshots."
    )


if __name__ == "__main__":
    main()
