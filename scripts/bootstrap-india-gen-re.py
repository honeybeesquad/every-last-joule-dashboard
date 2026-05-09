#!/usr/bin/env python3
"""
Bootstrap India CEA gen-re daily generation CSVs.

Fetches 365 days of daily Excel reports from gen-re.cea.gov.in and writes:
  data/historical/india-<state>-gen-daily.csv  (columns: date,wind_gwh,solar_gwh)

Run once locally before committing CSVs. Rate-limited to ~2 req/s.
Skips dates with no report (weekends, public holidays) gracefully.

Usage:
  cd /Users/simoncollins/code/every-last-joule-dashboard
  python3 scripts/bootstrap-india-gen-re.py
"""

import os
import sys
import time
import zipfile
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
from datetime import date, timedelta
from io import BytesIO

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR   = os.path.join(REPO_ROOT, "data", "historical")
CEA_BASE   = "https://gen-re.cea.gov.in/public/uploads/dailyReport/excel"

# Hindi+English row labels from sharedStrings.xml (confirmed from Report-2026-05-07.xlsx)
STATE_LABELS = {
    "rajasthan":      "Rajasthan",
    "gujarat":        "Gujarat",
    "tamil-nadu":     "Tamil Nadu",
    "andhra-pradesh": "Andhra Pradesh",
    "maharashtra":    "Maharashtra",
}

RATE_LIMIT_S = 0.5  # 2 requests per second max


def fetch_excel(report_date: date) -> bytes | None:
    url = f"{CEA_BASE}/Report-{report_date.isoformat()}.xlsx"
    try:
        with urllib.request.urlopen(url, timeout=20) as resp:
            if resp.status == 200:
                return resp.read()
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        print(f"  HTTP {e.code} for {report_date}", file=sys.stderr)
    except Exception as e:
        print(f"  Error fetching {report_date}: {e}", file=sys.stderr)
    return None


def parse_shared_strings(zf: zipfile.ZipFile) -> list[str]:
    try:
        with zf.open("xl/sharedStrings.xml") as f:
            tree = ET.parse(f)
        root = tree.getroot()
        ns = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
        strings = []
        for si in root.findall("x:si", ns):
            # Collect all <t> text within the si element (handles rich text runs)
            text = "".join(t.text or "" for t in si.findall(".//x:t", ns))
            strings.append(text)
        return strings
    except KeyError:
        return []


def col_letter_to_index(col: str) -> int:
    """Convert Excel column letter(s) to 0-based index (A=0, B=1, ...)."""
    result = 0
    for ch in col.upper():
        result = result * 26 + (ord(ch) - ord("A") + 1)
    return result - 1


def parse_state_wise_sheet(zf: zipfile.ZipFile, shared: list[str]) -> dict[str, dict[str, float]]:
    """
    Parse all sheets, find the State-Wise sheet, extract wind+solar GWh per state.
    Returns {state_key: {wind_gwh: float, solar_gwh: float}}.

    State-Wise sheet columns (Today's generation section):
      Col A (or similar): State label (shared string index)
      Col B: Wind Energy (MU)
      Col C: Solar Energy (MU)
    """
    ns = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

    # Find all sheet XML paths
    sheet_paths = sorted(
        [n for n in zf.namelist() if n.startswith("xl/worksheets/sheet") and n.endswith(".xml")]
    )

    for sheet_path in sheet_paths:
        with zf.open(sheet_path) as f:
            tree = ET.parse(f)
        root = tree.getroot()

        # Build row→{col_index: value} map
        rows: dict[int, dict[int, str | float]] = {}
        for row_el in root.findall(".//x:row", ns):
            r = int(row_el.get("r", 0))
            row_data: dict[int, str | float] = {}
            for cell in row_el.findall("x:c", ns):
                ref = cell.get("r", "")
                # Extract column letters
                col_str = "".join(ch for ch in ref if ch.isalpha())
                col_idx = col_letter_to_index(col_str)
                cell_type = cell.get("t", "")
                v_el = cell.find("x:v", ns)
                if v_el is None or v_el.text is None:
                    continue
                if cell_type == "s":
                    # Shared string
                    idx = int(v_el.text)
                    row_data[col_idx] = shared[idx] if idx < len(shared) else ""
                else:
                    try:
                        row_data[col_idx] = float(v_el.text)
                    except ValueError:
                        row_data[col_idx] = v_el.text
            if row_data:
                rows[r] = row_data

        # Look for state labels in this sheet
        results: dict[str, dict[str, float]] = {}
        for row_num, row_data in rows.items():
            for col_idx, val in row_data.items():
                if not isinstance(val, str):
                    continue
                for state_key, english_name in STATE_LABELS.items():
                    if english_name in val:
                        # Found a state row. Wind is typically col B (idx 1), Solar col C (idx 2)
                        # relative to the label column. Try absolute cols first.
                        wind_gwh  = 0.0
                        solar_gwh = 0.0
                        # Scan numeric columns in this row
                        numeric_cols = sorted(
                            [(c, v) for c, v in row_data.items() if isinstance(v, float)],
                            key=lambda x: x[0],
                        )
                        if len(numeric_cols) >= 2:
                            wind_gwh  = numeric_cols[0][1]
                            solar_gwh = numeric_cols[1][1]
                        results[state_key] = {"wind_gwh": wind_gwh, "solar_gwh": solar_gwh}

        if results:
            return results

    return {}


def load_existing_dates(csv_path: str) -> set[str]:
    if not os.path.exists(csv_path):
        return set()
    dates = set()
    with open(csv_path) as f:
        for i, line in enumerate(f):
            if i == 0:
                continue  # header
            parts = line.strip().split(",")
            if parts:
                dates.add(parts[0])
    return dates


def main():
    today = date.today()
    start = today - timedelta(days=365)

    # Load existing rows per state to allow resuming
    existing: dict[str, set[str]] = {}
    csv_handles: dict[str, object] = {}
    for state in STATE_LABELS:
        csv_path = os.path.join(DATA_DIR, f"india-{state}-gen-daily.csv")
        existing[state] = load_existing_dates(csv_path)
        # Open in append mode; write header if empty
        mode = "a"
        csv_handles[state] = open(csv_path, mode, newline="")
        if not existing[state]:
            csv_handles[state].write("date,wind_gwh,solar_gwh\n")

    total = (today - start).days
    fetched = skipped = errors = 0

    d = start
    while d < today:
        ds = d.isoformat()
        d += timedelta(days=1)

        # Skip if all states already have this date
        if all(ds in existing[s] for s in STATE_LABELS):
            skipped += 1
            continue

        data = fetch_excel(date.fromisoformat(ds))
        time.sleep(RATE_LIMIT_S)

        if data is None:
            print(f"  {ds}: no report (weekend/holiday)")
            continue

        try:
            zf = zipfile.ZipFile(BytesIO(data))
            shared = parse_shared_strings(zf)
            state_data = parse_state_wise_sheet(zf, shared)
        except Exception as e:
            errors += 1
            print(f"  {ds}: parse error — {e}", file=sys.stderr)
            continue

        if not state_data:
            errors += 1
            print(f"  {ds}: no state data found", file=sys.stderr)
            continue

        fetched += 1
        found_states = list(state_data.keys())
        for state, vals in state_data.items():
            if ds not in existing[state]:
                csv_handles[state].write(
                    f"{ds},{vals['wind_gwh']:.3f},{vals['solar_gwh']:.3f}\n"
                )
                existing[state].add(ds)

        pct = ((fetched + skipped) / total * 100)
        print(f"  {ds}: {found_states} [{pct:.0f}%]")

    for fh in csv_handles.values():
        fh.close()

    print(f"\nDone. fetched={fetched} skipped={skipped} errors={errors}")
    for state in STATE_LABELS:
        csv_path = os.path.join(DATA_DIR, f"india-{state}-gen-daily.csv")
        n = len(existing[state])
        print(f"  {state}: {n} rows → {csv_path}")


if __name__ == "__main__":
    main()
