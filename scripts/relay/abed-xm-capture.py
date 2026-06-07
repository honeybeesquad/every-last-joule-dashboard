#!/usr/bin/env python3
"""abed XM capture — pull Colombia XM per-plant metrics through the elj-co tunnel
into a local Parquet lake on abed.local (the always-on Colombian-egress host).

Metrics, endpoints, and response shape confirmed by the 2026-06-07 recon:
  docs/research/2026-06-07-colombia-xm-plant-level-findings.md

Response shape (validated):
  Items[]              one entry per DAY, carries {Date, HourlyEntities[]}
  HourlyEntities[]     one entry per resource (Recurso) or the system (Sistema)
  .Values              {code, Hour01..Hour24}  -- hourly values as strings

Lake layout:  <LAKE>/<metric>/<start>_<end>.parquet   (one file per fetch window)
Querying:     duckdb -c "SELECT * FROM read_parquet('<LAKE>/Gene/*.parquet')"

Idempotent: a window whose Parquet file already exists is skipped. Re-running
extends coverage without duplicating. Dedupe (if ever needed) is a query-time
DISTINCT on (metric, date, hour, code).

Egress: requires the elj-co WireGuard tunnel up (this host). XM is geo-blocked;
DNS has no record without the tunnel, so we pin the IP via dig @8.8.8.8 +
curl --resolve, with a fallback IP list (XM rotates across these).
"""
from __future__ import annotations
import argparse, datetime, json, os, subprocess, sys, time

LAKE = os.path.expanduser("~/elj-capture/lake")
HOST = "servapibi.xm.com.co"
RESOLVER = "8.8.8.8"
FALLBACK_IPS = ["190.90.250.249", "191.97.49.119", "179.1.12.119", "179.1.5.120"]
WINDOW_DAYS = 31  # XM hard cap per request

# (MetricId, url-path, Entity, units) — from the recon catalog (Type/Url authoritative)
METRICS = [
    ("Gene",         "hourly", "Recurso", "kWh"),
    ("GeneIdea",     "hourly", "Recurso", "kWh"),
    ("PrecOferDesp", "hourly", "Recurso", "COP/kWh"),
    ("PrecBolsNaci", "hourly", "Sistema", "COP/kWh"),
    ("RecoNegEner",  "hourly", "Recurso", "kWh"),
]


def resolve_ips() -> list[str]:
    ips: list[str] = []
    try:
        out = subprocess.run(
            ["dig", "+short", "@" + RESOLVER, HOST],
            capture_output=True, text=True, timeout=10,
        ).stdout
        ips = [l.strip() for l in out.splitlines() if l.strip()[:1].isdigit()]
    except Exception:
        pass
    for ip in FALLBACK_IPS:
        if ip not in ips:
            ips.append(ip)
    return ips


def fetch(metric: str, path: str, entity: str, start: str, end: str, retries: int = 2) -> dict:
    body = json.dumps({"MetricId": metric, "Entity": entity, "StartDate": start, "EndDate": end})
    last = ""
    for _ in range(retries + 1):
        for ip in resolve_ips():
            try:
                r = subprocess.run(
                    ["curl", "-s", "--resolve", f"{HOST}:443:{ip}", "-X", "POST",
                     f"https://{HOST}/{path}", "-H", "Content-Type: application/json",
                     "-d", body, "--max-time", "90"],
                    capture_output=True, text=True, timeout=120,
                )
                if r.returncode == 0 and r.stdout.strip().startswith("{"):
                    return json.loads(r.stdout)
                last = f"rc={r.returncode} out={r.stdout[:80]!r}"
            except Exception as e:  # noqa: BLE001
                last = str(e)
        time.sleep(3)
    raise RuntimeError(f"fetch failed {metric} {start}..{end}: {last}")


def parse_rows(metric: str, units: str, fallback_date: str, data: dict) -> list[tuple]:
    rows: list[tuple] = []
    for it in data.get("Items", []):
        date = (it.get("Date") or fallback_date)[:10]
        for he in it.get("HourlyEntities", []):
            V = he.get("Values", {}) or {}
            code = V.get("code") or he.get("Id") or "Sistema"
            for h in range(1, 25):
                v = V.get(f"Hour{h:02d}")
                if v in (None, ""):
                    continue
                try:
                    rows.append((metric, date, h, code, float(v), units))
                except (TypeError, ValueError):
                    continue
    return rows


def write_parquet(metric: str, rows: list[tuple], tag: str) -> str:
    import duckdb
    d = os.path.join(LAKE, metric)
    os.makedirs(d, exist_ok=True)
    path = os.path.join(d, f"{tag}.parquet")
    con = duckdb.connect()
    con.execute(
        "CREATE TABLE t(metric VARCHAR, date DATE, hour INT, code VARCHAR, value DOUBLE, units VARCHAR)"
    )
    con.executemany("INSERT INTO t VALUES (?,?,?,?,?,?)", rows)
    con.execute(f"COPY t TO '{path}' (FORMAT PARQUET)")
    con.close()
    return path


def windows(start: str, end: str):
    s = datetime.date.fromisoformat(start)
    e = datetime.date.fromisoformat(end)
    cur = s
    while cur <= e:
        w_end = min(cur + datetime.timedelta(days=WINDOW_DAYS - 1), e)
        yield cur.isoformat(), w_end.isoformat()
        cur = w_end + datetime.timedelta(days=1)


def month_bounds(ym: str, today: datetime.date) -> tuple[str, str]:
    import calendar
    y, m = int(ym[:4]), int(ym[5:7])
    last = calendar.monthrange(y, m)[1]
    start = datetime.date(y, m, 1)
    end = min(datetime.date(y, m, last), today - datetime.timedelta(days=1))
    return start.isoformat(), end.isoformat()


def capture_month(ym: str, today: datetime.date, sel) -> int:
    """Capture one calendar month into <metric>/<YYYY-MM>.parquet (force-overwrite).
    The current month's file is rewritten on each scheduled run as days settle."""
    start, end = month_bounds(ym, today)
    total = 0
    for metric, path, entity, units in METRICS:
        if sel and metric not in sel:
            continue
        data = fetch(metric, path, entity, start, end)
        rows = parse_rows(metric, units, start, data)
        if rows:
            write_parquet(metric, rows, ym)
            total += len(rows)
            print(f"{metric} {ym} ({start}..{end}): {len(rows)} rows")
        else:
            print(f"{metric} {ym}: 0 rows (no data yet)")
    print(f"==== {ym}: {total} rows into {LAKE} ====")
    return total


def main() -> int:
    today = datetime.date.today()
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--start", default=(today - datetime.timedelta(days=WINDOW_DAYS)).isoformat())
    ap.add_argument("--end", default=(today - datetime.timedelta(days=1)).isoformat())
    ap.add_argument("--metrics", default="", help="comma-separated subset of metric ids")
    ap.add_argument("--force", action="store_true", help="re-fetch windows even if the parquet exists")
    ap.add_argument("--month", default="", help='"current" or YYYY-MM: capture one month to <metric>/<YYYY-MM>.parquet (the scheduled mode)')
    a = ap.parse_args()
    sel = set(a.metrics.split(",")) if a.metrics else None

    # Scheduled mode: one stable file per metric per calendar month.
    if a.month:
        ym = today.strftime("%Y-%m") if a.month == "current" else a.month
        return 0 if capture_month(ym, today, sel) >= 0 else 1

    grand = 0
    for metric, path, entity, units in METRICS:
        if sel and metric not in sel:
            continue
        total = 0
        for ws, we in windows(a.start, a.end):
            out = os.path.join(LAKE, metric, f"{ws}_{we}.parquet")
            if os.path.exists(out) and not a.force:
                print(f"{metric} {ws}..{we}: exists, skip")
                continue
            data = fetch(metric, path, entity, ws, we)
            rows = parse_rows(metric, units, ws, data)
            if rows:
                write_parquet(metric, rows, f"{ws}_{we}")
                total += len(rows)
                print(f"{metric} {ws}..{we}: {len(rows)} rows")
            else:
                print(f"{metric} {ws}..{we}: 0 rows (no data)")
        print(f"== {metric}: {total} rows ==")
        grand += total
    print(f"==== TOTAL: {grand} rows into {LAKE} ====")
    return 0


if __name__ == "__main__":
    sys.exit(main())
