import argparse
import json
import os
import sys
import time
import urllib.request
import urllib.parse
from datetime import datetime, timezone, timedelta
import xml.etree.ElementTree as ET
from pathlib import Path
from collections import defaultdict

# Setup sys.path to allow importing from the parent directory (scripts.backfill.common)
REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
sys.path.insert(0, str(REPO_ROOT))

from scripts.backfill.common import (
    SCHEMA, write_partition, log, get_zone, RateLimiter, require_env, iter_year_months
)

STATE_DIR = REPO_ROOT / "scripts" / "backfill" / "state"

def parse_iso_duration(duration):
    """Parses PT15M, PT60M, PT1H into seconds."""
    if duration == "PT15M":
        return 15 * 60
    if duration in ("PT60M", "PT1H"):
        return 60 * 60
    # Default fallback
    return 60 * 60

def parse_entsoe_xml(xml_content):
    """
    Parses ENTSO-E XML into a list of (timestamp_dt, mw_float) pairs.
    """
    try:
        root = ET.fromstring(xml_content)
    except ET.ParseError as e:
        log(f"XML Parse Error: {e}")
        return []

    # ENTSO-E uses namespaces.
    ns_uri = root.tag.split('}')[0].strip('{') if '}' in root.tag else None
    ns = {'ns': ns_uri} if ns_uri else {}
    
    def find_all(element, path):
        if ns:
            return element.findall(f".//ns:{path.replace('/', '/ns:')}", ns)
        return element.findall(f".//{path}")

    def find_text(element, path):
        if ns:
            qualified = f"ns:{path.replace('/', '/ns:')}"
            el = element.find(qualified, ns)
        else:
            el = element.find(path)
        return el.text if el is not None else None

    points = []
    time_series_list = root.findall("ns:TimeSeries", ns) if ns else root.findall("TimeSeries")
    
    for ts in time_series_list:
        periods = ts.findall("ns:Period", ns) if ns else ts.findall("Period")
        for period in periods:
            start_str = find_text(period, "timeInterval/start")
            res_str = find_text(period, "resolution")
            
            if not start_str or not res_str:
                continue
                
            # ENTSO-E format is 2024-01-01T00:00Z
            try:
                start_dt = datetime.strptime(start_str, "%Y-%m-%dT%H:%M%z").astimezone(timezone.utc)
            except ValueError:
                # Handle potential variation in timestamp format
                start_dt = datetime.fromisoformat(start_str.replace('Z', '+00:00')).astimezone(timezone.utc)
                
            step_seconds = parse_iso_duration(res_str)
            
            point_elements = period.findall("ns:Point", ns) if ns else period.findall("Point")
            for point in point_elements:
                pos_str = find_text(point, "position")
                qty_str = find_text(point, "quantity")
                
                if pos_str is None or qty_str is None:
                    continue
                    
                pos = int(pos_str)
                qty = float(qty_str)
                
                point_dt = start_dt + timedelta(seconds=(pos - 1) * step_seconds)
                points.append((point_dt, qty))
    
    return points

def fetch_with_retry(url, limiter, max_retries=3):
    """Fetches URL with exponential backoff for 429/5xx and rate limiting."""
    backoff = [30, 120, 300]
    for i in range(max_retries + 1):
        limiter.wait()
        try:
            with urllib.request.urlopen(url) as response:
                return response.read()
        except urllib.error.HTTPError as e:
            if e.code in (401, 403):
                log(f"FATAL: HTTP {e.code} - check ENTSOE_API_TOKEN")
                sys.exit(1)
            if (e.code == 429 or 500 <= e.code < 600) and i < max_retries:
                wait_sec = backoff[i]
                log(f"HTTP {e.code} received for {url}. Retrying in {wait_sec}s... ({i+1}/{max_retries})")
                time.sleep(wait_sec)
                continue
            raise
    raise Exception(f"Failed to fetch after {max_retries} retries")

def load_state(zone_id):
    state_file = STATE_DIR / f"entsoe_{zone_id}.json"
    if state_file.exists():
        try:
            with open(state_file, 'r') as f:
                return json.load(f)
        except Exception as e:
            log(f"Warning: could not read state file: {e}")
    return {"completed_years": []}

def save_state(zone_id, year_start, year_end, completed_years):
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    state_file = STATE_DIR / f"entsoe_{zone_id}.json"
    state = {
        "zone_id": zone_id,
        "year_start": year_start,
        "year_end": year_end,
        "completed_years": sorted(list(set(completed_years))),
        "last_updated_utc": datetime.now(timezone.utc).isoformat()
    }
    with open(state_file, 'w') as f:
        json.dump(state, f, indent=2)

def main():
    parser = argparse.ArgumentParser(description="ENTSO-E backfill agent")
    parser.add_argument("zone_id", help="Zone ID from zones.json")
    parser.add_argument("year_start", type=int, help="Start year")
    parser.add_argument("year_end", type=int, help="End year")
    args = parser.parse_args()

    token = require_env("ENTSOE_API_TOKEN")
    zone = get_zone(args.zone_id)
    limiter = RateLimiter(2.0)
    
    state = load_state(args.zone_id)
    completed_years = set(state.get("completed_years", []))
    
    total_rows_all = 0
    total_files = 0
    smoke_ok_sent = False

    for year in range(args.year_start, args.year_end + 1):
        if year in completed_years:
            log(f"Skipping year {year} (already completed)")
            continue
        
        year_rows = []
        for month_start, month_end in iter_year_months(year):
            fmt = lambda d: d.strftime("%Y%m%d%H%M")

            # (hour_dt, fuel) → accumulated curtailment_gw. Multiple psr_types
            # can share a fuel label (e.g. Germany/Netherlands have B18 wind
            # offshore + B19 wind onshore, both fuel="wind"). We sum them so
            # each (ts, fuel) key is unique in the output parquet.
            hourly_fuel_gw: dict[tuple, float] = defaultdict(float)
            # Track which rates contributed per fuel so we can emit a rate_source
            # note that lists all technology rates used. For the primary
            # `rate_applied` column we record the max rate used for that fuel
            # (simplification; full breakdown lives in rate_source text).
            rate_by_fuel: dict[str, float] = defaultdict(float)
            source_notes_by_fuel: dict[str, list[str]] = defaultdict(list)

            for tech in zone.technologies:
                params = {
                    "documentType": "A75",
                    "processType": "A16",
                    "psrType": tech.psr_type,
                    "in_Domain": zone.domain,
                    "periodStart": fmt(month_start),
                    "periodEnd": fmt(month_end),
                    "securityToken": token
                }
                query_string = urllib.parse.urlencode(params)
                url = f"https://web-api.tp.entsoe.eu/api?{query_string}"

                try:
                    xml_content = fetch_with_retry(url, limiter)
                    raw_points = parse_entsoe_xml(xml_content)
                except Exception as e:
                    log(f"ERROR: Failed to fetch/parse tech {tech.psr_type} for {year}-{month_start.month}: {e}")
                    continue

                # Bucket points by hour for this tech
                per_tech_buckets = defaultdict(list)
                for dt, mw in raw_points:
                    hour_dt = dt.replace(minute=0, second=0, microsecond=0)
                    per_tech_buckets[hour_dt].append(mw)

                for hour_dt, mws in per_tech_buckets.items():
                    # Hour-alignment check: only emit if within requested month
                    if not (month_start <= hour_dt < month_end):
                        continue
                    avg_mw = sum(mws) / len(mws)
                    gw = float(avg_mw * tech.rate / 1000.0)
                    hourly_fuel_gw[(hour_dt, tech.fuel)] += gw
                    # Record the tech rate for this fuel (max is a reasonable
                    # single-value summary; rate_source text captures the mix)
                    if tech.rate > rate_by_fuel[tech.fuel]:
                        rate_by_fuel[tech.fuel] = float(tech.rate)
                if not any(src == tech.psr_type for src in source_notes_by_fuel[tech.fuel]):
                    source_notes_by_fuel[tech.fuel].append(tech.psr_type)

            # Emit one row per (hour_dt, fuel) for the month
            month_rows = []
            for (hour_dt, fuel), gw in hourly_fuel_gw.items():
                psr_list = ",".join(source_notes_by_fuel[fuel])
                month_rows.append({
                    "observation_timestamp": hour_dt.strftime("%Y-%m-%dT%H:00:00Z"),
                    "region_id": zone.region_id,
                    "curtailment_gw": gw,
                    "fuel": fuel,
                    "source": "entsoe",
                    "rate_applied": rate_by_fuel[fuel],
                    "rate_source": f"{zone.source_note} [psrTypes={psr_list}]",
                })

            if not smoke_ok_sent and month_rows:
                print(f"SMOKE_OK {args.zone_id} {year} rows={len(month_rows)}", file=sys.stderr)
                smoke_ok_sent = True

            year_rows.extend(month_rows)
        
        if year_rows:
            write_partition("entsoe", zone.region_id, year, year_rows)
            total_rows_all += len(year_rows)
            total_files += 1
        else:
            log(f"No data found for year {year}")
        
        completed_years.add(year)
        save_state(args.zone_id, args.year_start, args.year_end, completed_years)

    print(f"BACKFILL_DONE {args.zone_id} years={args.year_start}..{args.year_end} rows={total_rows_all} files={total_files}", file=sys.stderr)

if __name__ == "__main__":
    main()
