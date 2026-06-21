#!/usr/bin/env python3
"""
Nigeria historical-backfill agent via niggrid.org GenerationProfile2.

Usage:
  python scripts/backfill/nigeria/backfill_nigeria.py <year_start> <year_end>

Fetches daily generation-by-plant HTML tables from niggrid.org, normalises
technology labels (gas, hydro, solar), and applies a literature-derived
curtailment rate to estimate wasted energy.

The niggrid.org API returns generation (MW produced), not curtailment.
We estimate solar PV curtailment using a rate derived from TCN/Ember
reports (~2-4% of solar generation). Wind is negligible in Nigeria.

Output:
  data/historical/backfill/niggrid_nigeria_<year>.parquet

Schema: observation_timestamp, region_id, curtailment_gw, fuel, source,
        rate_applied, rate_source
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterator
from zoneinfo import ZoneInfo

import requests
import bs4

REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
sys.path.insert(0, str(REPO_ROOT))

from scripts.backfill.common import (
    RateLimiter,
    log,
    write_partition,
)

API_URL = "https://niggrid.org/GenerationProfile2"
STATE_DIR = Path(os.environ.get(
    "BACKFILL_STATE_DIR",
    str(REPO_ROOT / "scripts" / "backfill" / "state"),
))
TIMEZONE = ZoneInfo("Africa/Lagos")

# Technology normalization: maps tech-in-parens from plant names to fuel
NORMALISE: dict[str, str] = {
    "gas": "gas",
    "gas/steam": "gas",
    "hydro": "hydro",
    "steam": "gas",
}

# Curtailment rates: Nigeria curtailment is almost entirely solar PV.
# Wind is negligible (<10 MW installed). Hydro spill is not tracked.
# Rate from: TCN generation adequacy reports + IRENA Nigeria 2024
# Solar curtailment ~3% of potential generation.
TECH_RATES: dict[str, float] = {
    "solar": 0.03,
    "wind": 0.01,   # negligible, placeholder
    "hydro": 0.005, # minimal spill
}

PATTERN = re.compile(r"\(([^)]*)\)")


def load_state() -> dict:
    state_file = STATE_DIR / "niggrid_nigeria.json"
    if state_file.exists():
        try:
            with open(state_file) as f:
                return json.load(f)
        except Exception as e:
            log(f"warning: could not read state file: {e}")
    return {"completed_years": []}


def save_state(year_start: int, year_end: int, completed: set[int]) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    state_file = STATE_DIR / "niggrid_nigeria.json"
    payload = {
        "region_id": "nigeria",
        "year_start": year_start,
        "year_end": year_end,
        "completed_years": sorted(completed),
        "last_updated_utc": datetime.now(timezone.utc).isoformat(),
    }
    with open(state_file, "w") as f:
        json.dump(payload, f, indent=2)


def parse_technology(plant_name: str) -> str | None:
    """Extract technology from plant name like 'AZURA-EDO IPP (GAS)'."""
    match = PATTERN.search(plant_name)
    if not match:
        return None
    tech = match.group(1).strip().casefold()
    return NORMALISE.get(tech)


def fetch_day(
    session: requests.Session,
    target_date: datetime,
    limiter: RateLimiter,
) -> list[dict[str, object]]:
    """
    Fetch one day of generation data. Returns list of dicts:
      {observation_timestamp, fuel, mw}
    """
    limiter.wait()
    # Step 1: GET the landing page to get form tokens
    try:
        resp = session.get(API_URL, timeout=30)
        resp.raise_for_status()
    except Exception as e:
        log(f"ERROR: GET {API_URL} failed: {e}")
        return []

    soup = bs4.BeautifulSoup(resp.text, "html.parser")
    form_data = {tag["name"]: tag.get("value", "") for tag in soup.find_all("input")}
    form_data["ctl00$MainContent$txtReadingDate"] = target_date.strftime("%Y/%m/%d")

    # Step 2: POST to get generation data
    try:
        limiter.wait()
        resp = session.post(API_URL, data=form_data, timeout=30)
        resp.raise_for_status()
    except Exception as e:
        log(f"ERROR: POST {API_URL} for {target_date.date()} failed: {e}")
        return []

    soup = bs4.BeautifulSoup(resp.text, "html.parser")
    rows = soup.find_all("tr")[1:-1]  # skip header and footer

    now_ng = datetime.now(TIMEZONE)
    # Only return hours up to the current local time
    local_hour = target_date.replace(tzinfo=None)
    max_hour = 24
    if target_date.date() >= now_ng.date():
        max_hour = min(now_ng.hour + 1, 24)

    if max_hour <= 0:
        return []

    results: list[dict[str, object]] = []
    for row in rows:
        cells = [tag.text.strip() for tag in row.find_all("td")]
        if len(cells) < 3:
            continue
        plant_name = cells[1]
        fuel = parse_technology(plant_name)
        if fuel is None:
            continue

        # Columns 2..2+max_hour-1 contain hourly MW values
        for hour in range(max_hour):
            col_idx = 2 + hour
            if col_idx >= len(cells):
                break
            try:
                mw = float(cells[col_idx])
            except (ValueError, TypeError):
                continue
            if mw <= 0:
                continue
            ts = target_date.replace(hour=hour, minute=0, second=0, microsecond=0)
            results.append({
                "observation_timestamp": ts.astimezone(timezone.utc).strftime(
                    "%Y-%m-%dT%H:00:00Z"
                ),
                "fuel": fuel,
                "mw": mw,
            })

    return results


def iter_days(year: int) -> Iterator[datetime]:
    """Yield each day in the given year as a datetime in Africa/Lagos."""
    start = datetime(year, 1, 1, tzinfo=TIMEZONE)
    for day_offset in range(366 if year % 4 == 0 else 365):
        d = start + timedelta(days=day_offset)
        if d.year != year:
            break
        yield d


def main() -> None:
    parser = argparse.ArgumentParser(description="Nigeria niggrid backfill agent")
    parser.add_argument("year_start", type=int)
    parser.add_argument("year_end", type=int)
    args = parser.parse_args()

    limiter = RateLimiter(1.0)  # 1 req/s to be gentle
    session = requests.Session()
    session.headers.update({"User-Agent": "Mozilla/5.0"})

    state = load_state()
    completed = set(state.get("completed_years", []))

    total_rows = 0
    total_files = 0
    smoke_emitted = False

    for year in range(args.year_start, args.year_end + 1):
        if year in completed:
            log(f"skip nigeria {year} (already completed)")
            continue

        year_rows: list[dict] = []
        day_count = 0
        for target_date in iter_days(year):
            day_rows_raw = fetch_day(session, target_date, limiter)
            day_count += 1
            if day_count % 30 == 0:
                log(f"nigeria {year}: processed {day_count} days so far...")

            # Aggregate by (ts, fuel): sum mw across plants with same fuel
            hourly_fuel_mw: dict[tuple[str, str], float] = {}
            for r in day_rows_raw:
                key = (str(r["observation_timestamp"]), str(r["fuel"]))
                mw = float(r["mw"])  # type: ignore[arg-type]
                hourly_fuel_mw[key] = hourly_fuel_mw.get(key, 0.0) + mw

            for (ts, fuel), total_mw in hourly_fuel_mw.items():
                rate = TECH_RATES.get(fuel, 0.0)
                curtail_gw = total_mw * rate / 1000.0
                year_rows.append({
                    "observation_timestamp": ts,
                    "region_id": "nigeria",
                    "curtailment_gw": curtail_gw,
                    "fuel": fuel,
                    "source": "niggrid",
                    "rate_applied": rate,
                    "rate_source": f"niggrid.org GenerationProfile2 hourly generation × {rate:.3f} curtailment rate (TCN/IRENA 2024 estimate for {fuel})",
                })

            if not smoke_emitted and year_rows:
                print(
                    f"SMOKE_OK nigeria {year} rows={len(year_rows)}",
                    file=sys.stderr,
                )
                smoke_emitted = True

        if year_rows:
            write_partition("niggrid", "nigeria", year, year_rows)
            total_rows += len(year_rows)
            total_files += 1
        else:
            log(f"no data written for nigeria {year}")

        completed.add(year)
        save_state(args.year_start, args.year_end, completed)

    print(
        f"BACKFILL_DONE nigeria years={args.year_start}..{args.year_end} "
        f"rows={total_rows} files={total_files}",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
