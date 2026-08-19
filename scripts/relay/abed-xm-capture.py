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

Transport reliability (scheduled `--month` mode): the elj-co tunnel is
bandwidth-limited (~27 KB/s, endpoint-limited). A single whole-month request
for `--month current` completes early in the month but starts timing out
(curl rc=28) once the window grows past roughly the first week, and then
fails identically every night for the rest of the month. To fit the slow
link, each metric's month window is split into sequential CHUNK_DAYS-sized
sub-windows (`--chunk-days`, default 7) and concatenated -- the resulting
rows are the same as a single successful whole-month request would produce.

Failure semantics for `--month` mode: chunks are fetched in date order
starting from the 1st of the month. If a chunk fails (after `fetch()`'s own
retries), fetching for THAT metric stops immediately; whatever earlier,
contiguous chunks already succeeded are still written to the metric's
Parquet file (a partial month, never a hole in the middle), and the process
exits non-zero so the operator/monitoring sees the failure. Other metrics
are unaffected -- one metric's chunk failure does not stop the remaining
metrics from being attempted. A partial run can overwrite a previously
complete file for that month with fewer rows; the non-zero exit is the
signal that a re-run or investigation is needed.
"""
from __future__ import annotations
import argparse, datetime, json, os, subprocess, sys, time

LAKE = os.path.expanduser("~/elj-capture/lake")
HOST = "servapibi.xm.com.co"
RESOLVER = "8.8.8.8"
FALLBACK_IPS = ["190.90.250.249", "191.97.49.119", "179.1.12.119", "179.1.5.120"]
WINDOW_DAYS = 31  # XM hard cap per request
CHUNK_DAYS = 7  # default sub-window size for --month mode; small enough to
                # finish over the ~27 KB/s abed<->XM tunnel before curl's
                # own --max-time cuts it off. Override with --chunk-days.

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


def windows(start: str, end: str, window_days: int = WINDOW_DAYS):
    s = datetime.date.fromisoformat(start)
    e = datetime.date.fromisoformat(end)
    cur = s
    while cur <= e:
        w_end = min(cur + datetime.timedelta(days=window_days - 1), e)
        yield cur.isoformat(), w_end.isoformat()
        cur = w_end + datetime.timedelta(days=1)


def month_bounds(ym: str, today: datetime.date) -> tuple[str, str] | None:
    """Return the (start, end) ISO-date window to capture for month `ym` as of
    `today`, or None when there is no valid window yet.

    On the 1st of any month, `today - 1 day` is still the last day of the
    *previous* month, which precedes the 1st of `ym` -- an empty window, not
    an error. Returning None lets the caller skip cleanly instead of
    computing start > end.
    """
    import calendar
    y, m = int(ym[:4]), int(ym[5:7])
    last = calendar.monthrange(y, m)[1]
    start = datetime.date(y, m, 1)
    end = min(datetime.date(y, m, last), today - datetime.timedelta(days=1))
    if start > end:
        return None
    return start.isoformat(), end.isoformat()


def capture_month(ym: str, today: datetime.date, sel, chunk_days: int = CHUNK_DAYS) -> tuple[int, bool]:
    """Capture one calendar month into <metric>/<YYYY-MM>.parquet (force-overwrite).
    The current month's file is rewritten on each scheduled run as days settle.

    Each metric's request window is split into sequential `chunk_days`-sized
    sub-windows (see module docstring for why) and fetched in date order. If
    a chunk fails for a metric, fetching stops for that metric only --
    already-fetched chunks for it are still written, other metrics are still
    attempted, and the run is reported as a failure via the returned flag.

    Returns (total_rows_written, had_failure).
    """
    bounds = month_bounds(ym, today)
    if bounds is None:
        print(f"==== {ym}: no valid window yet (1st-of-month edge case), skipping ====")
        return 0, False
    start, end = bounds

    total = 0
    had_failure = False
    for metric, path, entity, units in METRICS:
        if sel and metric not in sel:
            continue
        rows: list[tuple] = []
        metric_failed = False
        for ws, we in windows(start, end, chunk_days):
            try:
                data = fetch(metric, path, entity, ws, we)
            except RuntimeError as exc:
                print(
                    f"{metric} {ym} chunk {ws}..{we}: FAILED ({exc}); "
                    f"stopping this metric, keeping {len(rows)} already-fetched row(s)",
                    file=sys.stderr,
                )
                metric_failed = True
                had_failure = True
                break
            rows.extend(parse_rows(metric, units, ws, data))
        if rows:
            write_parquet(metric, rows, ym)
            total += len(rows)
            tag = " [PARTIAL - chunk failure, see stderr]" if metric_failed else ""
            print(f"{metric} {ym} ({start}..{end}): {len(rows)} rows{tag}")
        elif metric_failed:
            print(f"{metric} {ym}: 0 rows fetched before failure, nothing written")
        else:
            print(f"{metric} {ym}: 0 rows (no data yet)")
    tag = " (PARTIAL - one or more metrics hit a chunk failure, see stderr)" if had_failure else ""
    print(f"==== {ym}: {total} rows into {LAKE}{tag} ====")
    return total, had_failure


def main() -> int:
    today = datetime.date.today()
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--start", default=(today - datetime.timedelta(days=WINDOW_DAYS)).isoformat())
    ap.add_argument("--end", default=(today - datetime.timedelta(days=1)).isoformat())
    ap.add_argument("--metrics", default="", help="comma-separated subset of metric ids")
    ap.add_argument("--force", action="store_true", help="re-fetch windows even if the parquet exists")
    ap.add_argument("--month", default="", help='"current" or YYYY-MM: capture one month to <metric>/<YYYY-MM>.parquet (the scheduled mode)')
    ap.add_argument("--chunk-days", type=int, default=CHUNK_DAYS,
                     help=f"days per fetch sub-window in --month mode (default {CHUNK_DAYS}); "
                          "smaller values finish faster over a slow tunnel but issue more requests")
    a = ap.parse_args()
    sel = set(a.metrics.split(",")) if a.metrics else None

    # Scheduled mode: one stable file per metric per calendar month.
    if a.month:
        ym = today.strftime("%Y-%m") if a.month == "current" else a.month
        _total, had_failure = capture_month(ym, today, sel, a.chunk_days)
        return 1 if had_failure else 0

    grand = 0
    had_failure = False
    for metric, path, entity, units in METRICS:
        if sel and metric not in sel:
            continue
        total = 0
        for ws, we in windows(a.start, a.end):
            out = os.path.join(LAKE, metric, f"{ws}_{we}.parquet")
            if os.path.exists(out) and not a.force:
                print(f"{metric} {ws}..{we}: exists, skip")
                continue
            try:
                data = fetch(metric, path, entity, ws, we)
            except RuntimeError as exc:
                print(f"{metric} {ws}..{we}: FAILED ({exc}); continuing with remaining windows/metrics", file=sys.stderr)
                had_failure = True
                continue
            rows = parse_rows(metric, units, ws, data)
            if rows:
                write_parquet(metric, rows, f"{ws}_{we}")
                total += len(rows)
                print(f"{metric} {ws}..{we}: {len(rows)} rows")
            else:
                print(f"{metric} {ws}..{we}: 0 rows (no data)")
        print(f"== {metric}: {total} rows ==")
        grand += total
    tag = " (one or more windows FAILED, see stderr)" if had_failure else ""
    print(f"==== TOTAL: {grand} rows into {LAKE}{tag} ====")
    return 1 if had_failure else 0


if __name__ == "__main__":
    sys.exit(main())
