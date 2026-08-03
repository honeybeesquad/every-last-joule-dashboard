#!/usr/bin/env python3
"""Build the MSLDC measured-curtailment relay CSV from published monthly PDFs.

Maharashtra State Load Despatch Centre publishes, under Reports -> REMC ->
Monthly Curtailment Reports, one PDF per month at a stable path:

    https://mahasldc.in/assets/shared/reports/mr10_MMYYYY.pdf

Each PDF is a daily table -- Date | Wind (Max MW, Energy MU) | Solar (Max MW,
Energy MU) | Reason -- where an uncurtailed day is the literal string "NIL" and
the Reason column carries the operator's own cause code (usually an SPS
operation to relieve a specific line).

This is genuinely measured operator data, which is why `india-maharashtra` can
leave T3-modelled. It is NOT a live feed: publication is monthly, lags one to
two months, and skips months outright (2025-12, 2026-01 and 2026-07 were all
404 when this script was written on 2026-08-03). That is why the region lands
at T2-annual-calibrated rather than any T1 tier -- see
docs/methodology/tier-classification-guide.md.

Units: the reports are in MU (million units). 1 MU = 1e6 kWh = 1 GWh, so the
Energy column maps 1:1 onto the `*_curtailed_gwh` columns with no conversion.

Run on demand and commit the result; nothing in CI or the build fetches this.

    python3 scripts/fetch-msldc-curtailment.py --from 2025-01 --to 2026-12

Requires `pdftotext` (poppler-utils; `brew install poppler`).
"""

from __future__ import annotations

import argparse
import calendar
import datetime as dt
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
from pathlib import Path

PDF_URL = "https://mahasldc.in/assets/shared/reports/mr10_{mm}{yyyy}.pdf"
OUT_PATH = Path(__file__).resolve().parents[1] / "data/historical/india-maharashtra-sldc-curtailed-daily.csv"

# Sr | DD-MM-YYYY | wind max MW | wind MU | solar max MW | solar MU | reason...
ROW_RE = re.compile(
    r"^\s*\d+\s+(\d{2}-\d{2}-\d{4})\s+"
    r"(NIL|[\d.]+)\s+(NIL|[\d.]+)\s+"
    r"(NIL|[\d.]+)\s+(NIL|[\d.]+)"
)


def months(start: str, end: str) -> list[tuple[int, int]]:
    sy, sm = int(start[:4]), int(start[5:7])
    ey, em = int(end[:4]), int(end[5:7])
    out = []
    y, m = sy, sm
    while (y, m) <= (ey, em):
        out.append((y, m))
        m += 1
        if m > 12:
            y, m = y + 1, 1
    return out


def fetch_pdf(year: int, month: int, dest: Path) -> bool:
    """Download one monthly PDF. Returns False for a 404 (month not published)."""
    url = PDF_URL.format(mm=f"{month:02d}", yyyy=year)
    req = urllib.request.Request(url, headers={"User-Agent": "every-last-joule-dashboard/relay"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            body = r.read()
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return False
        raise
    # The site answers a missing report with an HTML error page under some
    # paths rather than a 404, so check the magic bytes rather than trusting
    # the status code alone.
    if not body.startswith(b"%PDF"):
        return False
    dest.write_bytes(body)
    return True


def parse_pdf(path: Path, year: int, month: int) -> dict[str, tuple[float, float]]:
    """Extract {ISO date: (wind_gwh, solar_gwh)} from one monthly report."""
    text = subprocess.run(
        ["pdftotext", "-layout", str(path), "-"],
        capture_output=True, text=True, check=True,
    ).stdout

    rows: dict[str, tuple[float, float]] = {}
    for line in text.splitlines():
        m = ROW_RE.match(line)
        if not m:
            continue
        d, _wmax, wmu, _smax, smu = m.groups()
        day, mon, yr = d.split("-")
        if int(mon) != month or int(yr) != year:
            # Guard against a mislabelled or concatenated report.
            continue
        wind = 0.0 if wmu == "NIL" else float(wmu)
        solar = 0.0 if smu == "NIL" else float(smu)
        rows[f"{yr}-{mon}-{day}"] = (wind, solar)
    return rows


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="start", default="2025-01")
    ap.add_argument("--to", dest="end", default=dt.date.today().strftime("%Y-%m"))
    args = ap.parse_args()

    if not shutil.which("pdftotext"):
        print("error: pdftotext not found (brew install poppler)", file=sys.stderr)
        return 1

    all_rows: dict[str, tuple[float, float]] = {}
    published: list[str] = []
    missing: list[str] = []

    with tempfile.TemporaryDirectory() as tmp:
        for year, month in months(args.start, args.end):
            tag = f"{year}-{month:02d}"
            dest = Path(tmp) / f"mr10_{month:02d}{year}.pdf"
            if not fetch_pdf(year, month, dest):
                missing.append(tag)
                continue
            rows = parse_pdf(dest, year, month)
            if not rows:
                # Published but unparseable is a real problem, not a quiet skip:
                # the layout may have changed.
                print(f"warning: {tag} downloaded but no daily rows parsed", file=sys.stderr)
                missing.append(tag)
                continue
            # A published month must cover its full length; a short table means
            # a partial report and would silently understate the annualisation.
            expected = calendar.monthrange(year, month)[1]
            if len(rows) < expected:
                print(
                    f"warning: {tag} parsed {len(rows)}/{expected} days — partial report",
                    file=sys.stderr,
                )
            all_rows.update(rows)
            published.append(tag)
            tot = sum(w + s for w, s in rows.values())
            print(f"  {tag}: {len(rows)} days, {tot:.3f} GWh curtailed", file=sys.stderr)

    if not all_rows:
        print("error: no months parsed — refusing to write an empty CSV", file=sys.stderr)
        return 1

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUT_PATH.open("w") as f:
        f.write("date,wind_curtailed_gwh,solar_curtailed_gwh\n")
        for d in sorted(all_rows):
            w, s = all_rows[d]
            f.write(f"{d},{w:.4f},{s:.4f}\n")

    total = sum(w + s for w, s in all_rows.values())
    print(
        f"\nwrote {len(all_rows)} daily rows to {OUT_PATH.name}\n"
        f"  months published : {', '.join(published)}\n"
        f"  months missing   : {', '.join(missing) or 'none'}\n"
        f"  total curtailed  : {total:.3f} GWh across {len(published)} month(s)",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
