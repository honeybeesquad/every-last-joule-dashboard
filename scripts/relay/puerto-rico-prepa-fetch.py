#!/usr/bin/env python3
"""Relay: poll PREPA/LUMA/Genera operational generation into a CSV.

operationdata.prepa.pr.gov/dataSource.js is a live snapshot (utility-scale
solar + wind SiteTotal MW), not a 30-day archive. This script appends one
row per distinct `dataFechaAcualizado` so abed can accumulate a diurnal
series the way Colombia appends VertEner days.

The Azure mirror (`app-osipi-ftp-dev-eu2-001.azurewebsites.net`) is
IP-forbidden from NZ. genera-pr.com is Cloudflare 403 from SYD. If the
public IIS host geo-blocks later, `--vpn on-403` (default) connects
NordVPN Puerto_Rico, then United_States, the same way
argentina-cammesa-fetch.py swaps to Argentina.

Usage (dashboard checkout, no VPN):
    python3 scripts/relay/puerto-rico-prepa-fetch.py [--dry-run]

Usage (abed → relay repo, NordVPN on 403):
    python3 scripts/relay/puerto-rico-prepa-fetch.py \\
        --csv-out ~/elj-relay/data-relay-repo/puerto-rico-genera.csv

Then push with scripts/relay/puerto-rico-prepa-push.sh (Colombia pattern).
On abed, copy both files to ~/elj-relay/ and cron hourly:
    7 * * * * /home/simon/elj-relay/puerto-rico-prepa-push.sh

Waste is unpublished. This is generation only. Not T1a.
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import os
import re
import ssl
import subprocess
import sys
import urllib.error
import urllib.request
from zoneinfo import ZoneInfo

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CANONICAL_CSV = os.path.join(REPO_ROOT, "data", "historical", "puerto-rico-genera.csv")

PRIMARY_URL = "https://operationdata.prepa.pr.gov/dataSource.js"
AZURE_MIRROR_URL = "https://app-osipi-ftp-dev-eu2-001.azurewebsites.net/dataSource.js"
FLARESOLVERR_URL = os.environ.get("FLARESOLVERR_URL", "http://127.0.0.1:8191/v1")
PR_TZ = ZoneInfo("America/Puerto_Rico")

CSV_HEADER = [
    "utc_timestamp",
    "solar_mw",
    "wind_mw",
    "system_mw",
    "source_updated_local",
    "fetched_at_utc",
]


def parse_datasource(js: str) -> dict[str, str | float]:
    """Extract solar/wind/system MW and the operator timestamp from dataSource.js."""
    if "dataLoadPerSite" not in js or "dataFechaAcualizado" not in js:
        raise RuntimeError("PREPA dataSource.js missing dataLoadPerSite / dataFechaAcualizado")
    date_m = re.search(r"dataFechaAcualizado\s*=\s*'([^']+)'", js)
    if not date_m:
        raise RuntimeError("PREPA dataSource.js has no dataFechaAcualizado")
    local = date_m.group(1).strip()
    sites = dict(
        re.findall(
            r"Type:\s*'Renovable',\s*Desc:\s*'(Wind|Solar)',\s*SiteTotal:\s*([0-9.]+)",
            js,
        )
    )
    if "Solar" not in sites or "Wind" not in sites:
        raise RuntimeError(f"PREPA dataSource.js missing Renovable SiteTotals: {sites}")
    tot_m = re.search(r"Desc:\s*'Total de Generaci[oó]n',\s*value:\s*([0-9.]+)", js)
    naive = dt.datetime.strptime(local, "%m/%d/%Y %I:%M:%S %p")
    aware = naive.replace(tzinfo=PR_TZ)
    utc = aware.astimezone(dt.timezone.utc)
    return {
        "utc_timestamp": utc.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "solar_mw": float(sites["Solar"]),
        "wind_mw": float(sites["Wind"]),
        "system_mw": float(tot_m.group(1)) if tot_m else float("nan"),
        "source_updated_local": local,
    }


def _ssl_ctx() -> ssl.SSLContext:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


def fetch_url(url: str, timeout: int = 30) -> tuple[int, str]:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
            "Accept": "*/*",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=_ssl_ctx()) as resp:
            return resp.status, resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as err:
        body = err.read().decode("utf-8", errors="replace")
        return err.code, body


def flaresolverr_get(url: str) -> str:
    payload = json.dumps({"cmd": "request.get", "url": url, "maxTimeout": 60000}).encode()
    req = urllib.request.Request(
        FLARESOLVERR_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=90) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    if data.get("status") != "ok":
        raise RuntimeError(f"Flaresolverr failed: {data.get('message', data)}")
    return data["solution"]["response"]


def get_sudo_password() -> str:
    pw = os.environ.get("SUDO_PASSWORD", "")
    if pw:
        return pw
    for path in (
        os.path.join(REPO_ROOT, ".env"),
        os.path.expanduser("~/.hermes/.env"),
    ):
        if os.path.exists(path):
            with open(path, encoding="utf-8") as fh:
                for line in fh:
                    if line.startswith("SUDO_PASSWORD="):
                        return line.strip().split("=", 1)[1].strip("'\"")
    raise RuntimeError("SUDO_PASSWORD not set (needed for nordvpn connect)")


VPN_COUNTRIES = ("Puerto_Rico", "United_States")


def nordvpn_connect(countries: tuple[str, ...] = VPN_COUNTRIES) -> None:
    password = get_sudo_password()
    subprocess.run(
        ["sudo", "-S", "nordvpn", "disconnect"],
        input=password.encode() + b"\n",
        capture_output=True,
        timeout=30,
        check=False,
    )
    errors: list[str] = []
    for country in countries:
        print(f"[relay] Connecting NordVPN {country}...")
        result = subprocess.run(
            ["sudo", "-S", "nordvpn", "connect", country],
            input=password.encode() + b"\n",
            capture_output=True,
            timeout=90,
            check=False,
        )
        if result.returncode == 0:
            print(f"[relay] Connected to {country}.")
            return
        errors.append(
            f"{country}: {result.stderr.decode('utf-8', errors='replace')[-160:]}"
        )
    raise RuntimeError("nordvpn connect failed: " + " | ".join(errors))


def nordvpn_disconnect() -> None:
    try:
        password = get_sudo_password()
    except RuntimeError:
        return
    subprocess.run(
        ["sudo", "-S", "nordvpn", "disconnect"],
        input=password.encode() + b"\n",
        capture_output=True,
        timeout=30,
        check=False,
    )
    print("[relay] Disconnected NordVPN.")


def looks_like_js(body: str) -> bool:
    return "dataLoadPerSite" in body and "dataFechaAcualizado" in body


def fetch_datasource(vpn: str) -> str:
    """Fetch dataSource.js. vpn: never | on-403 | always."""
    connected = False
    if vpn == "always":
        nordvpn_connect()
        connected = True
    try:
        for url in (PRIMARY_URL, AZURE_MIRROR_URL):
            status, body = fetch_url(url)
            print(f"[relay] {url} -> HTTP {status} ({len(body)} bytes)")
            if status == 200 and looks_like_js(body):
                return body
            if status in (403, 401, 451) and vpn == "on-403" and not connected:
                nordvpn_connect()
                connected = True
                status, body = fetch_url(url)
                print(f"[relay] retry {url} -> HTTP {status}")
                if status == 200 and looks_like_js(body):
                    return body
        print("[relay] trying Flaresolverr on primary URL")
        body = flaresolverr_get(PRIMARY_URL)
        if looks_like_js(body):
            return body
        raise RuntimeError("PREPA dataSource.js not reachable (public, VPN, Flaresolverr all failed)")
    finally:
        if connected:
            nordvpn_disconnect()


def load_existing_timestamps(path: str) -> set[str]:
    if not os.path.exists(path):
        return set()
    existing: set[str] = set()
    with open(path, newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            ts = (row.get("utc_timestamp") or "").strip()
            if ts:
                existing.add(ts)
    return existing


def append_row(path: str, row: dict[str, str | float], existing: set[str]) -> bool:
    ts = str(row["utc_timestamp"])
    if ts in existing:
        return False
    write_header = not os.path.exists(path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "a", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=CSV_HEADER, lineterminator="\n")
        if write_header:
            writer.writeheader()
        writer.writerow(
            {
                "utc_timestamp": ts,
                "solar_mw": f"{float(row['solar_mw']):.4f}".rstrip("0").rstrip("."),
                "wind_mw": f"{float(row['wind_mw']):.4f}".rstrip("0").rstrip("."),
                "system_mw": f"{float(row['system_mw']):.4f}".rstrip("0").rstrip(".")
                if row["system_mw"] == row["system_mw"]
                else "",
                "source_updated_local": row["source_updated_local"],
                "fetched_at_utc": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            }
        )
    return True


def main() -> None:
    parser = argparse.ArgumentParser(description="PREPA/Genera generation relay")
    parser.add_argument("--csv-out", default=CANONICAL_CSV)
    parser.add_argument("--vpn", choices=("never", "on-403", "always"), default="on-403")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--from-file", help="Parse a saved dataSource.js instead of fetching")
    args = parser.parse_args()

    if args.from_file:
        with open(args.from_file, encoding="utf-8") as fh:
            js = fh.read()
    else:
        print("[relay] PREPA dataSource.js poll")
        js = fetch_datasource(args.vpn)

    parsed = parse_datasource(js)
    print(
        f"[relay] {parsed['source_updated_local']} UTC={parsed['utc_timestamp']} "
        f"solar={parsed['solar_mw']} MW wind={parsed['wind_mw']} MW system={parsed['system_mw']} MW"
    )

    if args.dry_run:
        print(f"[relay] DRY RUN — would append to {args.csv_out}")
        return

    existing = load_existing_timestamps(args.csv_out)
    if append_row(args.csv_out, parsed, existing):
        print(f"[relay] appended {parsed['utc_timestamp']} to {args.csv_out}")
    else:
        print(f"[relay] {parsed['utc_timestamp']} already in CSV — nothing to append")


if __name__ == "__main__":
    try:
        main()
    except Exception as err:
        print(f"[relay] ERROR: {err}", file=sys.stderr)
        sys.exit(1)
