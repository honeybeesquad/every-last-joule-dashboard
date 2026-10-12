#!/usr/bin/env python3
"""
Find regions that normally update but have had no fresh reading for more
than 24 hours. Called by .github/workflows/health-check.yml.

Why this exists
---------------
From 29 Sep to 12 Oct 2026 the ENTSO-E loader overran its 180 s deadline on
six builds. Each time, `withFallback` served the 17 June snapshot whole: the
54 zones in it went out as June data marked `degraded`, and the 18 zones it
lacks (Austria, Latvia, Lithuania, SE1, SE2, Bosnia, Montenegro, Kosovo,
Malta, Albania) were missing from the build. The health check's freshness
count lumps those in with ~100 regions that are `cached` by design and so
sits above its threshold almost all the time, and it never compares the
build against the roster, so a region that disappears is not counted at all.

The rule
--------
A reading is **fresh** when its record is not `degraded` and carries a
parseable `lastSuccessAt`; that timestamp is when the reading was taken.
`degraded` already means "serving a last-good record older than its
freshness window", so its `lastSuccessAt` is old news and is ignored.

A region **updates** if it had a fresh reading taken within LOOKBACK, in the
current build or in any build in data/historical/curtailment_history.parquet.
Static anchors (an annual figure stamped `2026-06-01`) never qualify, so
they can't trip the alert.

A region updates and is **silent** when its newest fresh reading is older
than SILENT_AFTER (24 h), whether it is still in the build as `degraded` or
gone from the build altogether. A region silent for longer than LOOKBACK
stops qualifying as updating and drops out of the alert; that is the
trade-off for not flagging static anchors, and 30 days is long enough that
nobody should still be finding out from this check.

Only ids on the roster (src/lib/regions.ts) are judged. Roster ids absent
from the current build are listed separately for information.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SILENT_AFTER = timedelta(hours=24)
LOOKBACK = timedelta(days=30)


def _load_append_history():
    spec = importlib.util.spec_from_file_location(
        "append_history", REPO_ROOT / "scripts" / "append_history.py"
    )
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules["append_history"] = module
    spec.loader.exec_module(module)
    return module


def parse_ts(value: object) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        ts = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return ts


def fresh_reading_at(status: object, last_success_at: object) -> datetime | None:
    """When a record's reading was taken, or None if the record is not fresh."""
    if status == "degraded":
        return None
    return parse_ts(last_success_at)


@dataclass(frozen=True)
class SilentRegion:
    region_id: str
    last_fresh: datetime
    in_build: bool
    status: str | None


@dataclass(frozen=True)
class Report:
    silent: list[SilentRegion]
    absent: list[str]
    checked: int


def find_silent(
    roster: set[str],
    current: dict[str, dict],
    history_rows: list[tuple[str, str, object, object]],
    now: datetime,
) -> Report:
    """Judge every roster id.

    current: region_id -> deployed record (sourceStatus, lastSuccessAt).
    history_rows: (build_timestamp, region_id, source_status, last_success_at).
    """
    since = now - LOOKBACK
    newest: dict[str, datetime] = {}

    def see(region_id: str, ts: datetime | None) -> None:
        # A reading stamped in the future is clock skew, not freshness.
        if ts is None or ts > now + timedelta(minutes=5):
            return
        if region_id not in newest or ts > newest[region_id]:
            newest[region_id] = ts

    for build_ts, region_id, status, last_success_at in history_rows:
        built = parse_ts(build_ts)
        if built is None or built < since:
            continue
        see(region_id, fresh_reading_at(status, last_success_at))

    for region_id, record in current.items():
        see(region_id, fresh_reading_at(record.get("sourceStatus"), record.get("lastSuccessAt")))

    silent = []
    for region_id in sorted(roster):
        last = newest.get(region_id)
        if last is None or last < since:
            continue  # never updates (static anchor), or silent beyond LOOKBACK
        if now - last > SILENT_AFTER:
            record = current.get(region_id)
            silent.append(
                SilentRegion(
                    region_id=region_id,
                    last_fresh=last,
                    in_build=record is not None,
                    status=(record or {}).get("sourceStatus"),
                )
            )

    absent = sorted(roster - current.keys())
    return Report(silent=silent, absent=absent, checked=len(roster))


def format_silent(item: SilentRegion, now: datetime) -> str:
    hours = int((now - item.last_fresh).total_seconds() // 3600)
    where = (
        f"in the build as `{item.status or 'live'}`" if item.in_build else "missing from the build"
    )
    stamp = item.last_fresh.strftime("%Y-%m-%d %H:%MZ")
    return f"- {item.region_id}: last fresh reading {stamp} ({hours} h ago), {where}"


def read_history(path: Path) -> list[tuple[str, str, object, object]]:
    import pyarrow.parquet as pq

    table = pq.read_table(
        path, columns=["build_timestamp", "region_id", "source_status", "last_success_at"]
    )
    cols = table.to_pydict()
    return list(
        zip(
            cols["build_timestamp"],
            cols["region_id"],
            cols["source_status"],
            cols["last_success_at"],
        )
    )


def _write_output(name: str, value: str) -> None:
    out = os.environ.get("GITHUB_OUTPUT")
    if not out:
        return
    with open(out, "a", encoding="utf-8") as fh:
        if "\n" in value:
            fh.write(f"{name}<<EOF\n{value}\nEOF\n")
        else:
            fh.write(f"{name}={value}\n")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--base-url", default=None)
    parser.add_argument("--history", default=None)
    args = parser.parse_args(argv)

    ah = _load_append_history()
    base_url = args.base_url or ah.DEFAULT_DASHBOARD_URL
    history_path = Path(args.history) if args.history else ah.HISTORY_FILE

    roster = set(ah._load_regions_manifest())
    if not roster:
        print("::error::could not read the region roster from src/lib/regions.ts")
        return 1
    _, records = ah.fetch_deployed_regions(base_url)
    current = {region_id: record for region_id, record in records}
    history = read_history(history_path) if history_path.exists() else []

    now = datetime.now(timezone.utc)
    report = find_silent(roster, current, history, now)

    silent_lines = "\n".join(format_silent(s, now) for s in report.silent)
    _write_output("silent", str(len(report.silent)))
    _write_output("silent_list", silent_lines or "(none)")
    _write_output("absent", str(len(report.absent)))
    _write_output("absent_list", ", ".join(report.absent) or "(none)")
    _write_output("roster", str(report.checked))

    print(
        f"::notice::{len(report.silent)} of {report.checked} roster regions silent for more than "
        f"{int(SILENT_AFTER.total_seconds() // 3600)} h; {len(report.absent)} absent from the build"
    )
    if silent_lines:
        print(silent_lines)
    print(json.dumps({"absent": report.absent}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
