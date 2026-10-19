#!/usr/bin/env python3
"""
Bootstrap / repair India CEA gen-re daily generation CSVs.

Fetches daily Excel reports from gen-re.cea.gov.in and writes:
  data/historical/india-<state>-gen-daily.csv  (date,wind_gwh,solar_gwh)

Covers the 17 named dashboard states plus india-east (Bihar + West Bengal +
Jharkhand + Sikkim) and india-rest (remaining CEA State-Wise rows).
Header-aware: Wind then Solar columns, reject Excel serial dates and other
implausible daily GWh values.

Usage:
  python3 scripts/bootstrap-india-gen-re.py
  python3 scripts/bootstrap-india-gen-re.py --start 2025-05-09 --end 2026-10-15
"""

from __future__ import annotations

import argparse
import csv
import os
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, timedelta

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(REPO_ROOT, "scripts", "lib"))

from india_cea_excel import (  # noqa: E402
    MAX_DAILY_GWH,
    STATE_LABELS,
    is_plausible_daily_gwh,
    parse_xlsx_bytes,
)

DATA_DIR = os.path.join(REPO_ROOT, "data", "historical")
CEA_BASE = "https://gen-re.cea.gov.in/public/uploads/dailyReport/excel"
CSV_KEYS = tuple(list(STATE_LABELS.keys()) + ["east", "rest"])
USER_AGENT = "EveryLastJoule/1.0 (research; gen-re backfill)"
DEFAULT_START = date(2025, 5, 9)


def csv_path(key: str) -> str:
    return os.path.join(DATA_DIR, f"india-{key}-gen-daily.csv")


def load_existing(path: str) -> dict[str, tuple[float, float]]:
    if not os.path.exists(path):
        return {}
    out: dict[str, tuple[float, float]] = {}
    with open(path, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            ds = (row.get("date") or "").strip()
            try:
                wind = float(row.get("wind_gwh") or 0)
                solar = float(row.get("solar_gwh") or 0)
            except ValueError:
                continue
            if not ds:
                continue
            if not is_plausible_daily_gwh(wind) or not is_plausible_daily_gwh(solar):
                continue
            out[ds] = (wind, solar)
    return out


def write_csv(path: str, rows: dict[str, tuple[float, float]]) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", newline="") as f:
        f.write("date,wind_gwh,solar_gwh\n")
        for ds in sorted(rows):
            wind, solar = rows[ds]
            f.write(f"{ds},{wind:.3f},{solar:.3f}\n")
    os.replace(tmp, path)


def fetch_excel(report_date: date, timeout: int = 25) -> bytes | None:
    url = f"{CEA_BASE}/Report-{report_date.isoformat()}.xlsx"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            if resp.status == 200:
                return resp.read()
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        print(f"  HTTP {e.code} for {report_date}", file=sys.stderr)
    except Exception as e:
        print(f"  Error fetching {report_date}: {e}", file=sys.stderr)
    return None


def daterange(start: date, end: date):
    d = start
    while d <= end:
        yield d
        d += timedelta(days=1)


def parse_args() -> argparse.Namespace:
    today = date.today()
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--start", type=date.fromisoformat, default=DEFAULT_START)
    p.add_argument("--end", type=date.fromisoformat, default=today)
    p.add_argument("--workers", type=int, default=6)
    p.add_argument(
        "--force-refetch",
        action="store_true",
        help="Re-fetch dates even when every CSV already has a plausible row.",
    )
    return p.parse_args()


def main() -> int:
    args = parse_args()
    if args.end < args.start:
        print("end must be on or after start", file=sys.stderr)
        return 2

    existing: dict[str, dict[str, tuple[float, float]]] = {
        key: load_existing(csv_path(key)) for key in CSV_KEYS
    }

    missing: list[date] = []
    for d in daterange(args.start, args.end):
        ds = d.isoformat()
        if args.force_refetch or any(ds not in existing[key] for key in CSV_KEYS):
            missing.append(d)

    print(
        f"CEA gen-re backfill {args.start} → {args.end}: "
        f"{len(missing)} dates to fetch, cap={MAX_DAILY_GWH:g} GWh/day, "
        f"workers={args.workers}"
    )

    fetched = no_report = errors = 0
    if missing:
        with ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
            futs = {pool.submit(fetch_excel, d): d for d in missing}
            for fut in as_completed(futs):
                d = futs[fut]
                ds = d.isoformat()
                try:
                    blob = fut.result()
                except Exception as e:
                    errors += 1
                    print(f"  {ds}: worker error — {e}", file=sys.stderr)
                    continue
                if blob is None:
                    no_report += 1
                    continue
                try:
                    state_data = parse_xlsx_bytes(blob)
                except Exception as e:
                    errors += 1
                    print(f"  {ds}: parse error — {e}", file=sys.stderr)
                    continue
                if len(state_data) < 3:
                    errors += 1
                    print(f"  {ds}: no state data found", file=sys.stderr)
                    continue
                fetched += 1
                for key, vals in state_data.items():
                    if key not in existing:
                        continue
                    existing[key][ds] = (vals["wind_gwh"], vals["solar_gwh"])
                print(f"  {ds}: {sorted(state_data)} ({len(state_data)} rows)")
                time.sleep(0.05)

    for key in CSV_KEYS:
        write_csv(csv_path(key), existing[key])
        print(f"  {key}: {len(existing[key])} rows → {csv_path(key)}")

    print(f"\nDone. fetched={fetched} no_report={no_report} errors={errors}")
    return 0 if errors == 0 or fetched > 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
