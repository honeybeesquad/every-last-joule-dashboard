"""
Shared helpers for all historical-backfill agents.

Every backfill script (one per source/zone) imports this module to:
  - read calibration rates from zones.json (mirrors src/data/*.json.ts)
  - apply the rate to raw generation data
  - write year-partitioned Parquet under data/historical/backfill/
  - log progress in a consistent machine-parseable format

Dispatch pattern:
  scripts/backfill/<source>/backfill_<zone>.py <year_start> <year_end>

Output:
  data/historical/backfill/<source>_<zone>_<year>.parquet
  (partitioned by year to keep individual files < 20 MB)

Schema (one row per region per UTC hour):
  observation_timestamp  str     ISO-8601 UTC of the hour start (sortable)
  region_id              str     matches RegionData.regionId
  curtailment_gw         float32 hourly curtailment in GW
  fuel                   str     "wind" | "solar" | "hydro" | "geothermal" | "flare"
  source                 str     provenance slug ("entsoe", "eia", "aemo", etc.)
  rate_applied           float32 calibration rate used (0.0 for direct-observation sources)
  rate_source            str     human-readable provenance of the rate
"""

from __future__ import annotations

import json
import os
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Iterator

try:
    import pyarrow as pa
    import pyarrow.parquet as pq
except ImportError:
    print("ERROR: pyarrow not installed. Run: pip install -r scripts/requirements.txt", file=sys.stderr)
    sys.exit(2)

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
# Output directory for partitioned Parquet files. Defaults to the in-repo
# `data/historical/backfill/` location used by the live build. Tests and
# reproducer scripts (e.g., scripts/reproduce/reproduce_2024_ercot_west.py)
# override via BACKFILL_OUTPUT_DIR so they can regenerate a partition into
# a tempdir without overwriting the committed file.
OUTPUT_DIR = Path(os.environ.get("BACKFILL_OUTPUT_DIR", str(REPO_ROOT / "data" / "historical" / "backfill")))
ZONES_FILE = Path(__file__).resolve().parent / "zones.json"


SCHEMA = pa.schema([
    pa.field("observation_timestamp", pa.string()),
    pa.field("region_id",             pa.string()),
    pa.field("curtailment_gw",        pa.float32()),
    pa.field("fuel",                  pa.string()),
    pa.field("source",                pa.string()),
    pa.field("rate_applied",          pa.float32()),
    pa.field("rate_source",           pa.string()),
])


# ---------------------------------------------------------------------------
# Rate lookup
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Technology:
    psr_type: str
    fuel: str
    rate: float


@dataclass(frozen=True)
class Zone:
    source: str
    region_id: str
    domain: str | None
    technologies: tuple[Technology, ...]
    source_note: str


def load_zones() -> dict[str, Zone]:
    """Read zones.json and index by region_id."""
    with ZONES_FILE.open() as f:
        raw = json.load(f)
    out: dict[str, Zone] = {}
    for z in raw["zones"]:
        out[z["id"]] = Zone(
            source=z["source"],
            region_id=z["id"],
            domain=z.get("domain"),
            technologies=tuple(
                Technology(t["psrType"], t["fuel"], float(t["rate"]))
                for t in z["technologies"]
            ),
            source_note=z.get("sourceNote", ""),
        )
    return out


def get_zone(region_id: str) -> Zone:
    """Fetch a single zone by region_id. Raises KeyError with a helpful hint."""
    zones = load_zones()
    if region_id not in zones:
        raise KeyError(
            f"Unknown region_id '{region_id}'. Known: {sorted(zones.keys())[:10]}..."
        )
    return zones[region_id]


# ---------------------------------------------------------------------------
# Parquet output
# ---------------------------------------------------------------------------

def write_partition(
    source: str,
    region_id: str,
    year: int,
    rows: Iterable[dict],
    *,
    append: bool = False,
) -> Path:
    """
    Write year-partitioned Parquet.

    Default is OVERWRITE (`append=False`): one call per (source, region, year)
    replaces the file entirely. Pass `append=True` only when a single run is
    intentionally making multiple passes (e.g., one technology per pass) and
    you are sure the prior passes happened within the same invocation.

    Overwrite-by-default protects against duplicates when a zone is re-run
    (smoke test + fan-out, retry after crash, etc.).

    Returns the path written.
    """
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUTPUT_DIR / f"{source}_{region_id}_{year}.parquet"

    batch = list(rows)
    if not batch:
        log(f"no rows to write for {source}/{region_id}/{year}; skipping")
        return out

    table = pa.Table.from_pylist(batch, schema=SCHEMA)

    if append and out.exists():
        existing = pq.read_table(out, schema=SCHEMA)
        table = pa.concat_tables([existing, table])

    pq.write_table(table, out, compression="snappy")
    log(f"wrote {len(batch):>7} rows to {out.name} (total {table.num_rows:,})")
    return out


# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

def log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    prog = Path(sys.argv[0]).name if sys.argv else "backfill"
    print(f"[{ts}] [{prog}] {msg}", flush=True, file=sys.stderr)


# ---------------------------------------------------------------------------
# Rate-limiting helper
# ---------------------------------------------------------------------------

class RateLimiter:
    """Simple per-second rate limiter. For ENTSO-E ~2 req/s, EIA 5000/hr ≈ 1.4/s."""

    def __init__(self, requests_per_second: float) -> None:
        self._interval = 1.0 / requests_per_second if requests_per_second > 0 else 0.0
        self._last = 0.0

    def wait(self) -> None:
        if self._interval == 0:
            return
        now = time.monotonic()
        delta = now - self._last
        if delta < self._interval:
            time.sleep(self._interval - delta)
        self._last = time.monotonic()


# ---------------------------------------------------------------------------
# Year iteration
# ---------------------------------------------------------------------------

def iter_year_months(year: int) -> Iterator[tuple[datetime, datetime]]:
    """Yields (start, end) UTC datetime pairs, one per calendar month in `year`."""
    for month in range(1, 13):
        start = datetime(year, month, 1, tzinfo=timezone.utc)
        if month == 12:
            end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
        else:
            end = datetime(year, month + 1, 1, tzinfo=timezone.utc)
        yield start, end


# ---------------------------------------------------------------------------
# Env vars for API keys (mirrors dashboard loaders)
# ---------------------------------------------------------------------------

def require_env(name: str) -> str:
    val = os.environ.get(name)
    if not val:
        log(f"ERROR: environment variable {name} is not set")
        sys.exit(3)
    return val
