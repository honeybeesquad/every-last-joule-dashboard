#!/usr/bin/env python3
"""Relay: refresh Mexico CENACE generation-by-technology CSV.

The Mexico region reads hourly wind (eólica) and solar (fotovoltaica)
generation data from the committed relay CSV at
data/historical/mexico-generacion.csv. This script downloads the
"Generacion Liquidada" CSV from CENACE's ASP.NET portal and appends
parsed rows to that relay CSV.

Usage:
    python3 scripts/relay/mexico-cenace-fetch.py [--dry-run] [--csv-out PATH]

Behaviour:
    1. Loads the CENACE Energía Generada por Tipo de Tecnología page
       to obtain ASP.NET form state (__VIEWSTATE, __EVENTVALIDATION).
       No bot protection blocks curl-based requests to this page.
    2. Submits the form to download the generation CSV for the latest
       published month (the page always shows the most recent month).
    3. Parses the CSV: extracts wind (Eolica) and solar (Fotovoltaica)
       hourly MWh, plus total generation across all technologies.
    4. Reads existing date,hour keys from the relay CSV.
    5. Appends only new rows; never rewrites existing ones.
    6. Exits 0 on success (even if zero new rows).

The CENACE CSV format (Generacion Liquidada):
    - 15 metadata/header lines (skip first 15)
    - Column header: Sistema, Dia, Hora, Eolica, Fotovoltaica, ...
    - Date format: DD/MM/YYYY (quoted)
    - Hour: 1-24 (CENACE uses 1-24, not 0-23)
    - All numeric values are quoted strings

The relay CSV format:
    date,hour,eolica_mwh,fotovoltaica_mwh,total_mwh
    2026-05-01,0,2224.3,0.1,41731.8

Note: CENACE hours are 1-24; we convert to 0-23 for the relay CSV.
"""

from __future__ import annotations

import argparse
import csv
import datetime
import io
import os
import re
import sys
import urllib.parse
import urllib.request

CENACE_PAGE_URL = (
    "https://www.cenace.gob.mx/Paginas/SIM/Reportes/"
    "EnergiaGeneradaTipoTec.aspx"
)

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CSV_PATH = os.path.join(REPO_ROOT, "data", "historical", "mexico-generacion.csv")

# CENACE CSV has 15 lines of metadata before the column header (format A)
SKIP_ROWS = 15

# Technology columns in the CENACE CSV (0-indexed after header)
COL_SISTEMA = 0
COL_DIA = 1
COL_HORA = 2
COL_EOLICA = 3
COL_FOTOVOLTAICA = 4
# Total = sum of all technology columns (indices 3-13)
COL_TOTAL_START = 3
COL_TOTAL_END = 14  # exclusive


def fetch_page_state(
    session_cookie: str | None = None,
) -> tuple[dict[str, str], list[str]]:
    """Fetch the CENACE page and extract ASP.NET form fields.

    Returns (form_fields, set_cookie_headers).
    """
    req = urllib.request.Request(CENACE_PAGE_URL, headers={
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
    })
    if session_cookie:
        req.add_header("Cookie", session_cookie)

    with urllib.request.urlopen(req, timeout=30) as resp:
        html = resp.read().decode("utf-8", errors="replace")
        # Capture any Set-Cookie headers
        cookies = resp.headers.get_all("Set-Cookie") or []

    fields: dict[str, str] = {}
    for name in ("__VIEWSTATE", "__VIEWSTATEGENERATOR", "__EVENTVALIDATION"):
        m = re.search(rf'id="{name}".*?value="(.*?)"', html, re.DOTALL)
        if m:
            fields[name] = m.group(1)
        else:
            # Try alternate pattern
            m = re.search(rf'name="{name}".*?value="(.*?)"', html, re.DOTALL)
            if m:
                fields[name] = m.group(1)

    if "__VIEWSTATE" not in fields:
        raise RuntimeError("Failed to extract __VIEWSTATE from CENACE page")

    return fields, cookies


def download_csv(
    form_fields: dict[str, str],
    session_cookie: str | None = None,
) -> str:
    """Submit the CENACE form and return the CSV content as a string."""
    # The CSV download button is an ImageButton; we simulate the click
    # by including its coordinates in the POST data
    csv_button = (
        "ctl00$ContentPlaceHolder1$GridRadResultado"
        "$ctl00$ctl04$gbccolumn"
    )

    data = dict(form_fields)
    data[csv_button + ".x"] = "10"
    data[csv_button + ".y"] = "10"

    encoded = urllib.parse.urlencode(data).encode("utf-8")
    req = urllib.request.Request(
        CENACE_PAGE_URL,
        data=encoded,
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            "Referer": CENACE_PAGE_URL,
        },
    )
    if session_cookie:
        req.add_header("Cookie", session_cookie)

    with urllib.request.urlopen(req, timeout=60) as resp:
        content_type = resp.headers.get("Content-Type", "")
        body = resp.read()

        # If we got HTML instead of CSV, the form submission failed
        if "text/html" in content_type:
            text = body.decode("utf-8", errors="replace")
            if "challenge" in text.lower() or "captcha" in text.lower():
                raise RuntimeError("CENACE returned a bot challenge page")
            raise RuntimeError(
                f"CENACE returned HTML instead of CSV "
                f"(Content-Type: {content_type})"
            )

        return body.decode("utf-8", errors="replace")


def parse_cenace_csv(csv_text: str) -> list[tuple[str, int, float, float, float]]:
    """Parse a CENACE Generacion Liquidada CSV.

    Returns list of (date, hour, eolica_mwh, fotovoltaica_mwh, total_mwh).
    Date is in YYYY-MM-DD format. Hour is 0-23 (converted from CENACE 1-24).
    """
    lines = csv_text.strip().split("\n")
    if len(lines) <= SKIP_ROWS:
        raise RuntimeError(
            f"CSV has only {len(lines)} lines, expected > {SKIP_ROWS}"
        )

    # Find the header row (contains "Sistema" and "Eolica")
    header_idx = None
    for i, line in enumerate(lines):
        if "Sistema" in line and "Eolica" in line:
            header_idx = i
            break

    if header_idx is None:
        raise RuntimeError("Could not find column header in CENACE CSV")

    data_lines = lines[header_idx + 1:]
    rows: list[tuple[str, int, float, float, float]] = []

    for line in data_lines:
        line = line.strip()
        if not line:
            continue

        # Parse CSV with quotes
        reader = csv.reader(io.StringIO(line))
        try:
            fields = next(reader)
        except StopIteration:
            continue

        if len(fields) < COL_TOTAL_END:
            continue

        try:
            sistema = fields[COL_SISTEMA].strip().strip('"')
            dia = fields[COL_DIA].strip().strip('"')
            hora = int(fields[COL_HORA].strip().strip('"'))
            eolica = float(fields[COL_EOLICA].strip().strip('"'))
            fotovoltaica = float(fields[COL_FOTOVOLTAICA].strip().strip('"'))

            # Compute total from all technology columns
            total = 0.0
            for ci in range(COL_TOTAL_START, min(COL_TOTAL_END, len(fields))):
                try:
                    total += float(fields[ci].strip().strip('"'))
                except (ValueError, IndexError):
                    pass
        except (ValueError, IndexError) as e:
            print(f"  SKIP line (parse error: {e}): {line[:80]}", file=sys.stderr)
            continue

        # Convert date from DD/MM/YYYY to YYYY-MM-DD
        try:
            date_obj = datetime.datetime.strptime(dia, "%d/%m/%Y")
            date_str = date_obj.strftime("%Y-%m-%d")
        except ValueError:
            print(f"  SKIP line (bad date: {dia})", file=sys.stderr)
            continue

        # Convert CENACE hour (1-24) to 0-23
        hour_0 = (hora - 1) % 24

        rows.append((date_str, hour_0, eolica, fotovoltaica, total))

    return rows


def read_existing_keys(csv_path: str) -> set[str]:
    """Read existing date,hour keys from the relay CSV."""
    keys: set[str] = set()
    if not os.path.exists(csv_path):
        return keys

    with open(csv_path, encoding="utf-8") as f:
        header = next(f, "").strip()
        if not header.startswith("date,hour,"):
            raise ValueError(f"Unexpected CSV header: {header!r}")
        for line in f:
            parts = line.strip().split(",")
            if len(parts) >= 2 and parts[0]:
                keys.add(f"{parts[0]},{parts[1]}")

    return keys


def append_rows(
    csv_path: str,
    new_rows: list[tuple[str, int, float, float, float]],
) -> int:
    """Append new rows to the relay CSV. Returns count of appended rows."""
    existing = read_existing_keys(csv_path)
    appended = 0

    # Ensure file has header if it doesn't exist
    if not os.path.exists(csv_path):
        os.makedirs(os.path.dirname(csv_path), exist_ok=True)
        with open(csv_path, "w", encoding="utf-8") as f:
            f.write("date,hour,eolica_mwh,fotovoltaica_mwh,total_mwh\n")

    with open(csv_path, "a", encoding="utf-8") as f:
        for date_str, hour, eolica, fotovoltaica, total in new_rows:
            key = f"{date_str},{hour}"
            if key not in existing:
                f.write(
                    f"{date_str},{hour},{eolica:.1f},{fotovoltaica:.1f},"
                    f"{total:.1f}\n"
                )
                existing.add(key)
                appended += 1

    return appended


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report what would be appended; do not modify the CSV",
    )
    parser.add_argument(
        "--csv-out",
        type=str,
        default=None,
        help="Also save the raw CENACE CSV to this path",
    )
    args = parser.parse_args()

    print(
        f"# mexico-cenace-fetch.py: downloading from CENACE...",
        file=sys.stderr,
    )

    # Step 1: Get ASP.NET form state
    print("# Step 1: Loading CENACE page for form state...", file=sys.stderr)
    try:
        form_fields, cookies = fetch_page_state()
    except Exception as e:
        print(f"# FAILED to load CENACE page: {e}", file=sys.stderr)
        return 1

    cookie_str = "; ".join(
        c.split(";")[0] for c in cookies if "=" in c
    ) if cookies else None

    print(
        f"# Form state loaded "
        f"(VIEWSTATE: {len(form_fields.get('__VIEWSTATE', ''))} chars)",
        file=sys.stderr,
    )

    # Step 2: Download CSV
    print("# Step 2: Downloading generation CSV...", file=sys.stderr)
    try:
        csv_text = download_csv(form_fields, cookie_str)
    except Exception as e:
        print(f"# FAILED to download CSV: {e}", file=sys.stderr)
        return 1

    # Save raw CSV if requested
    if args.csv_out:
        with open(args.csv_out, "w", encoding="utf-8") as f:
            f.write(csv_text)
        print(f"# Raw CSV saved to {args.csv_out}", file=sys.stderr)

    # Extract filename from Content-Disposition if available
    print(
        f"# Downloaded CSV: {len(csv_text)} chars, "
        f"{csv_text.count(chr(10))} lines",
        file=sys.stderr,
    )

    # Step 3: Parse CSV
    print("# Step 3: Parsing CENACE CSV...", file=sys.stderr)
    try:
        rows = parse_cenace_csv(csv_text)
    except Exception as e:
        print(f"# FAILED to parse CSV: {e}", file=sys.stderr)
        return 1

    if not rows:
        print("# No data rows found in CSV", file=sys.stderr)
        return 1

    # Show date range
    dates = sorted(set(r[0] for r in rows))
    print(
        f"# Parsed {len(rows)} rows covering {dates[0]} to {dates[-1]}",
        file=sys.stderr,
    )

    # Step 4: Append to relay CSV
    print(f"# Step 4: Appending to {CSV_PATH}...", file=sys.stderr)
    if args.dry_run:
        existing = read_existing_keys(CSV_PATH)
        new_count = sum(
            1 for r in rows if f"{r[0]},{r[1]}" not in existing
        )
        print(
            f"# --dry-run: would append {new_count} new rows "
            f"({len(rows) - new_count} already present)",
            file=sys.stderr,
        )
        return 0

    appended = append_rows(CSV_PATH, rows)
    total_existing = len(read_existing_keys(CSV_PATH))
    print(
        f"# Appended {appended} new rows "
        f"({len(rows) - appended} already present, "
        f"{total_existing} total in relay CSV)",
        file=sys.stderr,
    )

    return 0


if __name__ == "__main__":
    sys.exit(main())
