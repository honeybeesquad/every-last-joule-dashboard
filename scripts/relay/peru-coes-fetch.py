#!/usr/bin/env python3
"""
peru-coes-fetch.py — Relay: fetch COES per-plant generation and emit a thin
per-plant generation-profile CSV for the Peru per-plant loader.

WHY A RELAY (not a build-time fetch):
  COES's medidoresgeneracion export (www.coes.org.pe) blocks cloud/datacenter
  source IPs (Vercel/CI builds get an empty/short response), but serves the
  full CSV to residential IPs. So we fetch from the always-on residential
  egress host (abed, NZ Starlink) and commit a thin aggregate to git; the
  dashboard loader reads the committed CSV at build time and never touches
  COES. Same pattern as Colombia hydro (data/historical/colombia-*.csv) and
  Mexico CENACE (data/historical/mexico-generacion.csv).

  CONTRACT (verified live 2026-08-19, after the 2026-08 portal redesign):
  COES replaced the old two-step flow (POST /exportar returning the literal
  success flag "1", then GET /descargar?tipo=N) with a single
  GET /Exportar?fechaInicial=..&fechaFinal=..&tiposGeneracion=..&tipo=3
  that streams the CSV directly (Content-Disposition: attachment,
  ReporteMedidores.csv). The old POST route now falls through to a full
  HTML page — that is a dead route, not a geo-block. Success is now "the
  response body is a CSV whose header row carries plant columns"; see
  ensure_export_csv(). The `central` parameter is ignored server-side
  (identical bytes for 0/1/3). Dates stay DD/MM/YYYY.

  PUBLICATION CADENCE (also changed): the redesigned portal only publishes
  COMPLETE months — a window touching the current month returns a CSV with
  a bare `fechahora` column and no plant columns. The default window
  therefore ends on the last day of the previous month (Peru local) rather
  than yesterday.

DATA HONESTY:
  COES medidoresgeneracion publishes per-plant *generation* (MW), NOT
  curtailment. There is no continuous per-plant curtailment signal in Peru
  (the COES "Energía Dejada de Inyectar" reports are sparse per-event
  approvals). The dashboard loader therefore estimates curtailment as a flat
  national-aggregate rate × generation and tags every region `estimated` /
  modelled-fallback. This script only ever emits *generation*; it never
  fabricates a curtailment number.

OUTPUT (wide CSV, one row per declared plant):
  plant_id,kind,window_start,window_end,n_readings,total_gen_mwh,h00..h23
  where h00..h23 are the mean generation (MW) in each UTC hour across the
  window, and total_gen_mwh is the plant's total generation over the window.

USAGE (on abed):
  python3 peru-coes-fetch.py --days 30 --out /tmp/peru-coes-per-plant.csv
  python3 peru-coes-fetch.py --start 01/05/2026 --end 31/05/2026 --out -

Stdlib only (no venv required). Exit 0 on success; non-zero on hard failure.
"""

from __future__ import annotations

import argparse
import csv
import io
import sys
import time
from datetime import datetime, timedelta, timezone
from http.cookiejar import CookieJar
from urllib import request, parse, error

PAGE_URL = "https://www.coes.org.pe/Portal/mediciones/medidoresgeneracion"
EXPORT_URL = f"{PAGE_URL}/Exportar"  # single GET; streams the CSV directly
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"

PERU_UTC_OFFSET_HOURS = -5  # Peru is UTC-5 year-round (no DST)
INTERVAL_HOURS = 0.25       # COES medidoresgeneracion is quarter-hourly

# COES tiposGeneracion codes
TIPO_SOLAR = "3"
TIPO_WIND = "4"

# ---------------------------------------------------------------------------
# Plant registry: which COES units roll up into which declared dashboard plant.
# Matching is by substring on the normalised (A-Z0-9 only) unit name, so block
# suffixes (-BL1/-BL2), circuit splits (_CIRCUITO_1-5) and expansion phases
# (SUNNY EXPANSIÓN, CE P LOMITAS_EXP) all aggregate into one physical plant.
# Tokens are chosen to be unambiguous against the full observed column set.
# ---------------------------------------------------------------------------
PLANTS = [
    # plant_id,            kind,     match tokens (any-of, on normalised unit)
    ("solar-sunny",        "solar",  ["SUNNY"]),
    ("solar-san-martin",   "solar",  ["SANMARTIN"]),
    ("solar-rubi",         "solar",  ["RUBI"]),
    ("solar-clemesi",      "solar",  ["CLEMESI"]),
    ("solar-intipampa",    "solar",  ["INTIPAMPA"]),
    ("solar-matarani",     "solar",  ["MATARANI"]),
    ("solar-majes",        "solar",  ["GTSMAJES"]),   # NOT GTSREPAR (Repartición)
    ("wind-punta-lomitas", "wind",   ["LOMITAS"]),
    ("wind-wayra",         "wind",   ["WAYRA"]),
    ("wind-san-juan",      "wind",   ["SANJUAN"]),
    ("wind-tres-hermanas", "wind",   ["HERMANAS"]),
    ("wind-cupisnique",    "wind",   ["CUPISNIQUE"]),
]
PLANT_KIND = {pid: kind for pid, kind, _ in PLANTS}


def normalise(unit: str) -> str:
    return "".join(ch for ch in unit.upper() if ch.isalnum())


def unit_of(header: str) -> str:
    """COES headers look like 'COMPANY S.A. -UNIT_NAME'; take the unit part."""
    idx = header.find(" -")
    return header[idx + 2:] if idx >= 0 else header


def match_plant(header: str, kind: str) -> str | None:
    norm = normalise(unit_of(header))
    for pid, pkind, tokens in PLANTS:
        if pkind != kind:
            continue
        if any(tok in norm for tok in tokens):
            return pid
    return None


def fmt_date(d: datetime) -> str:
    return d.strftime("%d/%m/%Y")


def build_opener() -> request.OpenerDirector:
    cj = CookieJar()
    op = request.build_opener(request.HTTPCookieProcessor(cj))
    op.addheaders = [("User-Agent", UA)]
    return op


def ensure_export_csv(text: str) -> str:
    """Validate a /Exportar response body and return it.

    Success contract (replaces the old "expected '1'" POST flag): the body is
    a CSV whose first line starts with `fechahora` (BOM-tolerant) and carries
    at least one plant column. The two known failure shapes are:
      - a full HTML page (the pre-redesign POST route now returns this;
        also what a removed/renamed route would return), and
      - a bare `fechahora`-only CSV, which is what the portal serves for a
        window it has not published yet (it only publishes complete months).
    """
    stripped = text.lstrip("﻿ \r\n")  # strip UTF-8 BOM + whitespace
    if stripped[:200].lstrip().lower().startswith(("<!doctype", "<html")):
        raise RuntimeError("/Exportar returned an HTML page, not CSV — "
                           "the endpoint contract has changed again")
    header = stripped.split("\n", 1)[0]
    if not header.lower().startswith("fechahora"):
        raise RuntimeError(f"/Exportar returned unrecognised body "
                           f"(first line {header[:80]!r})")
    if len(header.split(",")) < 2:
        raise RuntimeError("/Exportar returned a CSV with no plant columns — "
                           "the requested window is not published yet "
                           "(COES publishes complete months only)")
    return text


def fetch_export(opener, tipo: str, fecha_ini: str, fecha_fin: str,
                 retries: int = 3) -> str:
    """GET /Exportar — the response body IS the CSV (contract of 2026-08)."""
    last_err = None
    for attempt in range(1, retries + 1):
        try:
            query = parse.urlencode({
                "fechaInicial": fecha_ini,
                "fechaFinal": fecha_fin,
                "tiposEmpresa": "",
                "empresas": "",
                "tiposGeneracion": tipo,
                "central": "0",      # ignored server-side; kept for parity with the UI
                "parametros": "1",   # Potencia Activa (MW)
                "tipo": "3",         # CSV format
            })
            req = request.Request(f"{EXPORT_URL}?{query}", headers={
                "Referer": PAGE_URL,
            })
            text = opener.open(req, timeout=120).read().decode("utf-8", "replace")
            return ensure_export_csv(text)
        except (error.URLError, RuntimeError, TimeoutError) as e:  # noqa: PERF203
            last_err = e
            sys.stderr.write(f"[peru-coes] tipo={tipo} attempt {attempt}/{retries} failed: {e}\n")
            time.sleep(3 * attempt)
    raise RuntimeError(f"COES export failed for tipo={tipo}: {last_err}")


def parse_value(raw: str) -> float:
    raw = raw.replace(" ", "")
    if raw in ("", "-"):
        return 0.0
    try:
        v = float(raw)
        return v if v > 0 else 0.0
    except ValueError:
        return 0.0


# A published UTC day carries hundreds of thousands of MW-summed reading-units
# across all plants; an unpublished current-month day reads all-zero. Anything
# above this threshold is "published"; below it, the day is dropped so the
# zero rows don't deflate the hour-of-day averages and totals.
PUBLISHED_DAY_MIN_MW_SUM = 1000.0


def aggregate(csv_text: str, kind: str, agg: dict) -> None:
    """Accumulate per-plant UTC-hour sums/counts and total MWh into `agg`,
    skipping unpublished (all-zero) UTC days."""
    reader = csv.reader(io.StringIO(csv_text))
    rows = list(reader)
    if len(rows) < 2:
        raise RuntimeError(f"{kind} CSV has no data rows")
    header = [h.strip() for h in rows[0]]
    # Map each data column -> plant_id (skip the fechahora col 0).
    col_plant: dict[int, str] = {}
    for i in range(1, len(header)):
        pid = match_plant(header[i], kind)
        if pid:
            col_plant[i] = pid

    # Pre-parse rows once: (utc_datetime, [mw per matched col]).
    parsed: list = []
    day_sum: dict[str, float] = {}
    for r in rows[1:]:
        if not r or not r[0].strip():
            continue
        try:
            local = datetime.strptime(r[0].strip(), "%d/%m/%Y %H:%M")
        except ValueError:
            continue
        utc = local + timedelta(hours=-PERU_UTC_OFFSET_HOURS)  # local + 5h
        vals = {i: parse_value(r[i]) for i in col_plant if i < len(r)}
        parsed.append((utc, vals))
        day_sum[utc.date().isoformat()] = day_sum.get(utc.date().isoformat(), 0.0) + sum(vals.values())

    published = {d for d, s in day_sum.items() if s >= PUBLISHED_DAY_MIN_MW_SUM}
    agg.setdefault("_days", set()).update(published)

    for utc, vals in parsed:
        if utc.date().isoformat() not in published:
            continue  # drop unpublished (all-zero) day
        uh = utc.hour
        day_iso = utc.date().isoformat()
        for i, mw in vals.items():
            pid = col_plant[i]
            slot = agg.setdefault(pid, {
                "sum": [0.0] * 24, "cnt": [0] * 24, "mwh": 0.0, "n": 0,
                "days": set(),
            })
            slot["sum"][uh] += mw
            slot["cnt"][uh] += 1
            slot["mwh"] += mw * INTERVAL_HOURS
            slot["n"] += 1
            slot["days"].add(day_iso)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=30,
                    help="trailing window length in days (default 30)")
    ap.add_argument("--start", help="explicit window start DD/MM/YYYY (overrides --days)")
    ap.add_argument("--end", help="explicit window end DD/MM/YYYY (overrides --days)")
    ap.add_argument("--out", default="-", help="output CSV path, or '-' for stdout")
    args = ap.parse_args()

    if args.start and args.end:
        fecha_ini, fecha_fin = args.start, args.end
    else:
        # Trailing window ending on the last day of the PREVIOUS month (Peru
        # local): the redesigned portal (2026-08) publishes complete months
        # only, so any day in the current month comes back column-less.
        peru_now = datetime.now(timezone.utc) + timedelta(hours=PERU_UTC_OFFSET_HOURS)
        end = peru_now.replace(tzinfo=None, hour=0, minute=0, second=0,
                               microsecond=0).replace(day=1) - timedelta(days=1)
        start = end - timedelta(days=args.days - 1)
        fecha_ini, fecha_fin = fmt_date(start), fmt_date(end)

    sys.stderr.write(f"[peru-coes] window {fecha_ini} .. {fecha_fin}\n")
    opener = build_opener()
    agg: dict = {}
    solar_csv = fetch_export(opener, TIPO_SOLAR, fecha_ini, fecha_fin)
    aggregate(solar_csv, "solar", agg)
    wind_csv = fetch_export(opener, TIPO_WIND, fecha_ini, fecha_fin)
    aggregate(wind_csv, "wind", agg)

    # The committed window is the span of *published* UTC days (unpublished
    # current-month days were dropped in aggregate()).
    pub_days = sorted(agg.get("_days", set()))
    if not pub_days:
        sys.stderr.write("[peru-coes] ERROR: no published days in window\n")
        return 1
    win_start, win_end = pub_days[0], pub_days[-1]
    sys.stderr.write(f"[peru-coes] published window {win_start} .. {win_end} "
                     f"({len(pub_days)} days)\n")

    out = sys.stdout if args.out == "-" else open(args.out, "w", newline="")
    w = csv.writer(out)
    # h00..h23 = mean generation (MW) per UTC hour over published days.
    # total_gen_mwh = raw plant total over its n_days published days; the loader
    # normalises to a 30-day figure as total_gen_mwh * 30 / n_days.
    w.writerow(["plant_id", "kind", "window_start", "window_end", "n_days",
                "total_gen_mwh"] + [f"h{h:02d}" for h in range(24)])
    missing = []
    for pid, kind, _ in PLANTS:
        slot = agg.get(pid)
        if not slot or slot["n"] == 0:
            missing.append(pid)
            continue
        hourly = [round(slot["sum"][h] / slot["cnt"][h], 4) if slot["cnt"][h] else 0.0
                  for h in range(24)]
        n_days = len(slot["days"])
        w.writerow([pid, kind, win_start, win_end, n_days,
                    round(slot["mwh"], 2)] + hourly)
    if args.out != "-":
        out.close()
    if missing:
        sys.stderr.write(f"[peru-coes] WARNING: no data for {len(missing)} plant(s): "
                         f"{', '.join(missing)}\n")
    n_emitted = len(PLANTS) - len(missing)
    sys.stderr.write(f"[peru-coes] emitted {n_emitted}/{len(PLANTS)} plants\n")
    return 0 if n_emitted > 0 else 1


if __name__ == "__main__":
    sys.exit(main())
