#!/usr/bin/env python3
"""Build Grid-India NLDC REMC daily VRE curtailment CSVs.

Grid-India publishes one NLDC REMC daily PDF per operating day (FileType
DAILY_VRE_REPORT on webapi.grid-india.in). The first table — "VRE Curtailment
Details due to real time system constraints" — is RE State / ISTS station
operational curtailment in MU. 1 MU = 1 GWh.

This is genuinely measured operator data. It is NOT a live feed: the PDFs
publish daily in arrears, the CDN is TLS-reset from outside India, and the
table is a daily energy total with no hourly shape. Regions that use it land
at T2-annual-calibrated, not T1.

Two table layouts exist in the series:

  2025-01 → 2025-05: Wind MU, Solar MU, Wind MW, Solar MW  (times in hh:mm)
  2025-06 → present: Wind MW, Wind MU, Solar MW, Solar MU

The parser detects the layout from the section header. It does not read the
second table (Emergency TRAS Down) — those rows are often MW with 0 MU and
are not curtailment energy.

RE State English names map to dashboard region ids. ISTS pooling-station
rows are kept on the long CSV as entity_kind=ists_station and must not be
summed into a state.

Do not use this series as a national india-grid-india total on top of
Maharashtra MSLDC or a Rajasthan SLDC floor — the globe sums regions.

The Grid-India CDN (webcdn.grid-india.in) TLS-resets from NZ. Fetch from an
Indian IP (Bangalore relay). Parse of a local PDF/text dir works anywhere.

    python3 scripts/fetch-nldc-remc-vre.py --text-dir /tmp/nldc-texts
    python3 scripts/fetch-nldc-remc-vre.py --pdf-dir /tmp/nldc-pdfs
    python3 scripts/fetch-nldc-remc-vre.py --fetch --pdf-dir /tmp/nldc-pdfs

Requires `pdftotext` (poppler-utils) unless --text-dir is used.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import ssl
import subprocess
import sys
import urllib.error
import urllib.request
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LONG_OUT = ROOT / "data/historical/india-nldc-remc-vre-daily.csv"
STATE_OUT = ROOT / "data/historical/india-gujarat-nldc-curtailed-daily.csv"

API_URL = "https://webapi.grid-india.in/api/v1/file"
CDN = "https://webcdn.grid-india.in/"
MANIFEST_BODY = {"_source": "grdw", "_type": "DAILY_VRE_REPORT"}

# Dashboard region ids. Aliases match the English name after the slash.
STATE_ALIASES = {
    "Rajasthan": "india-rajasthan",
    "Gujarat": "india-gujarat",
    "Maharashtra": "india-maharashtra",
    "Madhya Pradesh": "india-madhya-pradesh",
    "Chattisgarh": "india-chhattisgarh",
    "Chhattisgarh": "india-chhattisgarh",
    "Andhra Pradesh": "india-andhra-pradesh",
    "Karnataka": "india-karnataka",
    "Kerala": "india-kerala",
    "Tamil Nadu": "india-tamil-nadu",
    "Telengana": "india-telangana",
    "Telangana": "india-telangana",
    "UP": "india-uttar-pradesh",
    "Uttar Pradesh": "india-uttar-pradesh",
    "Punjab": "india-punjab",
    "Haryana": "india-haryana",
    "Odisha": "india-odisha",
    "Orissa": "india-odisha",
    "Himachal Pradesh": "india-himachal-pradesh",
    "Uttarakhand": "india-uttarakhand",
    "Assam": "india-assam",
    "West Bengal": "india-east",
    "Bihar": "india-east",
    "Jharkhand": "india-east",
    "Sikkim": "india-east",
}

# Only Gujarat is promoted off this series. Maharashtra stays on MSLDC;
# Rajasthan's RRVPNL floor is a separate source; NLDC zeros for other
# states are not treated as complete SLDC coverage.
PROMOTED_STATES = {"india-gujarat": STATE_OUT}

SKIP_NAMES = {
    "region", "state", "ists", "solar", "wind", "mw", "mus", "state or",
    "wind curtailment", "solar curtailment", "re pooling station",
    "reason for curtailnment", "reason for curtailment", "max mw",
    "connected generating", "station / state", "total", "sum",
}

DATE_RE = re.compile(r"^(\d{2})\.(\d{2})\.(\d{4})_NLDC_REMC_REPORT")
# English name after the last slash, then four numbers. 2025 H1 rows are
# MU/MU/MW/MW; 2025-06 onward are MW/MU/MW/MU. Layout is applied after.
ROW_RE = re.compile(
    r"/\s*([A-Za-z][A-Za-z0-9_() .+-]*?[A-Za-z0-9)])\s+"
    r"([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)"
)
START_MARKERS = ("VRE Curtailment Details", "VRE Curtailment")
STOP_MARKERS = (
    "Emergency TRAS Down",
    "TRAS Down in VRE",
    "TRAS Down in Wind",
    "टीआरएएस ड उन",
)

# Energy cannot exceed MW × 24 h. Slack covers rounding and the 2025
# "MW with a short duration" rows.
MW_HOUR_SLACK = 1.15


def date_from_name(name: str) -> str | None:
    m = DATE_RE.match(Path(name).name)
    if not m:
        return None
    d, mo, y = m.groups()
    return f"{y}-{mo}-{d}"


def slice_table(text: str) -> str | None:
    start = -1
    for marker in START_MARKERS:
        i = text.find(marker)
        if i >= 0:
            start = i
            break
    if start < 0:
        return None
    stop = len(text)
    for marker in STOP_MARKERS:
        j = text.find(marker, start + 20)
        if j >= 0:
            stop = min(stop, j)
    if stop == len(text):
        t = text.find("Total Curtailment", start)
        if t >= 0:
            nl = text.find("\n", t)
            stop = (nl if nl > 0 else t) + 1
    return text[start:stop]


def detect_layout(section: str) -> str:
    """Return 'mu_mw' (2025 H1) or 'mw_mu' (2025-06 onward)."""
    head = section[:2500]
    if "hh:mm" in head or "Time (hh:mm)" in head or "समय (घ" in head:
        return "mu_mw"
    return "mw_mu"


def plausible(mw: float, gwh: float) -> bool:
    if mw < 0 or gwh < 0:
        return False
    if mw == 0:
        return gwh <= 0.05
    return gwh <= mw * 24 / 1000 * MW_HOUR_SLACK + 0.05


def map_four(a: float, b: float, c: float, d: float, layout: str) -> tuple[float, float, float, float] | None:
    if layout == "mu_mw":
        wmu, smu, wmw, smw = a, b, c, d
    else:
        wmw, wmu, smw, smu = a, b, c, d
    if wmw > 20000 or smw > 20000 or wmu > 80 or smu > 80:
        return None
    if not plausible(wmw, wmu) or not plausible(smw, smu):
        return None
    return wmw, wmu, smw, smu


def parse_section(section: str) -> list[tuple[str, float, float, float, float]]:
    layout = detect_layout(section)
    flat = re.sub(r"\s+", " ", section)
    rows = []
    for m in ROW_RE.finditer(flat):
        name = re.sub(r"\s+", " ", m.group(1)).strip(" .")
        if name.lower() in SKIP_NAMES or name.lower().startswith("reason"):
            continue
        try:
            a, b, c, d = (float(m.group(i)) for i in range(2, 6))
        except ValueError:
            continue
        parsed = map_four(a, b, c, d, layout)
        if parsed is None:
            continue
        wmw, wmu, smw, smu = parsed
        rows.append((name, wmw, wmu, smw, smu))
    return rows


def read_text(path: Path) -> str:
    if path.suffix.lower() == ".txt":
        return path.read_text(errors="replace")
    return subprocess.run(
        ["pdftotext", "-layout", str(path), "-"],
        capture_output=True, text=True, check=True, timeout=60,
    ).stdout


def parse_file(path: Path) -> tuple[str | None, list[tuple[str, float, float, float, float]], str]:
    date = date_from_name(path.name)
    try:
        text = read_text(path)
    except Exception as e:
        return date, [], f"read:{e}"
    section = slice_table(text)
    if not section:
        return date, [], "no-table"
    rows = parse_section(section)
    if not rows:
        return date, [], "no-rows"
    return date, rows, "ok"


def ssl_ctx() -> ssl.SSLContext:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


def fetch_manifest() -> list[dict]:
    req = urllib.request.Request(
        API_URL,
        data=json.dumps(MANIFEST_BODY).encode(),
        headers={"User-Agent": "every-last-joule-dashboard/relay", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60, context=ssl_ctx()) as resp:
        payload = json.loads(resp.read().decode())
    rows = payload if isinstance(payload, list) else payload.get("data") or payload.get("result") or []
    if not rows:
        raise SystemExit(f"empty Grid-India manifest: keys={list(payload)[:8] if isinstance(payload, dict) else type(payload)}")
    return rows


def fetch_pdfs(dest: Path) -> int:
    dest.mkdir(parents=True, exist_ok=True)
    rows = fetch_manifest()
    ok = skip = fail = 0
    for r in rows:
        rel = r.get("FilePath") or r.get("filePath") or ""
        if not rel:
            fail += 1
            continue
        name = Path(rel).name
        out = dest / name
        if out.exists() and out.stat().st_size > 20_000:
            skip += 1
            continue
        req = urllib.request.Request(CDN + rel, headers={"User-Agent": "every-last-joule-dashboard/relay"})
        try:
            with urllib.request.urlopen(req, timeout=60, context=ssl_ctx()) as resp:
                body = resp.read()
        except urllib.error.HTTPError as e:
            print(f"FAIL {e.code} {name}", file=sys.stderr)
            fail += 1
            continue
        if not body.startswith(b"%PDF"):
            print(f"FAIL not-pdf {name}", file=sys.stderr)
            fail += 1
            continue
        out.write_bytes(body)
        ok += 1
    print(f"fetch ok={ok} skip={skip} fail={fail} manifest={len(rows)}", file=sys.stderr)
    return fail


def write_csvs(out_rows: list[dict]) -> None:
    LONG_OUT.parent.mkdir(parents=True, exist_ok=True)
    fields = [
        "date", "layout", "entity_kind", "entity_name", "region_id",
        "wind_max_mw", "wind_curtailed_gwh", "solar_max_mw", "solar_curtailed_gwh",
    ]
    with LONG_OUT.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(sorted(out_rows, key=lambda r: (r["date"], r["entity_kind"], r["entity_name"])))

    for region_id, path in PROMOTED_STATES.items():
        daily: dict[str, tuple[float, float]] = {}
        for r in out_rows:
            if r["entity_kind"] != "re_state" or r["region_id"] != region_id:
                continue
            d = r["date"]
            wind, solar = float(r["wind_curtailed_gwh"]), float(r["solar_curtailed_gwh"])
            if d in daily:
                # Duplicate PDF for the same operating day — keep the first.
                continue
            daily[d] = (wind, solar)
        with path.open("w", newline="") as f:
            f.write("date,wind_curtailed_gwh,solar_curtailed_gwh\n")
            for d in sorted(daily):
                w, s = daily[d]
                f.write(f"{d},{w:.4f},{s:.4f}\n")
        tot = sum(w + s for w, s in daily.values())
        print(f"wrote {len(daily)} {region_id} days, {tot:.3f} GWh → {path.name}", file=sys.stderr)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--fetch", action="store_true", help="download PDFs from Grid-India (India IP required)")
    ap.add_argument("--pdf-dir", type=Path, default=None)
    ap.add_argument("--text-dir", type=Path, default=None)
    args = ap.parse_args()

    if args.fetch:
        if args.pdf_dir is None:
            print("error: --fetch requires --pdf-dir", file=sys.stderr)
            return 1
        if fetch_pdfs(args.pdf_dir):
            print("warning: some PDF downloads failed", file=sys.stderr)

    sources: list[Path] = []
    if args.text_dir:
        sources = sorted(args.text_dir.glob("*.txt"))
    elif args.pdf_dir:
        sources = sorted(args.pdf_dir.glob("*.pdf"))
    else:
        print("error: need --text-dir or --pdf-dir", file=sys.stderr)
        return 1
    if not sources:
        print("error: no input files", file=sys.stderr)
        return 1

    stats: dict[str, int] = defaultdict(int)
    out_rows: list[dict] = []
    seen_date_entity: set[tuple[str, str]] = set()
    layouts: dict[str, int] = defaultdict(int)

    for i, path in enumerate(sources, 1):
        date, rows, status = parse_file(path)
        stats[status] += 1
        if status != "ok" or not date:
            if status != "ok":
                print(f"WARN {path.name} {status}", file=sys.stderr)
            continue
        layout = detect_layout(slice_table(read_text(path)) or "")
        layouts[layout] += 1
        for name, wmw, wmu, smw, smu in rows:
            key = (date, name)
            if key in seen_date_entity:
                continue
            seen_date_entity.add(key)
            rid = STATE_ALIASES.get(name, "")
            out_rows.append({
                "date": date,
                "layout": layout,
                "entity_kind": "re_state" if rid else "ists_station",
                "entity_name": name,
                "region_id": rid,
                "wind_max_mw": f"{wmw:g}",
                "wind_curtailed_gwh": f"{wmu:.4f}",
                "solar_max_mw": f"{smw:g}",
                "solar_curtailed_gwh": f"{smu:.4f}",
            })
        if i % 50 == 0:
            print(f"progress {i}/{len(sources)} ok={stats['ok']}", file=sys.stderr)

    if not out_rows:
        print("error: no rows parsed", file=sys.stderr)
        return 1

    write_csvs(out_rows)
    print(f"STATS {dict(stats)} layouts {dict(layouts)} long_rows {len(out_rows)}", file=sys.stderr)

    by: dict[str, dict] = defaultdict(lambda: {"days": set(), "wind": 0.0, "solar": 0.0, "nz": 0})
    for r in out_rows:
        if r["entity_kind"] != "re_state" or not r["region_id"]:
            continue
        rec = by[r["region_id"]]
        rec["days"].add(r["date"])
        w, s = float(r["wind_curtailed_gwh"]), float(r["solar_curtailed_gwh"])
        rec["wind"] += w
        rec["solar"] += s
        if w + s > 0:
            rec["nz"] += 1
    print("STATE_TOTALS (MU=GWh)", file=sys.stderr)
    for rid, rec in sorted(by.items()):
        nd = len(rec["days"])
        tot = rec["wind"] + rec["solar"]
        ann = tot * 365 / nd if nd else 0
        print(
            f"  {rid:24s} days={nd:4d} nz={rec['nz']:4d}  "
            f"wind={rec['wind']:.3f} solar={rec['solar']:.3f} tot={tot:.3f} GWh  "
            f"ann={ann:.1f} GWh/yr",
            file=sys.stderr,
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
