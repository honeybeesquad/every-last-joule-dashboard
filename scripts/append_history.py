#!/usr/bin/env python3
"""
Append the current committed snapshots to the rolling Parquet history file.

Called by .github/workflows/history-append.yml after each successful data refresh.
Reads every data/snapshots/last-good/*.json file and appends one row per region
to data/historical/curtailment_history.parquet.

Schema
------
build_timestamp     str     ISO-8601 UTC of this run (sortable)
region_id           str     matches RegionData.regionId
peak_gw             float32 current 30-day peak GW
total_twh_30d       float32 current 30-day curtailment TWh
source_status       str     "live" | "cached" | null
last_updated        str     calibration date (YYYY, YYYY-Q#, or ISO)
confidence_tier     str     "T1-live-TSO" | "T2-annual-calibrated" |
                            "T3-modelled" | "T4-structural-gap" | null
                            (see src/lib/uncertainty.ts + docs/methodology/uncertainty.md)
uncertainty_low_gw  float32 lower bound on peak_gw (GW). Clamped to 0.
uncertainty_high_gw float32 upper bound on peak_gw (GW). Always ≥ peak_gw.
profile_h00..h23    float32 24 hourly average GW values (UTC)

Historical rows written before the S2 uncertainty sprint (2026-04-24) will
have null values in the three uncertainty columns; pyarrow's
`concat_tables(promote_options="default")` fills them automatically when
the older partition is read back without the new schema.
"""

from __future__ import annotations

import json
import re
import sys
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
SNAPSHOTS_DIR = REPO_ROOT / "data" / "snapshots" / "last-good"
HISTORY_FILE = REPO_ROOT / "data" / "historical" / "curtailment_history.parquet"

# Non-region snapshots to skip
SKIP_IDS = {"cbeci", "anchor"}

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
    "T2-annual-calibrated": 0.20,
    "T3-modelled":          0.40,
    "T4-structural-gap":    0.00,
}

REGIONS_TS = REPO_ROOT / "src" / "lib" / "regions.ts"
# Pattern matches rows like:
#   { id: "caiso", name: "California", ... tier: "live", kind: "mixed", ... }
#   { id: "permian", ... tier: "flare", ...
_REGION_ROW_RE = re.compile(
    r'id:\s*"(?P<id>[a-z0-9-]+)".*?tier:\s*"(?P<tier>live|static|flare)"',
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
    """Look up a region's canonical tier ('live' / 'static' / 'flare')."""
    global _REGIONS_CACHE
    if _REGIONS_CACHE is None:
        _REGIONS_CACHE = _load_regions_manifest()
    return _REGIONS_CACHE.get(region_id)


def derive_fallback_uncertainty(
    region_id: str, peak_gw: float
) -> tuple[str | None, float | None, float | None]:
    """When a snapshot predates per-loader applyUncertainty wiring, fall back
    to tier-default bounds derived from the regions.ts manifest.

    live → T1-live-TSO (±15% fallback; 2σ would need backfill std).
    flare → T2-annual-calibrated (±20%).
    static → T2-annual-calibrated (±20%, unless profile kind is known to be
             solar/hydro-seasonal — but the manifest doesn't encode that at
             this layer, so we cannot upgrade to T3 here. Statics are the
             canonical source for profileKind and they emit confidenceTier
             themselves, so this function only fires for pre-S2 statics and
             we prefer to under-label than mis-label).
    """
    tier_key = region_tier(region_id)
    if tier_key is None or not peak_gw or peak_gw <= 0:
        return None, None, None
    if tier_key == "live":
        tier = "T1-live-TSO"
    elif tier_key == "flare":
        tier = "T2-annual-calibrated"
    elif tier_key == "static":
        tier = "T2-annual-calibrated"
    else:
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
    pa.field("confidence_tier",      pa.string()),
    pa.field("uncertainty_low_gw",   pa.float32()),
    pa.field("uncertainty_high_gw",  pa.float32()),
] + HOUR_FIELDS)


def build_rows(now: datetime) -> list[dict]:
    rows: list[dict] = []
    ts = now.strftime("%Y-%m-%dT%H:%M:%SZ")

    for snap_path in sorted(SNAPSHOTS_DIR.glob("*.json")):
        region_id = snap_path.stem

        if region_id in SKIP_IDS:
            continue

        try:
            data: dict = json.loads(snap_path.read_text())
        except Exception as exc:
            print(f"  skip {region_id}: {exc}", file=sys.stderr)
            continue

        profile: list = data.get("profile") or []
        if len(profile) != 24:
            # Multi-region loaders (e.g. entsoe.json) emit a dict of regions.
            if isinstance(data, dict) and not data.get("profile"):
                for sub_id, sub_data in data.items():
                    if isinstance(sub_data, dict) and len(sub_data.get("profile", [])) == 24:
                        rows.append(_make_row(ts, sub_data.get("regionId", sub_id), sub_data))
            continue

        rows.append(_make_row(ts, data.get("regionId", region_id), data))

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
        "confidence_tier":      str(tier) if tier is not None else None,
        "uncertainty_low_gw":   float(unc_low) if unc_low is not None else None,
        "uncertainty_high_gw":  float(unc_high) if unc_high is not None else None,
    }
    for h in range(24):
        row[f"profile_h{h:02d}"] = float(profile[h]) if h < len(profile) else 0.0
    return row


def main() -> None:
    now = datetime.now(timezone.utc).replace(microsecond=0)
    print(f"Building snapshot rows for {now.isoformat()} …")

    rows = build_rows(now)
    if not rows:
        print("No valid snapshot rows found — skipping.", file=sys.stderr)
        sys.exit(0)

    new_table = pa.Table.from_pylist(rows, schema=SCHEMA)

    HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)

    if HISTORY_FILE.exists():
        # Read the existing parquet WITHOUT enforcing the new schema, so
        # pre-S2 partitions (missing confidence_tier / uncertainty_*) load
        # successfully. promote_options="default" fills in the missing
        # columns with null on concatenation.
        existing = pq.read_table(HISTORY_FILE)
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
