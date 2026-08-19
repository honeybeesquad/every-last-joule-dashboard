#!/usr/bin/env python3
"""
Append the deployed dashboard's current region records to the rolling
Parquet history file.

Called by .github/workflows/history-append.yml after each successful data
refresh. Fetches the live dashboard's hashed data payloads (the same
traversal .github/workflows/health-check.yml already performs) and appends
one row per region record to data/historical/curtailment_history.parquet.

Why the deployed dashboard, not the committed corpus
------------------------------------------------------
Earlier versions of this script read every data/snapshots/last-good/*.json
file in the repo. That directory is a committed fallback corpus, refreshed
only when someone commits new snapshot JSON — it is NOT the live dashboard
output, which is rebuilt from real upstream fetches on every scheduled
Vercel deploy but never written back to the repo. Because
.github/workflows/data-refresh.yml only pings a Vercel deploy hook, the
committed corpus can go stale for weeks while production stays live. Reading
it here silently re-stamped stale data with a fresh build_timestamp on every
run: 854 builds between 2026-04-23 and 2026-08-19 produced only 35 distinct
global totals, with byte-identical figures for 139 consecutive builds
(2026-08-03 → 2026-08-19) and a separate 37-day flat stretch
(2026-06-25 → 2026-08-01). See docs/paper/every-last-joule-scientific-data-draft.md
§3.2 and dataset/SCHEMA.md for the full accounting.

Schema
------
build_timestamp     str     ISO-8601 UTC of this run (sortable)
region_id           str     matches RegionData.regionId
peak_gw             float32 current 30-day peak GW
total_twh_30d       float32 current 30-day curtailment TWh
source_status       str     "live" | "cached" | "degraded" | null
last_updated        str     calibration date (YYYY, YYYY-Q#, or ISO)
last_success_at     str     ISO-8601 UTC of last successful snapshot refresh
confidence_tier     str     "T1a-live-tso" | "T1b-live-domestic-anchored" |
                            "T1c-live-neighbour-anchored" |
                            "T2-annual-calibrated" | "T3-modelled" |
                            "T4-structural-gap" | null
                            (see src/lib/uncertainty.ts + docs/methodology/uncertainty.md)
uncertainty_low_gw  float32 lower bound on peak_gw (GW). Clamped to 0.
uncertainty_high_gw float32 upper bound on peak_gw (GW). Always ≥ peak_gw.
capture_source      str     "committed-snapshot" | "deployed-build" | null.
                            "committed-snapshot" marks every row written by
                            the pre-cutover version of this script (all
                            209,400 rows through 2026-08-19, backfilled by
                            scripts/backfill_capture_source.py). "deployed-build"
                            marks every row this version writes.
profile_h00..h23    float32 24 hourly average GW values (UTC)

Historical rows written before the S2 uncertainty sprint (2026-04-24) will
have null values in the three uncertainty columns; pyarrow's
`concat_tables(promote_options="default")` fills them automatically when
the older partition is read back without the new schema.
"""

from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

try:
    import pyarrow as pa
    import pyarrow.parquet as pq
except ImportError:
    print("ERROR: pyarrow not installed. Run: pip install pyarrow", file=sys.stderr)
    sys.exit(1)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
REPO_ROOT = Path(__file__).parent.parent
HISTORY_FILE = REPO_ROOT / "data" / "historical" / "curtailment_history.parquet"

# Non-region payloads to skip if a deployed record ever carries one of these
# ids (defensive parity with the old filename-based skip list; in practice
# the "anchor" and "cbeci" payloads do not shape-match is_region_record and
# are already excluded by region_records() below).
SKIP_IDS = {"cbeci", "anchor"}

# ---------------------------------------------------------------------------
# Deployed-dashboard fetch
# ---------------------------------------------------------------------------
# Base URL of the deployed dashboard. Overridable so tests and manual runs
# can point at a preview deployment or a local server instead of prod.
DEFAULT_DASHBOARD_URL = "https://everylastjoule.com"

# Matches hashed asset paths like "data/caiso-wind.9c1a2b3d.json" embedded in
# the dashboard's built HTML — the same regex health-check.yml uses.
_MANIFEST_RE = re.compile(r"data/[a-z0-9-]+\.[a-f0-9]+\.json")

# ---------------------------------------------------------------------------
# CRITICAL GUARD — do not relax without re-reading the incident this fixes.
# ---------------------------------------------------------------------------
# A fetch that returns too little must abort loudly, not fall back to the
# committed data/snapshots/last-good/ corpus. That silent fallback is
# exactly what produced 854 builds of phantom history (see module docstring
# and docs/paper/every-last-joule-scientific-data-draft.md §3.2): the old
# script never noticed the corpus had frozen because "some rows" always
# looked like a successful run.
#
# Thresholds are set well below the real, currently-observed numbers so a
# partial degradation (a broken build, a CDN hiccup, a truncated manifest)
# trips the guard long before the count could plausibly be mistaken for a
# healthy run:
#   - MIN_MANIFEST_FILES = 100   (observed 137 hashed data/*.json paths in
#     the deployed HTML on 2026-08-19; the build has never been this thin)
#   - MIN_REGION_RECORDS = 400   (observed 447 raw region records across
#     those 137 payloads on 2026-08-19, but only 446 DISTINCT regionIds —
#     "jordan" is served by both data/jordan.<hash>.json and
#     data/statics.<hash>.json, so a naive count double-writes it every
#     build. fetch_deployed_regions() de-duplicates on regionId, last
#     wins, and logs the collision to stderr BEFORE this guard ever sees
#     the count — see the de-duplication block there. That ordering is
#     load-bearing: this guard must always count de-duplicated records, so
#     it can never be satisfied by duplicates padding the total. 446
#     distinct still clears 400 comfortably, against 461 canonical entries
#     in src/lib/regions.ts — some regions share multi-region payload
#     files, and a handful of per-plant sub-records add to the count)
MIN_MANIFEST_FILES = 100
MIN_REGION_RECORDS = 400


class DeployedFetchError(RuntimeError):
    """Raised when the deployed-dashboard fetch fails or looks incomplete.

    main() catches this, prints the reason, and exits non-zero WITHOUT
    writing to HISTORY_FILE — see the CRITICAL GUARD comment above.
    """


def _http_get(url: str, timeout: int = 30) -> bytes:
    """Thin wrapper around urllib so tests can monkeypatch a single seam."""
    with urllib.request.urlopen(url, timeout=timeout) as resp:  # noqa: S310
        return resp.read()


def is_region_record(value: object) -> bool:
    """A payload (or a value inside a dict-of-regions payload) is a region
    record if it has a string regionId and a list profile. Mirrors
    .github/workflows/health-check.yml::is_region_record.
    """
    return (
        isinstance(value, dict)
        and isinstance(value.get("regionId"), str)
        and isinstance(value.get("profile"), list)
    )


def region_records(payload: object) -> list[dict]:
    """Extract every region record from a fetched JSON payload.

    A payload is either a single region record, or a dict mapping ids to
    region records (the six multi-region loaders: aemo, brazil-ne, entsoe,
    ercot, ercot-native, norway — plus per-plant payloads such as
    aemo-per-plant / peru-per-plant). Mirrors
    .github/workflows/health-check.yml::region_records.
    """
    if is_region_record(payload):
        return [payload]
    if isinstance(payload, dict):
        return [v for v in payload.values() if is_region_record(v)]
    return []


def fetch_manifest_paths(base_url: str) -> list[str]:
    """GET the dashboard root and extract the hashed data/*.json asset
    paths referenced by the current build.
    """
    cb = int(datetime.now(timezone.utc).timestamp())
    index_url = f"{base_url}/?cb={cb}"
    try:
        html = _http_get(index_url).decode("utf-8", errors="replace")
    except (urllib.error.URLError, OSError, TimeoutError) as exc:
        raise DeployedFetchError(
            f"failed to fetch dashboard index at {index_url}: {exc}"
        ) from exc
    return sorted(set(_MANIFEST_RE.findall(html)))


def _profile_length(record: dict) -> int | str:
    """Length of a record's profile for logging; "n/a" if it isn't a list."""
    profile = record.get("profile")
    return len(profile) if isinstance(profile, list) else "n/a"


def _has_valid_profile(record: dict) -> bool:
    """A region record is only usable if its profile is exactly 24 hourly
    points. is_region_record() only requires a list (any length, including
    empty), and _make_row() zero-fills missing hours — so a loader that
    ever emits `profile: []` would otherwise land 24 zeros in the archive,
    stamped "deployed-build" with a current timestamp, indistinguishable
    from a genuine measured zero. That is the fresh-stamped-zeros failure
    mode STATUS.md documents for WACM. Restores the check the old
    (committed-snapshot) build_rows used to make.
    """
    profile = record.get("profile")
    return isinstance(profile, list) and len(profile) == 24


def fetch_deployed_regions(base_url: str) -> tuple[list[str], list[tuple[str, dict]]]:
    """Fetch every region record currently served by the deployed dashboard.

    Returns (manifest_paths, [(region_id, record), ...]). The returned
    records are already filtered and de-duplicated:

    - Records whose profile is not exactly 24 points are skipped (see
      _has_valid_profile) and logged to stderr with the region id and the
      length seen.
    - Records are de-duplicated on regionId, LAST WINS. Some regions are
      served by more than one payload file in the same build — e.g.
      "jordan" appears in both data/jordan.<hash>.json and
      data/statics.<hash>.json — and without de-duplication every such
      region writes two rows per build, breaking the "one row per region
      per build" contract documented in dataset/SCHEMA.md. Paths are
      walked in sorted order (see fetch_manifest_paths), so "last wins"
      favours whichever payload path sorts last alphabetically. Every
      collision is logged to stderr naming the region id and both payload
      paths, so a future duplicate is visible rather than silent.

    This filtering happens here, before the caller (build_rows) applies
    the MIN_MANIFEST_FILES / MIN_REGION_RECORDS size guard, so that guard
    always counts usable, de-duplicated records — it can never be
    satisfied by duplicate or malformed rows padding the total.
    """
    paths = fetch_manifest_paths(base_url)

    kept: dict[str, dict] = {}       # region_id -> record actually kept
    kept_at: dict[str, str] = {}     # region_id -> path that supplied it

    for path in paths:
        file_url = f"{base_url}/_file/{path}"
        try:
            payload = json.loads(_http_get(file_url).decode("utf-8"))
        except Exception as exc:  # noqa: BLE001 — one bad file shouldn't abort the run
            print(f"  warn: failed to fetch {path}: {exc}", file=sys.stderr)
            continue
        for record in region_records(payload):
            region_id = record["regionId"]

            if not _has_valid_profile(record):
                print(
                    f"  warn: skipping region {region_id!r}: profile has "
                    f"{_profile_length(record)} points, expected 24 "
                    f"({path})",
                    file=sys.stderr,
                )
                continue

            if region_id in kept:
                print(
                    f"  warn: duplicate regionId {region_id!r} served by "
                    f"both {kept_at[region_id]} and {path}; keeping the "
                    f"record from {path} (last wins)",
                    file=sys.stderr,
                )

            kept[region_id] = record
            kept_at[region_id] = path

    records = [(region_id, record) for region_id, record in kept.items()]
    return paths, records


# ---------------------------------------------------------------------------
# Uncertainty tier derivation (mirrors src/lib/uncertainty.ts::deriveTier)
# ---------------------------------------------------------------------------
# Keep this in lock-step with the TypeScript module. The tests in
# tests/uncertainty.test.ts anchor the TS side; this Python side is audited by
# eye against that file whenever either changes.
#
# Fraction ± applied to peakGW when an observed std is unavailable.
TIER_DEFAULT_FRACTION: dict[str, float] = {
    "T1-live-TSO":          0.15,
    "T1a-live-tso":         0.15,
    "T1b-live-domestic-anchored": 0.50,
    "T1c-live-neighbour-anchored": 0.355,
    "T2-annual-calibrated": 0.20,
    "T3-modelled":          0.40,
    "T4-structural-gap":    0.00,
}

REGION_TIER_TO_CONFIDENCE_TIER: dict[str, str] = {
    "live": "T1a-live-tso",
    "live-domestic-anchored": "T1b-live-domestic-anchored",
    "live-neighbour-anchored": "T1c-live-neighbour-anchored",
    "anchored": "T2-annual-calibrated",
    "estimated": "T3-modelled",
}

REGIONS_TS = REPO_ROOT / "src" / "lib" / "regions.ts"
# Pattern matches rows like:
#   { id: "caiso-wind", name: "California Wind", ... tier: "live", ... }
#   { id: "netherlands-wind", ... tier: "live-domestic-anchored", ... }
_REGION_ROW_RE = re.compile(
    r'id:\s*"(?P<id>[a-z0-9-]+)".*?tier:\s*"(?P<tier>live|live-domestic-anchored|live-neighbour-anchored|anchored|estimated)"',
    re.DOTALL,
)


def _load_regions_manifest() -> dict[str, str]:
    """Parse regions.ts and return {region_id: tier}.

    The file is curated by hand but the shape is stable — one Region literal
    per line for 95% of entries. The regex is forgiving enough that it
    survives line-wrapping and field reordering.
    """
    if not REGIONS_TS.exists():
        return {}
    text = REGIONS_TS.read_text()
    out: dict[str, str] = {}
    for m in _REGION_ROW_RE.finditer(text):
        out[m.group("id")] = m.group("tier")
    return out


_REGIONS_CACHE: dict[str, str] | None = None


def region_tier(region_id: str) -> str | None:
    """Look up a region's canonical tier from src/lib/types.ts::RegionTier."""
    global _REGIONS_CACHE
    if _REGIONS_CACHE is None:
        _REGIONS_CACHE = _load_regions_manifest()
    return _REGIONS_CACHE.get(region_id)


def derive_fallback_uncertainty(
    region_id: str, peak_gw: float
) -> tuple[str | None, float | None, float | None]:
    """When a snapshot predates per-loader applyUncertainty wiring, fall back
    to tier-default bounds derived from the regions.ts manifest.

    live                       → T1a-live-tso (±15% fallback).
    live-domestic-anchored     → T1b-live-domestic-anchored (±50%).
    live-neighbour-anchored    → T1c-live-neighbour-anchored (±35.5%).
    anchored                   → T2-annual-calibrated (±20%).
    estimated                  → T3-modelled (±40%).
    """
    tier_key = region_tier(region_id)
    if tier_key is None or not peak_gw or peak_gw <= 0:
        return None, None, None
    tier = REGION_TIER_TO_CONFIDENCE_TIER.get(tier_key)
    if tier is None:
        return None, None, None
    frac = TIER_DEFAULT_FRACTION[tier]
    delta = frac * peak_gw
    low = max(0.0, peak_gw - delta)
    high = max(peak_gw, peak_gw + delta)
    return tier, low, high

# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------
HOUR_FIELDS = [pa.field(f"profile_h{h:02d}", pa.float32()) for h in range(24)]
SCHEMA = pa.schema([
    pa.field("build_timestamp",      pa.string()),
    pa.field("region_id",            pa.string()),
    pa.field("peak_gw",              pa.float32()),
    pa.field("total_twh_30d",        pa.float32()),
    pa.field("source_status",        pa.string()),
    pa.field("last_updated",         pa.string()),
    pa.field("last_success_at",      pa.string()),
    pa.field("confidence_tier",      pa.string()),
    pa.field("uncertainty_low_gw",   pa.float32()),
    pa.field("uncertainty_high_gw",  pa.float32()),
    pa.field("capture_source",       pa.string()),
] + HOUR_FIELDS)

# Stamped on every row this version of the script writes. See the
# capture_source description in the module docstring and
# scripts/backfill_capture_source.py, which stamped "committed-snapshot" on
# every row written by the pre-cutover version.
CAPTURE_SOURCE_DEPLOYED = "deployed-build"


def build_rows(now: datetime, base_url: str) -> list[dict]:
    """Fetch the deployed dashboard's current region records and turn them
    into Parquet rows. Raises DeployedFetchError (writing nothing) if the
    fetch fails outright or the guard thresholds are not met — see the
    CRITICAL GUARD comment above MIN_MANIFEST_FILES.
    """
    rows: list[dict] = []
    ts = now.strftime("%Y-%m-%dT%H:%M:%SZ")

    paths, records = fetch_deployed_regions(base_url)

    print(
        f"Fetched {len(paths)} manifest files, {len(records)} distinct "
        f"region records (de-duplicated, 24-point profiles only) from "
        f"{base_url}",
        file=sys.stderr,
    )

    if len(paths) < MIN_MANIFEST_FILES or len(records) < MIN_REGION_RECORDS:
        raise DeployedFetchError(
            f"deployed dashboard fetch looks incomplete "
            f"({len(paths)} manifest files, {len(records)} region records; "
            f"require >= {MIN_MANIFEST_FILES} files and >= {MIN_REGION_RECORDS} "
            f"records). Refusing to fall back to the committed "
            f"data/snapshots/last-good/ corpus — that silent fallback is "
            f"exactly what produced 854 builds of phantom history. Writing "
            f"nothing."
        )

    for region_id, data in records:
        if region_id in SKIP_IDS:
            continue
        rows.append(_make_row(ts, region_id, data))

    return rows


def _make_row(ts: str, region_id: str, data: dict) -> dict:
    profile: list = data.get("profile", [])
    # S2 uncertainty fields: loaders that have been wired through
    # src/lib/uncertainty.ts::applyUncertainty emit confidenceTier +
    # uncertaintyLowGW + uncertaintyHighGW. Statics carry these since the
    # initial S2 sprint; live loaders are enriched at dashboard-build time
    # (src/index.md). For snapshots predating a given loader's S2 cutover,
    # the three fields are missing from the JSON, so we emit null (None)
    # and document the provenance gap. See docs/methodology/uncertainty.md.
    tier = data.get("confidenceTier")
    unc_low = data.get("uncertaintyLowGW")
    unc_high = data.get("uncertaintyHighGW")
    # Fallback when the snapshot JSON predates S2 wiring for this loader.
    # derive_fallback_uncertainty uses the regions.ts manifest to assign a
    # conservative tier + default ±% envelope so historical rows are not
    # null-starved.
    if tier is None:
        peak_gw_val = float(data.get("peakGW") or 0)
        tier_fb, low_fb, high_fb = derive_fallback_uncertainty(
            str(region_id), peak_gw_val
        )
        tier = tier_fb
        unc_low = low_fb
        unc_high = high_fb
    row: dict = {
        "build_timestamp":      ts,
        "region_id":            str(region_id),
        "peak_gw":              float(data.get("peakGW") or 0),
        "total_twh_30d":        float(data.get("totalTWh") or 0),
        "source_status":        str(data.get("sourceStatus") or ""),
        "last_updated":         str(data.get("lastUpdated") or ""),
        "last_success_at":      str(data.get("lastSuccessAt") or ""),
        "confidence_tier":      str(tier) if tier is not None else None,
        "uncertainty_low_gw":   float(unc_low) if unc_low is not None else None,
        "uncertainty_high_gw":  float(unc_high) if unc_high is not None else None,
        "capture_source":       CAPTURE_SOURCE_DEPLOYED,
    }
    for h in range(24):
        row[f"profile_h{h:02d}"] = float(profile[h]) if h < len(profile) else 0.0
    return row


def main() -> None:
    now = datetime.now(timezone.utc).replace(microsecond=0)
    base_url = os.environ.get("ELJ_DASHBOARD_URL", DEFAULT_DASHBOARD_URL).rstrip("/")
    print(f"Building snapshot rows for {now.isoformat()} from {base_url} …")

    try:
        rows = build_rows(now, base_url)
    except DeployedFetchError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)

    if not rows:
        # Unreachable in practice given the guard above, but fail loudly
        # rather than silently no-op if it ever is.
        print("ERROR: no region rows produced from a fetch that passed the "
              "size guard — this should not happen. Writing nothing.",
              file=sys.stderr)
        sys.exit(1)

    new_table = pa.Table.from_pylist(rows, schema=SCHEMA)

    HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)

    if HISTORY_FILE.exists():
        # Read the existing parquet WITHOUT enforcing the new schema, so
        # older partitions (missing confidence_tier / uncertainty_* /
        # capture_source) load successfully. promote_options="default"
        # fills in the missing columns with null on concatenation — this is
        # how the pre-existing capture_source-less rows get promoted rather
        # than requiring every historical partition to be rewritten again.
        existing = pq.read_table(HISTORY_FILE)
        if "capture_source" not in existing.schema.names:
            print(
                "  note: existing history file predates the capture_source "
                "column; promoting it to null for those rows "
                "(run scripts/backfill_capture_source.py to stamp them "
                "'committed-snapshot' explicitly instead of leaving null).",
                file=sys.stderr,
            )
        combined = pa.concat_tables(
            [existing, new_table],
            promote_options="default",
        )
    else:
        combined = new_table

    pq.write_table(combined, HISTORY_FILE, compression="snappy")

    n_new = len(new_table)
    n_total = len(combined)
    unique_builds = combined.column("build_timestamp").unique().to_pylist()
    print(
        f"Appended {n_new} region rows at {now.isoformat()}.\n"
        f"Total rows: {n_total} across {len(unique_builds)} build snapshots."
    )


if __name__ == "__main__":
    main()
