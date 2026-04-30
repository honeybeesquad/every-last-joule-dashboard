#!/usr/bin/env python3
"""
EIA historical-backfill agent.

Usage:
  EIA_API_KEY=... python scripts/backfill/eia/backfill_iso.py <iso_id> <year_start> <year_end>

Mirrors the per-ISO rate/respondent mapping of the live dashboard loaders
(src/data/*.json.ts). For each (iso, year, month) the script pages the
EIA Hourly Electric Grid Monitor fuel-type endpoint for wind (WND) and
solar (SUN) series, applies the calibrated rate, and emits one row per
hour per fuel into data/historical/backfill/eia_<iso>_<year>.parquet.

Stdout is silent. Progress logs go to stderr. Smoke line
`SMOKE_OK <iso> <year> rows=<n>` fires after the first month of the
first un-completed year. Final line `BACKFILL_DONE <iso> years=X..Y
rows=N files=M`.

Resume state in scripts/backfill/state/eia_<iso>.json tracks completed
years so a restart skips them.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
sys.path.insert(0, str(REPO_ROOT))

from scripts.backfill.common import (
    RateLimiter,
    iter_year_months,
    log,
    require_env,
    write_partition,
)

# Resume-state directory. Defaults to scripts/backfill/state/. Tests and
# reproducer scripts override via BACKFILL_STATE_DIR so a fresh run sees an
# empty completed_years list and re-fetches the year under test.
STATE_DIR = Path(os.environ.get("BACKFILL_STATE_DIR", str(REPO_ROOT / "scripts" / "backfill" / "state")))
API_BASE = "https://api.eia.gov/v2/electricity/rto/fuel-type-data/data/"


# ---------------------------------------------------------------------------
# Per-ISO config (mirrors live loaders in src/data/*.json.ts)
# ---------------------------------------------------------------------------
ISO_MAP: dict[str, dict] = {
    "caiso": {
        "respondent": "CISO",
        "wind_rate": 0.0425,
        "solar_rate": 0.0425,
        "share": 1.0,
        "emit_wind": True,
        "emit_solar": True,
        "rate_note": "EIA CISO hourly SUN+WND x 4.25% (CAISO 2024 curtailment ratio; src/data/caiso.json.ts)",
    },
    "ercot-west": {
        "respondent": "ERCO",
        "wind_rate": 0.0615,
        "solar_rate": 0.04,
        "share": 0.66,
        "emit_wind": True,
        "emit_solar": True,
        "rate_note": "EIA ERCO hourly WND x 6.15% + SUN x 4.0%, 66% West+Panhandle book-derived share (src/data/ercot.json.ts)",
    },
    "ercot-east": {
        "respondent": "ERCO",
        "wind_rate": 0.0615,
        "solar_rate": 0.04,
        "share": 0.34,
        "emit_wind": True,
        "emit_solar": True,
        "rate_note": "EIA ERCO hourly WND x 6.15% + SUN x 4.0%, 34% East/Central book-derived share (src/data/ercot.json.ts)",
    },
    "pjm": {
        "respondent": "PJM",
        "wind_rate": 0.02,
        "solar_rate": 0.025,
        "share": 1.0,
        "emit_wind": True,
        "emit_solar": True,
        "rate_note": "EIA PJM hourly WND x 2.0% + SUN x 2.5% (src/data/pjm.json.ts)",
    },
    "miso": {
        "respondent": "MISO",
        "wind_rate": 0.08,
        "solar_rate": 0.04,
        "share": 1.0,
        "emit_wind": True,
        "emit_solar": True,
        "rate_note": "EIA MISO hourly WND x 8.0% + SUN x 4.0% (src/data/miso.json.ts)",
    },
    "nyiso": {
        "respondent": "NYIS",
        "wind_rate": 0.03,
        "solar_rate": 0.02,
        "share": 1.0,
        "emit_wind": True,
        "emit_solar": True,
        "rate_note": "EIA NYIS hourly WND x 3.0% + SUN x 2.0% (src/data/nyiso.json.ts)",
    },
    "iso-ne": {
        "respondent": "ISNE",
        "wind_rate": 0.03,
        "solar_rate": 0.02,
        "share": 1.0,
        "emit_wind": True,
        "emit_solar": True,
        "rate_note": "EIA ISNE hourly WND x 3.0% + SUN x 2.0% (src/data/iso-ne.json.ts)",
    },
    "spp": {
        "respondent": "SWPP",
        "wind_rate": 0.04,
        "solar_rate": 0.03,
        "share": 1.0,
        "emit_wind": True,
        "emit_solar": True,
        "rate_note": "EIA SWPP hourly WND x 4.0% + SUN x 3.0% (src/data/spp.json.ts)",
    },
    "bpa": {
        "respondent": "BPAT",
        "wind_rate": 0.06,
        "solar_rate": 0.02,
        "share": 1.0,
        "emit_wind": True,
        "emit_solar": True,
        "rate_note": "EIA BPAT hourly WND x 6.0% + SUN x 2.0% (proxy for hydro-spill curtailment; src/data/bpa.json.ts)",
    },
}


def fetch_with_retry(url: str, limiter: RateLimiter, max_retries: int = 3) -> dict:
    """Fetch JSON with exponential backoff on 429/5xx. Hard-fail on 401/403."""
    backoff = [30, 120, 300]
    for attempt in range(max_retries + 1):
        limiter.wait()
        try:
            with urllib.request.urlopen(url, timeout=60) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            if e.code in (401, 403):
                log(f"FATAL: HTTP {e.code} - check EIA_API_KEY")
                sys.exit(1)
            if (e.code == 429 or 500 <= e.code < 600) and attempt < max_retries:
                wait = backoff[attempt]
                log(f"HTTP {e.code}; retrying in {wait}s ({attempt+1}/{max_retries}): {url[:120]}...")
                time.sleep(wait)
                continue
            raise
        except (urllib.error.URLError, TimeoutError) as e:
            if attempt < max_retries:
                wait = backoff[attempt]
                log(f"network error {e!r}; retrying in {wait}s ({attempt+1}/{max_retries})")
                time.sleep(wait)
                continue
            raise
    raise RuntimeError(f"fetch_with_retry exhausted: {url}")


def fetch_fueltype_month(
    api_key: str,
    respondent: str,
    fueltype: str,
    month_start: datetime,
    month_end: datetime,
    limiter: RateLimiter,
) -> list[tuple[str, float]]:
    """Return list of (iso8601_hour_start, mw) for the given month/fueltype.
    Pages through EIA's 5000-row cap via `offset`."""
    start = month_start.strftime("%Y-%m-%dT%H")
    end_last = month_end - timedelta(hours=1)
    end = end_last.strftime("%Y-%m-%dT%H")

    out: list[tuple[str, float]] = []
    offset = 0
    page_size = 5000
    while True:
        params = {
            "api_key": api_key,
            "frequency": "hourly",
            "data[0]": "value",
            "facets[respondent][]": respondent,
            "facets[fueltype][]": fueltype,
            "start": start,
            "end": end,
            "sort[0][column]": "period",
            "sort[0][direction]": "asc",
            "length": str(page_size),
            "offset": str(offset),
        }
        url = f"{API_BASE}?{urllib.parse.urlencode(params, doseq=True)}"
        payload = fetch_with_retry(url, limiter)
        rows = payload.get("response", {}).get("data", []) or []
        for r in rows:
            period = r.get("period")
            val = r.get("value")
            if period is None or val is None or val == "":
                continue
            try:
                mw = float(val)
            except (TypeError, ValueError):
                continue
            ts = f"{period}:00:00Z" if len(period) == 13 else period
            out.append((ts, mw))
        if len(rows) < page_size:
            break
        offset += len(rows)
    return out


def load_state(iso_id: str) -> dict:
    state_file = STATE_DIR / f"eia_{iso_id}.json"
    if state_file.exists():
        try:
            with open(state_file) as f:
                return json.load(f)
        except Exception as e:
            log(f"warning: could not read state file: {e}")
    return {"completed_years": []}


def save_state(iso_id: str, year_start: int, year_end: int, completed: set[int]) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    state_file = STATE_DIR / f"eia_{iso_id}.json"
    payload = {
        "iso_id": iso_id,
        "year_start": year_start,
        "year_end": year_end,
        "completed_years": sorted(completed),
        "last_updated_utc": datetime.now(timezone.utc).isoformat(),
    }
    with open(state_file, "w") as f:
        json.dump(payload, f, indent=2)


def main() -> None:
    parser = argparse.ArgumentParser(description="EIA backfill agent")
    parser.add_argument("iso_id", help="ISO id (e.g., caiso, ercot-west, pjm)")
    parser.add_argument("year_start", type=int)
    parser.add_argument("year_end", type=int)
    args = parser.parse_args()

    if args.iso_id not in ISO_MAP:
        log(f"ERROR: unknown iso_id '{args.iso_id}'. Known: {sorted(ISO_MAP.keys())}")
        sys.exit(2)

    cfg = ISO_MAP[args.iso_id]
    api_key = require_env("EIA_API_KEY")
    # EIA allows 5000 req/hr -> ~1.39/s. Use 1.3/s for headroom.
    limiter = RateLimiter(1.3)

    state = load_state(args.iso_id)
    completed = set(state.get("completed_years", []))

    total_rows = 0
    total_files = 0
    smoke_emitted = False

    for year in range(args.year_start, args.year_end + 1):
        if year in completed:
            log(f"skip {args.iso_id} {year} (already completed)")
            continue

        year_rows: list[dict] = []
        for month_start, month_end in iter_year_months(year):
            month_rows: list[dict] = []

            fuel_passes: list[tuple[str, str, float]] = []
            if cfg["emit_wind"]:
                fuel_passes.append(("WND", "wind", cfg["wind_rate"]))
            if cfg["emit_solar"]:
                fuel_passes.append(("SUN", "solar", cfg["solar_rate"]))

            for eia_fueltype, fuel_label, rate in fuel_passes:
                try:
                    pairs = fetch_fueltype_month(
                        api_key, cfg["respondent"], eia_fueltype,
                        month_start, month_end, limiter,
                    )
                except Exception as e:
                    log(f"ERROR: {args.iso_id} {year}-{month_start.month:02d} {eia_fueltype}: {e}")
                    continue

                for ts, mw in pairs:
                    if mw <= 0:
                        continue
                    curtail_gw = float(mw) * float(rate) * float(cfg["share"]) / 1000.0
                    month_rows.append({
                        "observation_timestamp": ts,
                        "region_id": args.iso_id,
                        "curtailment_gw": curtail_gw,
                        "fuel": fuel_label,
                        "source": "eia",
                        "rate_applied": float(rate) * float(cfg["share"]),
                        "rate_source": cfg["rate_note"],
                    })

            if not smoke_emitted and month_rows:
                print(f"SMOKE_OK {args.iso_id} {year} rows={len(month_rows)}", file=sys.stderr)
                smoke_emitted = True

            year_rows.extend(month_rows)

        if year_rows:
            write_partition("eia", args.iso_id, year, year_rows)
            total_rows += len(year_rows)
            total_files += 1
        else:
            log(f"no data written for {args.iso_id} {year}")

        completed.add(year)
        save_state(args.iso_id, args.year_start, args.year_end, completed)

    print(
        f"BACKFILL_DONE {args.iso_id} years={args.year_start}..{args.year_end} "
        f"rows={total_rows} files={total_files}",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
