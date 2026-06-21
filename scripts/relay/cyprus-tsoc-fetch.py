#!/usr/bin/env python3
"""Cyprus TSOC relay — fetch hourly wind generation through Flaresolverr."""
from __future__ import annotations

import argparse, csv, datetime, json, os, re, sys, urllib.request

FLARESOLVERR_URL = "http://localhost:8191/v1"
WIND_URL = "https://tsoc.org.cy/electrical-system/total-daily-wind-and-solar-farm-generation/"
CANONICAL_CSV = os.path.join(
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")),
    "data", "historical", "cyprus-tsoc-wind.csv",
)
WIND_CURTAILMENT_RATE = 0.02


def flaresolverr_fetch(url: str) -> str:
    payload = json.dumps({"cmd": "request.get", "url": url, "maxTimeout": 30000}).encode()
    req = urllib.request.Request(FLARESOLVERR_URL, data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read())
    sol = data.get("solution", {})
    if sol.get("status") != 200:
        raise RuntimeError(f"Flaresolverr returned status {sol.get('status')}")
    return sol.get("response", "")


def parse_wind_table(html: str) -> list[dict]:
    points = []
    tables = re.findall(r"<table[^>]*>[\s\S]*?</table>", html, re.I | re.S)
    year = datetime.date.today().year

    for table_html in tables:
        rows = re.findall(r"<tr[^>]*>(.*?)</tr>", table_html, re.I | re.S)
        if len(rows) < 3:
            continue

        first = re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", rows[0], re.I | re.S)
        first = [re.sub(r"<[^>]+>", "", c).strip() for c in first]
        is_machine = bool(first and "Timestamp" in first[0])
        is_human = bool(first and len(first[0]) > 1 and not first[0].isascii())
        if not (is_machine or is_human):
            continue

        for row_html in rows:
            cells = re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row_html, re.I | re.S)
            cells = [re.sub(r"<[^>]+>", "", c).strip() for c in cells]
            if len(cells) < 2:
                continue
            if cells[0] in ("Timestamp", "Ώρα", "Ωρα", "Ώ"):
                continue

            ts_raw = cells[0].strip()
            try:
                if is_machine:
                    dt = datetime.datetime.strptime(ts_raw, "%Y-%m-%d %H:%M:%S")
                else:
                    parts = ts_raw.split(",")
                    dp, tp = parts[0].strip(), parts[1].strip()
                    ds, ms = dp.split("/")
                    hs = tp.split(":")[0]
                    mi = tp.split(":")[1] if ":" in tp else "00"
                    dt = datetime.datetime(int(year), int(ms), int(ds), int(hs), int(mi))
            except (ValueError, IndexError):
                continue

            wind = cells[1].replace(",", ".")
            if not wind:
                continue
            wind_mw = float(wind)

            curt_mw = wind_mw * WIND_CURTAILMENT_RATE
            local = dt.replace(tzinfo=datetime.timezone(datetime.timedelta(hours=3)))
            utc_ts = local.astimezone(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

            points.append({"utc_timestamp": utc_ts, "wind_mw": wind_mw, "curtailment_mw": round(curt_mw, 4)})

    return points


def load_existing(path: str) -> set[str]:
    if not os.path.exists(path):
        return set()
    seen = set()
    with open(path, "r", newline="") as f:
        reader = csv.reader(f)
        next(reader, None)
        for row in reader:
            if row:
                seen.add(row[0])
    return seen


def append_csv(path: str, points: list[dict], existing: set[str]) -> int:
    new = [p for p in points if p["utc_timestamp"] not in existing]
    if not new:
        return 0
    os.makedirs(os.path.dirname(path), exist_ok=True)
    write_header = not os.path.exists(path)
    with open(path, "a", newline="") as f:
        w = csv.writer(f)
        if write_header:
            w.writerow(["utc_timestamp", "wind_mw", "curtailment_mw"])
        for p in new:
            w.writerow([p["utc_timestamp"], p["wind_mw"], p["curtailment_mw"]])
    return len(new)


def main():
    parser = argparse.ArgumentParser(description="Cyprus TSOC wind relay")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    print("[relay] Cyprus TSOC — fetching wind generation data")
    try:
        html = flaresolverr_fetch(WIND_URL)
        print(f"[relay] Got {len(html)} bytes from TSOC")

        points = parse_wind_table(html)
        print(f"[relay] Parsed {len(points)} wind data points")

        if args.dry_run:
            print(f"[relay] DRY RUN — would write {len(points)} rows")
            if points:
                print(f"[relay] First: {points[0]}")
                print(f"[relay] Last: {points[-1]}")
            return

        existing = load_existing(CANONICAL_CSV)
        n = append_csv(CANONICAL_CSV, points, existing)
        print(f"[relay] Appended {n} new rows ({len(existing)} already present)")

    except Exception as e:
        print(f"[relay] FAILED: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
