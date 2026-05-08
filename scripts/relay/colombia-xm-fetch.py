#!/usr/bin/env python3
"""Relay: refresh Colombia XM SinerGox VertEner CSV from a Colombian-egress runner.

The Colombia region (`src/lib/regions.ts` -> `id: "colombia"`) reads its annual
curtailment anchor from `data/historical/colombia-vertimientos-daily.csv`. The
CSV is the production source-of-truth because XM's SinerGox API is geoblocked
from non-Colombian IPs (Vercel build runners cannot reach it directly).

This script keeps the CSV current. It is intended to run on a host with a
Colombian-egress route — currently `britta.local` via the `elj-co` WireGuard
tunnel (split-tunnel: only routes traffic destined for AllowedIPs
179.1.0.0/16, 190.90.0.0/16, 191.97.0.0/16 — the Colombian ISP ranges that
serve `servapibi.xm.com.co`).

Usage:
    python3 scripts/relay/colombia-xm-fetch.py [--days 90] [--dry-run]

Behaviour:
    1. Fetches the last `--days` of `VertEner` (Vertimientos Energía / hydro
       spill) for the `Sistema` entity from the XM SinerGox /daily endpoint,
       in 30-day chunks (the API rejects larger windows with HTTP 400).
    2. Converts the raw kWh values to GWh (/1e6).
    3. Reads the existing CSV at the canonical path.
    4. Appends only rows whose date is not already present; never rewrites
       existing rows. Idempotent across runs.
    5. Exits 0 on success (even if zero new rows). Non-zero on fetch / parse
       failure or if the CSV header is malformed.

The script does not commit to git; the caller is expected to handle that
(either a manual `git add && commit && push` or a wrapper LaunchAgent script
on Britta).
"""

from __future__ import annotations

import argparse
import datetime
import json
import os
import sys
import urllib.request
import urllib.error

XM_API_URL = "https://servapibi.xm.com.co/daily"
METRIC_ID = "VertEner"  # Vertimientos Energía (energy spillage / hydro spill)
ENTITY_ID = "Sistema"   # National-system aggregate
CHUNK_DAYS = 30         # XM /daily rejects >30-day windows with HTTP 400

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CSV_PATH = os.path.join(REPO_ROOT, "data", "historical", "colombia-vertimientos-daily.csv")


def fetch_chunk(start: datetime.date, end: datetime.date) -> list[dict]:
    """POST one (start, end) range to XM and return Items[]."""
    body = json.dumps({
        "MetricId": METRIC_ID,
        "Entity": ENTITY_ID,
        "StartDate": start.isoformat(),
        "EndDate": end.isoformat(),
    }).encode("utf-8")
    req = urllib.request.Request(
        XM_API_URL,
        data=body,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=25) as resp:
        return json.loads(resp.read().decode("utf-8")).get("Items", [])


def kwh_to_gwh(value: str | float | int) -> float:
    """XM publishes Value as a kWh string. Convert to GWh."""
    return float(value) / 1_000_000.0


def fetch_range(days: int) -> dict[str, float]:
    """Fetch the last `days` days in 30-day chunks. Returns {date: gwh}."""
    end = datetime.datetime.utcnow().date()
    out: dict[str, float] = {}
    for offset in range(0, days, CHUNK_DAYS):
        chunk_end = end - datetime.timedelta(days=offset)
        chunk_start = chunk_end - datetime.timedelta(days=CHUNK_DAYS)
        try:
            items = fetch_chunk(chunk_start, chunk_end)
        except urllib.error.HTTPError as e:
            print(f"# chunk {chunk_start} -> {chunk_end} HTTP {e.code}: {e.reason}", file=sys.stderr)
            continue
        except Exception as e:
            print(f"# chunk {chunk_start} -> {chunk_end} failed: {e}", file=sys.stderr)
            continue
        for item in items:
            date = (item.get("Date") or "")[:10]
            if not date or date in out:
                continue
            entities = item.get("DailyEntities") or []
            sistema = next((e for e in entities if e.get("Id") == ENTITY_ID), None)
            if not sistema:
                continue
            try:
                out[date] = kwh_to_gwh(sistema.get("Value", "0"))
            except (TypeError, ValueError):
                continue
    return out


def read_existing_dates(csv_path: str) -> set[str]:
    """Read existing CSV; return the set of dates already present."""
    if not os.path.exists(csv_path):
        return set()
    dates: set[str] = set()
    with open(csv_path, encoding="utf-8") as f:
        header = next(f, "").strip()
        if not header.startswith("date,gwh,"):
            raise ValueError(f"unexpected CSV header: {header!r}")
        for line in f:
            d = line.split(",", 1)[0].strip()
            if d:
                dates.add(d)
    return dates


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--days", type=int, default=90,
                        help="how many days back to fetch (default: 90)")
    parser.add_argument("--dry-run", action="store_true",
                        help="report what would be appended; do not modify the CSV")
    args = parser.parse_args()

    print(f"# fetching last {args.days} days of XM VertEner Sistema...", file=sys.stderr)
    fresh = fetch_range(args.days)
    if not fresh:
        print("# no rows fetched (network failure or empty response)", file=sys.stderr)
        return 1

    existing = read_existing_dates(CSV_PATH)
    fetched_at = datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
    new_rows = [
        f"{date},{gwh:.4f},{fetched_at},xm-relay-via-britta"
        for date, gwh in sorted(fresh.items())
        if date not in existing
    ]

    print(f"# fetched {len(fresh)} day-rows from XM; {len(new_rows)} are new", file=sys.stderr)
    if not new_rows:
        print("# CSV already current; nothing to append.", file=sys.stderr)
        return 0

    if args.dry_run:
        print("# --dry-run: would append the following rows:", file=sys.stderr)
        for r in new_rows:
            print(r)
        return 0

    with open(CSV_PATH, "a", encoding="utf-8") as f:
        for r in new_rows:
            f.write(r + "\n")
    print(f"# appended {len(new_rows)} rows to {CSV_PATH}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
