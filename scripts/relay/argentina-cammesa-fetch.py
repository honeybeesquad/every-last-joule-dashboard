#!/usr/bin/env python3
"""
Argentina CAMMESA relay — fetch live wind/solar generation data from the CAMMESA
renewables endpoint through an Argentine NordVPN exit node, saving as a committed CSV.

The Argentina loader (src/data/argentina.json.ts) currently probes this endpoint
at build time from Vercel (which is geo-blocked — non-AR IPs timeout). This relay
provides a committed CSV fallback that the loader reads when its live fetch fails,
following the same pattern as the Colombia/Peru relays.

Usage:
    python3 scripts/relay/argentina-cammesa-fetch.py [--days 90] [--dry-run]

Requires: NordVPN CLI installed and logged in with an Argentine exit available.
Intended to run on `abed.local` via scripts/relay/argentina-cammesa-push.sh, which
passes --csv-out into the relay repo clone (see docs/ops/abed-capture-service.md).
"""
from __future__ import annotations

import argparse
import csv
import datetime
import json
import os
import subprocess
import sys
import ssl
import urllib.request

# ─── Paths ────────────────────────────────────────────────────────────────

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CANONICAL_CSV = os.path.join(REPO_ROOT, "data", "historical", "argentina-cammesa.csv")

# CAMMESA API — returns JSON array of { momento, eolica, fotovoltaica, ... }
CAMMESA_URL = "https://cdsrenovables.cammesa.com/exhisto/RenovablesService/GetChartTotalTRDataSource/"

# ─── NordVPN helpers ──────────────────────────────────────────────────────
#
# On abed the relay user is in the `nordvpn` group, so the CLI needs no sudo.
# A sudo password (SUDO_PASSWORD) is used only as a fallback when a plain call
# fails, so a missing password no longer stops the script at import time.


def _nordvpn(*args: str, timeout: int = 90) -> subprocess.CompletedProcess:
    result = subprocess.run(["nordvpn", *args], capture_output=True, timeout=timeout, check=False)
    pw = os.environ.get("SUDO_PASSWORD")
    if result.returncode != 0 and pw:
        result = subprocess.run(
            ["sudo", "-S", "nordvpn", *args],
            input=pw.encode() + b"\n", capture_output=True, timeout=timeout, check=False,
        )
    return result


def nordvpn_connect_argentina() -> None:
    """Connect to an Argentine NordVPN server."""
    print("[relay] Connecting to Argentina via NordVPN...")
    _nordvpn("disconnect", timeout=30)
    result = _nordvpn("connect", "Argentina")
    if result.returncode != 0:
        raise RuntimeError(f"nordvpn connect Argentina failed: {result.stderr.decode('utf-8', errors='replace')[-200:]}")
    print("[relay] Connected to Argentina.")


def nordvpn_disconnect() -> None:
    """Disconnect NordVPN."""
    _nordvpn("disconnect", timeout=30)
    print("[relay] Disconnected.")


# ─── CAMMESA fetch ────────────────────────────────────────────────────────


def to_cammesa_date(d: datetime.date) -> str:
    return d.strftime("%d-%m-%Y")


def fetch_cammesa_day(date: datetime.date) -> list[dict]:
    """Fetch a single day of CAMMESA renewables data."""
    params = f"?desde={to_cammesa_date(date)}&hasta={to_cammesa_date(date)}"
    url = CAMMESA_URL + params

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
        "Accept": "application/json",
    })
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=30) as resp:
            body = resp.read().decode("utf-8")
            data = json.loads(body)
            if not isinstance(data, list):
                raise ValueError(f"Unexpected response shape: {type(data).__name__}")
            return data
    except Exception as e:
        print(f"[relay]  WARN: {date} failed: {str(e)[:100]}")
        return []


def fetch_cammesa_range(start: datetime.date, end: datetime.date) -> list[dict]:
    """Fetch CAMMESA data for a date range, one day at a time."""
    all_points: list[dict] = []
    current = start
    while current <= end:
        points = fetch_cammesa_day(current)
        all_points.extend(points)
        current += datetime.timedelta(days=1)
    return all_points


def points_to_csv_rows(points: list[dict]) -> list[list[str]]:
    """Convert CAMMESA JSON points to CSV rows."""
    rows: list[list[str]] = []
    seen = set()
    for pt in points:
        momento = pt.get("momento", "")
        if not momento:
            continue
        # Parse the CAMMESA timestamp format: "2026-06-20T04:25:00.000-0300"
        # Normalize to ISO
        try:
            # Remove timezone offset for UTC conversion
            ts = momento.replace("+", "+").replace("-0300", "-03:00")
            dt = datetime.datetime.fromisoformat(ts)
            utc_ts = dt.astimezone(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        except Exception:
            utc_ts = momento

        if utc_ts in seen:
            continue
        seen.add(utc_ts)

        eolica = pt.get("eolica", 0) or 0
        fotovoltaica = pt.get("fotovoltaica", 0) or 0
        hidraulica = pt.get("hidraulica", 0) or 0
        biocombustible = pt.get("biocombustible", 0) or 0

        rows.append([utc_ts, str(eolica), str(fotovoltaica), str(hidraulica), str(biocombustible)])

    rows.sort(key=lambda r: r[0])
    return rows


def load_existing_csv(path: str) -> set[str]:
    """Load existing CSV timestamps to avoid duplicates."""
    if not os.path.exists(path):
        return set()
    existing: set[str] = set()
    with open(path, "r", newline="") as f:
        reader = csv.reader(f)
        next(reader, None)  # skip header
        for row in reader:
            if row:
                existing.add(row[0])
    return existing


def append_to_csv(path: str, rows: list[list[str]], existing: set[str]) -> int:
    """Append new rows to CSV. Returns count of new rows added."""
    new_rows = [r for r in rows if r[0] not in existing]
    if not new_rows:
        return 0

    write_header = not os.path.exists(path)
    with open(path, "a", newline="") as f:
        writer = csv.writer(f)
        if write_header:
            writer.writerow(["utc_timestamp", "eolica_mw", "fotovoltaica_mw", "hidraulica_mw", "biocombustible_mw"])
        for row in new_rows:
            writer.writerow(row)

    return len(new_rows)


# ─── Main ─────────────────────────────────────────────────────────────────


def main() -> None:
    parser = argparse.ArgumentParser(description="Argentina CAMMESA relay")
    parser.add_argument("--days", type=int, default=30, help="Days of data to fetch")
    parser.add_argument("--dry-run", action="store_true", help="Print what would be done without writing")
    parser.add_argument("--csv-out", default=CANONICAL_CSV,
                        help="CSV to append to (abed: the relay repo clone's argentina-cammesa.csv)")
    parser.add_argument("--vpn", choices=("always", "on-fail", "never"), default="always",
                        help="always: connect first; on-fail: connect only if the public fetch returns nothing")
    args = parser.parse_args()
    csv_out = args.csv_out

    end_date = datetime.date.today()
    start_date = end_date - datetime.timedelta(days=args.days)

    print(f"[relay] Argentina CAMMESA relay — fetching {args.days} days ending {end_date}")

    connected = False
    if args.vpn == "always":
        nordvpn_connect_argentina()
        connected = True

    try:
        print(f"[relay] Fetching CAMMESA data from {start_date} to {end_date}...")
        points = fetch_cammesa_range(start_date, end_date)
        if not points and args.vpn == "on-fail":
            print("[relay] Public fetch returned nothing - retrying through NordVPN Argentina")
            nordvpn_connect_argentina()
            connected = True
            points = fetch_cammesa_range(start_date, end_date)
        print(f"[relay] Got {len(points)} raw data points")

        if not points:
            # A day with no answer is a failure, not an empty day: CAMMESA publishes
            # every 5 minutes. Exit non-zero so the pusher logs it and pushes nothing.
            print("[relay] No data returned — nothing to save")
            sys.exit(2)

        # Convert to CSV rows
        rows = points_to_csv_rows(points)
        print(f"[relay] {len(rows)} unique timestamps after dedup")

        if args.dry_run:
            print(f"[relay] DRY RUN — would write {len(rows)} rows to {csv_out}")
            print(f"[relay] First row: {rows[0]}")
            print(f"[relay] Last row: {rows[-1]}")
            return

        # Load existing data and append
        os.makedirs(os.path.dirname(os.path.abspath(csv_out)), exist_ok=True)
        existing = load_existing_csv(csv_out)
        n = append_to_csv(csv_out, rows, existing)
        print(f"[relay] Appended {n} new rows to {csv_out} ({len(existing)} already present)")

        if n > 0:
            # Show date range
            dates = sorted(set(r[0][:10] for r in rows if r[0] not in existing))
            if dates:
                print(f"[relay] Date range of new data: {dates[0]} to {dates[-1]} ({len(dates)} days)")
    finally:
        if connected:
            nordvpn_disconnect()


if __name__ == "__main__":
    main()
