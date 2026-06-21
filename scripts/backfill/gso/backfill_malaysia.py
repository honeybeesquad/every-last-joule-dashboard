"""
GSO Malaysia backfill agent.

Fetches solar generation data from the GSO (Grid System Operator) Malaysia
API at 10-min intervals, applies a published curtailment rate, and writes
year-partitioned Parquet files under data/historical/backfill/.

API endpoints (POST, no auth):
  - CurrentGen: https://www.gso.org.my/SystemData/CurrentGen.aspx/GetChartDataSource
  - SystemDemand: https://www.gso.org.my/SystemData/SystemDemand.aspx/GetChartDataSource
  - TieLine: https://www.gso.org.my/SystemData/TieLine.aspx/GetChartDataSource

Request body: {"Fromdate":"DD/MM/YYYY","Todate":"DD/MM/YYYY"}
Returns: {"d": "[...JSON array...]"}  (double-encoded JSON)

Generation fields: DT (ISO timestamp), Coal, Gas, CoGen, Oil, Hydro, Solar (MW)
Demand fields: DT (ISO timestamp), MW

Curtailment rate: ~0.99% derived from ~0.15 TWh/yr anchor / ~15.2 TWh/yr
estimated Peninsular Malaysia solar generation (4 GW × 19% CF).
Source: Suruhanjaya Tenaga (ST) 2024 + IRENA Malaysia 2024.

The timestamps are in Asia/Kuala_Lumpur (UTC+8). This script converts to UTC
for storage consistency.
"""

import argparse
import json
import os
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta
from pathlib import Path
from collections import defaultdict

REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
sys.path.insert(0, str(REPO_ROOT))

from scripts.backfill.common import (
    SCHEMA, write_partition, log, RateLimiter, iter_year_months
)

STATE_DIR = REPO_ROOT / "scripts" / "backfill" / "state"

# GSO API configuration
GSO_GEN_URL = "https://www.gso.org.my/SystemData/CurrentGen.aspx/GetChartDataSource"
GSO_DEMAND_URL = "https://www.gso.org.my/SystemData/SystemDemand.aspx/GetChartDataSource"

# Malaysia solar curtailment rate: 0.15 TWh/yr anchor / ~15.2 TWh/yr generation
# = ~0.0099 (~1%).  Rounded to 0.01 for simplicity.
CURTAILMENT_RATE = 0.01

# Malaysia timezone is UTC+8
MALAYSIA_TZ = timezone(timedelta(hours=8))

REGION_ID = "malaysia"
SOURCE = "gso"


def fetch_gso_json(url: str, date_str: str, limiter: RateLimiter, max_retries: int = 3) -> list[dict]:
    """Fetch GSO API data for a given date string (DD/MM/YYYY)."""
    body = json.dumps({"Fromdate": date_str, "Todate": date_str}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (ELJ-backfill/1.0)",
        },
    )

    backoff = [30, 120, 300]
    for attempt in range(max_retries + 1):
        limiter.wait()
        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                raw = json.loads(response.read().decode("utf-8"))
                # GSO double-encodes: {"d": "[...]"}
                if isinstance(raw, dict) and "d" in raw:
                    return json.loads(raw["d"])
                return raw
        except urllib.error.HTTPError as e:
            if e.code in (401, 403):
                log(f"FATAL: HTTP {e.code} on {url}")
                sys.exit(1)
            if (e.code == 429 or 500 <= e.code < 600) and attempt < max_retries:
                wait_sec = backoff[attempt]
                log(f"HTTP {e.code} for {url} date={date_str}. Retrying in {wait_sec}s... ({attempt+1}/{max_retries})")
                time.sleep(wait_sec)
                continue
            raise
        except Exception as e:
            if attempt < max_retries:
                wait_sec = backoff[attempt]
                log(f"Error for {url} date={date_str}: {e}. Retrying in {wait_sec}s... ({attempt+1}/{max_retries})")
                time.sleep(wait_sec)
                continue
            raise

    raise Exception(f"Failed to fetch {url} for {date_str} after {max_retries} retries")


def parse_gso_timestamp(dt_str: str) -> datetime:
    """Parse GSO timestamp (local Malaysia time) and convert to UTC."""
    # Format: "2026-06-18T00:00:00" (no timezone, local KL time)
    local_dt = datetime.strptime(dt_str, "%Y-%m-%dT%H:%M:%S")
    return local_dt.replace(tzinfo=MALAYSIA_TZ).astimezone(timezone.utc)


def load_state():
    state_file = STATE_DIR / "gso_malaysia.json"
    if state_file.exists():
        try:
            with open(state_file, "r") as f:
                return json.load(f)
        except Exception as e:
            log(f"Warning: could not read state file: {e}")
    return {"completed_dates": []}


def save_state(completed_dates: list[str]):
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    state_file = STATE_DIR / "gso_malaysia.json"
    state = {
        "region_id": REGION_ID,
        "source": SOURCE,
        "completed_dates": sorted(set(completed_dates)),
        "last_updated_utc": datetime.now(timezone.utc).isoformat(),
    }
    with open(state_file, "w") as f:
        json.dump(state, f, indent=2)


def date_range(start_date: datetime, end_date: datetime) -> list[str]:
    """Generate a list of date strings (DD/MM/YYYY) between start and end (inclusive)."""
    dates = []
    current = start_date
    while current <= end_date:
        dates.append(current.strftime("%d/%m/%Y"))
        current += timedelta(days=1)
    return dates


def main():
    parser = argparse.ArgumentParser(description="GSO Malaysia backfill agent")
    parser.add_argument("year_start", type=int, help="Start year")
    parser.add_argument("year_end", type=int, help="End year")
    args = parser.parse_args()

    limiter = RateLimiter(1.0)  # 1 req/s to be gentle
    state = load_state()
    completed_dates = set(state.get("completed_dates", []))

    total_rows_all = 0
    total_files = 0
    smoke_ok_sent = False

    for year in range(args.year_start, args.year_end + 1):
        year_rows: list[dict] = []

        for month_start, month_end in iter_year_months(year):
            # Generate dates for this month
            dates = date_range(month_start, month_end - timedelta(days=1))

            # Hourly curtailment buckets: (hour_utc, fuel) -> GW
            hourly_fuel_gw: dict[tuple[datetime, str], float] = defaultdict(float)

            for date_str in dates:
                date_key = f"{year}-{date_str}"
                if date_key in completed_dates:
                    continue

                try:
                    gen_data = fetch_gso_json(GSO_GEN_URL, date_str, limiter)
                except Exception as e:
                    log(f"ERROR fetching generation for {date_str}: {e}")
                    continue

                if not gen_data:
                    log(f"No generation data for {date_str}")
                    completed_dates.add(date_key)
                    continue

                # Process 10-min generation points
                for point in gen_data:
                    dt_str = point.get("DT", "")
                    solar_mw = point.get("Solar", 0)

                    if not dt_str or solar_mw is None:
                        continue

                    try:
                        dt_utc = parse_gso_timestamp(dt_str)
                    except (ValueError, TypeError):
                        continue

                    # Bucket to UTC hour
                    hour_utc = dt_utc.replace(minute=0, second=0, microsecond=0)

                    # Curtailment = generation × rate, then MW → GW
                    curtailed_gw = float(solar_mw) * CURTAILMENT_RATE / 1000.0
                    hourly_fuel_gw[(hour_utc, "solar")] += curtailed_gw / 6.0  # 6 points per hour → average

                completed_dates.add(date_key)

                if len(completed_dates) % 30 == 0:
                    save_state(list(completed_dates))

            # Emit rows for this month
            month_rows = []
            for (hour_utc, fuel), gw in sorted(hourly_fuel_gw.items()):
                month_rows.append({
                    "observation_timestamp": hour_utc.strftime("%Y-%m-%dT%H:00:00Z"),
                    "region_id": REGION_ID,
                    "curtailment_gw": round(gw, 6),
                    "fuel": fuel,
                    "source": SOURCE,
                    "rate_applied": CURTAILMENT_RATE,
                    "rate_source": f"Suruhanjaya Tenaga / IRENA Malaysia 2024 anchor ~0.15 TWh/yr solar curtailment (rate={CURTAILMENT_RATE})",
                })

            if not smoke_ok_sent and month_rows:
                print(f"SMOKE_OK {REGION_ID} {year} rows={len(month_rows)}", file=sys.stderr)
                smoke_ok_sent = True

            year_rows.extend(month_rows)

        if year_rows:
            write_partition(SOURCE, REGION_ID, year, year_rows)
            total_rows_all += len(year_rows)
            total_files += 1
        else:
            log(f"No data found for year {year}")

        save_state(list(completed_dates))

    print(f"BACKFILL_DONE {REGION_ID} years={args.year_start}..{args.year_end} rows={total_rows_all} files={total_files}", file=sys.stderr)


if __name__ == "__main__":
    main()
