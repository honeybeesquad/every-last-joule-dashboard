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

  NB: the "1" the feed returns is the POST /exportar SUCCESS flag, not a
  geo-block sentinel — the earlier "returns 1 instead of CSV" diagnosis was
  wrong. The real obstruction is cloud-ASN filtering, which the residential
  relay sidesteps.

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
EXPORT_URL = f"{PAGE_URL}/exportar"
DOWNLOAD_URL = f"{PAGE_URL}/descargar?tipo=3"
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


def fetch_export(opener, tipo: str, fecha_ini: str, fecha_fin: str,
                 retries: int = 3) -> str:
    """Drive POST /exportar (returns "1" on success) then GET /descargar."""
    last_err = None
    for attempt in range(1, retries + 1):
        try:
            # Seed cookies from the page.
            opener.open(request.Request(PAGE_URL), timeout=30).read()
            body = parse.urlencode({
                "fechaInicial": fecha_ini,
                "fechaFinal": fecha_fin,
                "tiposEmpresa": "",
                "empresas": "",
                "tiposGeneracion": tipo,
                "central": "0",
                "parametros": "1",   # Potencia Activa (MW)
                "tipo": "3",         # CSV format
            }).encode()
            req = request.Request(EXPORT_URL, data=body, method="POST", headers={
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "X-Requested-With": "XMLHttpRequest",
                "Referer": PAGE_URL,
            })
            resp = opener.open(req, timeout=60).read().decode("utf-8", "replace").strip()
            if resp.strip('"') != "1":
                raise RuntimeError(f"/exportar returned {resp[:80]!r} (expected '1')")
            csv_req = request.Request(DOWNLOAD_URL, headers={"Referer": PAGE_URL})
            text = opener.open(csv_req, timeout=90).read().decode("utf-8", "replace")
            if len(text) < 100 or "fechahora" not in text.lower():
                raise RuntimeError(f"/descargar returned suspicious body ({len(text)} bytes)")
            return text
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
        # Trailing window ending yesterday (Peru local).
        peru_now = datetime.now(timezone.utc) + timedelta(hours=PERU_UTC_OFFSET_HOURS)
        end = peru_now.replace(tzinfo=None) - timedelta(days=1)
        start = end - timedelta(days=args.days)
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
