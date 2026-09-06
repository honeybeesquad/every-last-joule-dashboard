#!/usr/bin/env python3
"""
Build `data/historical/history-trends.json` — the pre-aggregated payload behind
the `/history` page.

Why a committed JSON rather than a data loader
----------------------------------------------
The two archives this reads are 20 MB and 2.2 MB of Parquet holding 2.59 M and
252 k rows. Shipping either to the browser is out of the question, and Parquet
is not readable from the Node/TypeScript side of this repo without adding a
dependency. Every other Parquet consumer here is Python (`append_history.py`,
`build_annual_rollup.py`, `scripts/validation/*.py`), so this follows that
pattern: Python aggregates, the result is committed, and `src/history.md.js`
reads the JSON at build time. CI stays Node-only.

`tests/history-trends.test.ts` asserts the committed JSON's invariants, so a
stale or hand-edited payload fails the build rather than shipping quietly.

What it aggregates, and the honesty constraints that shape it
-------------------------------------------------------------
Two archives, which say different things and must not be mixed:

1. `curtailment_backfill.parquet` — hourly, observation-timestamped, seven
   years, a fixed 29-region set. This is the only file in the repo whose
   x-axis is *when the energy was curtailed*, so it is the only one that can
   carry a trend. Aggregated to calendar-month and calendar-year sums, which
   are disjoint buckets: no overlapping windows.

   Three caveats travel with it, all recorded in the payload so the page
   cannot render the series without them:

   - Every row is generation x a calibration rate, and the rate is a single
     constant per (region, fuel) across all seven years — verified here, not
     assumed (`RATE_CONSTANT_PER_PAIR` below fails the build otherwise). So
     month-to-month movement is movement in measured *generation*, not in
     curtailment rate or grid behaviour. No row in this file is measured
     curtailment: `rate_applied` is non-zero on all 2,590,195 of them.
   - The archive stops mid-month (last observation 2026-04-24T11:00Z). The
     trailing partial month and the partial year are excluded from the series
     and reported separately, because a partial bucket in a stacked area reads
     as a collapse.
   - 27 of the 29 region ids predate the per-fuel and per-TSO-zone splits, so
     they do not resolve to `/region/<id>`. The payload marks which do.

2. `curtailment_history.parquet` — one row per region per build. Its
   `build_timestamp` is when the *snapshot was captured*, and its
   `total_twh_30d` is a trailing-30-day window restated every build, so
   consecutive daily rows overlap by 29 days. It cannot carry a curtailment
   trend and this script does not aggregate it as one. What it can carry
   honestly is *coverage*: how many regions, at which confidence tiers, the
   archive held on each day. Coverage is a property of the capture, so
   `build_timestamp` is the right x-axis for it.

   The global total is still emitted, but only so the page can show why it is
   not a trend: the `committed-snapshot` era (854 builds) produced 35 distinct
   totals because the appender re-stamped the repo's committed corpus rather
   than reading the deployed dashboard (PR #787), and the cutover to
   `deployed-build` moved coverage from ~270 to ~445 regions in one step.

Run
---
    python3 scripts/build_history_trends.py            # write the JSON
    python3 scripts/build_history_trends.py --check    # verify, write nothing

`--check` exits non-zero if the committed JSON differs from a fresh build. It
is not in `npm run ci:gates` because CI has no Python; run it after any change
to the archives.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import pandas as pd

REPO_ROOT = Path(__file__).resolve().parent.parent
BACKFILL = REPO_ROOT / "data" / "historical" / "curtailment_backfill.parquet"
HISTORY = REPO_ROOT / "data" / "historical" / "curtailment_history.parquet"
REGIONS_TS = REPO_ROOT / "src" / "lib" / "regions.ts"
OUT = REPO_ROOT / "data" / "historical" / "history-trends.json"

# Every backfill region is T1a in `per_region_annual.parquet`, and T1a's
# published envelope is +/-15% (src/lib/uncertainty.ts::TIER_DEFAULT_FRACTION).
# Applied to a sum of same-tier regions it stays +/-15%: the regions share one
# rate-calibration method, so their errors are correlated, and correlated is
# the conservative assumption for an envelope.
TIER_FRACTION = 0.15
TIER = "T1a-live-tso"

# Display labels for the 29 archive region ids. These are the archive's own
# historical vocabulary — `germany` here is the single pre-split bidding zone,
# not today's four German TSO-zone region pairs — so the label has to be
# written out rather than looked up in regions.ts, which no longer holds most
# of them. Kept alphabetical to match the archive's id order.
REGION_LABELS = {
    "baltics": ("Baltics", "Estonia, Latvia, Lithuania"),
    "bpa": ("Bonneville Power Administration", "USA"),
    "bulgaria": ("Bulgaria", "Bulgaria"),
    "caiso": ("CAISO", "USA"),
    "czech-republic": ("Czech Republic", "Czech Republic"),
    "ercot-east": ("ERCOT East/Central", "USA"),
    "ercot-west": ("ERCOT West/Panhandle", "USA"),
    "germany": ("Germany", "Germany"),
    "greece": ("Greece", "Greece"),
    "hungary": ("Hungary", "Hungary"),
    "iberia": ("Iberia", "Spain"),
    "iso-ne": ("ISO New England", "USA"),
    "italy-north-zone": ("Italy North", "Italy"),
    "italy-sardinia": ("Italy Sardinia", "Italy"),
    "miso": ("MISO", "USA"),
    "netherlands": ("Netherlands", "Netherlands"),
    "norway-no1": ("Norway NO1 Oslo", "Norway"),
    "norway-no2": ("Norway NO2 Kristiansand", "Norway"),
    "norway-no3": ("Norway NO3 Trondheim", "Norway"),
    "norway-no4": ("Norway NO4 Tromso", "Norway"),
    "nyiso": ("NYISO", "USA"),
    "pjm": ("PJM", "USA"),
    "poland": ("Poland", "Poland"),
    "portugal": ("Portugal", "Portugal"),
    "romania": ("Romania", "Romania"),
    "spp": ("SPP", "USA"),
    "sweden-north": ("Sweden North (SE2)", "Sweden"),
    "sweden-south": ("Sweden South (SE4)", "Sweden"),
    "switzerland": ("Switzerland", "Switzerland"),
}

FUELS = ["wind", "solar", "hydro"]


def fail(message: str) -> None:
    """Abort the build. A wrong payload is worse than no page."""
    print(f"build_history_trends: {message}", file=sys.stderr)
    sys.exit(1)


def canonical_region_ids() -> set[str]:
    """Region ids currently in `src/lib/regions.ts`, read as text.

    Only used to mark which archive ids still resolve to a `/region/<id>` page.
    A regex is enough: the file is one flat array of object literals and the
    `id:` key is always the first field on its line.
    """
    import re

    source = REGIONS_TS.read_text(encoding="utf8")
    return {m.group(1) for m in re.finditer(r'id:\s*"([^"]+)"', source)}


def build_backfill() -> dict:
    frame = pd.read_parquet(
        BACKFILL,
        columns=["observation_timestamp", "region_id", "curtailment_gw", "fuel", "rate_applied"],
    )
    timestamps = pd.to_datetime(frame.observation_timestamp, format="ISO8601", utc=True)

    # Honesty gate 1: no row in this archive is measured curtailment. If a
    # future backfill adds directly-published curtailment (rate_applied == 0
    # per dataset/SCHEMA.md), the page's "every value is generation x a rate"
    # claim stops being true and must be rewritten, so fail loudly here.
    measured = int((frame.rate_applied == 0).sum())
    if measured:
        fail(
            f"{measured} backfill rows have rate_applied == 0 (measured curtailment). "
            "The /history page claims every value is generation x a calibration rate — "
            "update src/history.md.js before regenerating."
        )

    # Honesty gate 2: the rate must be one constant per (region, fuel) across
    # all seven years. That is what makes the series a generation trend rather
    # than a curtailment-behaviour trend, and the page says so.
    varying = frame.groupby(["region_id", "fuel"]).rate_applied.nunique()
    if int((varying > 1).sum()):
        fail(
            "rate_applied varies over time for "
            f"{sorted(varying[varying > 1].index.tolist())} — the page's "
            "constant-rate caveat no longer holds."
        )

    last_observation = timestamps.max()
    month = timestamps.dt.tz_convert("UTC").dt.tz_localize(None).dt.to_period("M")
    year = timestamps.dt.year

    monthly = (
        frame.assign(month=month)
        .groupby(["month", "fuel"])
        .curtailment_gw.sum()
        .unstack(fill_value=0.0)
        .reindex(columns=FUELS, fill_value=0.0)
        .sort_index()
    )
    # The archive stops mid-month. A partial bucket in a stacked area reads as
    # a collapse in curtailment, so it is cut from the series and named in the
    # payload instead.
    partial_month = last_observation.tz_localize(None).to_period("M")
    complete_monthly = monthly[monthly.index < partial_month]

    yearly = (
        frame.assign(year=year)
        .groupby(["year", "fuel"])
        .curtailment_gw.sum()
        .unstack(fill_value=0.0)
        .reindex(columns=FUELS, fill_value=0.0)
        .sort_index()
    )
    partial_year = int(last_observation.year)
    complete_yearly = yearly[yearly.index < partial_year]

    per_region_month = (
        frame.assign(month=month)
        .groupby(["region_id", "month"])
        .curtailment_gw.sum()
        .unstack(fill_value=0.0)
        .reindex(columns=complete_monthly.index, fill_value=0.0)
    )
    per_region_fuel = frame.groupby("region_id").fuel.agg(lambda s: sorted(set(s)))
    per_region_year = (
        frame.assign(year=year)
        .groupby(["region_id", "year"])
        .curtailment_gw.sum()
        .unstack(fill_value=0.0)
        .reindex(columns=complete_yearly.index, fill_value=0.0)
    )

    canonical = canonical_region_ids()
    unlabelled = sorted(set(per_region_month.index) - set(REGION_LABELS))
    if unlabelled:
        fail(f"archive regions with no REGION_LABELS entry: {unlabelled}")

    # GWh, 1 dp. The archive's own values are float32 GW summed over whole
    # hours; a tenth of a GWh is already below the calibration rate's precision.
    def gwh(series) -> list[float]:
        return [round(float(v), 1) for v in series]

    regions = []
    for region_id in sorted(per_region_month.index):
        name, country = REGION_LABELS[region_id]
        regions.append(
            {
                "id": region_id,
                "name": name,
                "country": country,
                "fuels": list(per_region_fuel[region_id]),
                "canonical": region_id in canonical,
                "monthlyGwh": gwh(per_region_month.loc[region_id]),
                "yearlyGwh": gwh(per_region_year.loc[region_id]),
            }
        )

    return {
        "regionCount": int(per_region_month.shape[0]),
        "confidenceTier": TIER,
        "tierFraction": TIER_FRACTION,
        "firstObservation": timestamps.min().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "lastObservation": last_observation.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "partialMonthExcluded": str(partial_month),
        "partialYearExcluded": partial_year,
        "hourlyRows": int(len(frame)),
        "months": [str(m) for m in complete_monthly.index],
        "monthlyGwh": {fuel: gwh(complete_monthly[fuel]) for fuel in FUELS},
        "years": [int(y) for y in complete_yearly.index],
        "yearlyGwh": {fuel: gwh(complete_yearly[fuel]) for fuel in FUELS},
        "regions": regions,
    }


def build_archive() -> dict:
    frame = pd.read_parquet(
        HISTORY,
        columns=["build_timestamp", "region_id", "total_twh_30d", "confidence_tier", "capture_source"],
    )
    stamps = pd.to_datetime(frame.build_timestamp, format="ISO8601", utc=True)
    frame = frame.assign(day=stamps.dt.tz_localize(None).dt.date, stamp=stamps)

    # One point per calendar day: the last build of that day. Builds run every
    # few hours, and several same-day points would imply the archive resolves
    # sub-daily change it cannot resolve.
    last_build_of_day = frame.sort_values("stamp").groupby("day").build_timestamp.last()
    daily = frame[frame.build_timestamp.isin(set(last_build_of_day))]

    def tier_group(value) -> str:
        if pd.isna(value):
            # Rows written before the S2 uncertainty sprint (2026-04-24) carry
            # no tier. They are counted, not dropped — a dropped row would
            # understate the archive's coverage on those days.
            return "untiered"
        text = str(value)
        # "T1-live-TSO" is the legacy alias for T1a (dataset/SCHEMA.md).
        return "T1a" if text == "T1-live-TSO" else text.split("-")[0]

    daily = daily.assign(tier=daily.confidence_tier.map(tier_group))
    tier_order = ["T1a", "T1b", "T1c", "T2", "T3", "untiered"]
    coverage = (
        daily.groupby(["day", "tier"])
        .size()
        .unstack(fill_value=0)
        .reindex(columns=tier_order, fill_value=0)
        .sort_index()
    )
    totals = daily.groupby("day").total_twh_30d.sum().sort_index()
    capture = daily.groupby("day").capture_source.agg(
        lambda s: s.mode().iloc[0] if not s.mode().empty else None
    )

    deployed_days = capture[capture == "deployed-build"]
    cutover = str(deployed_days.index.min()) if len(deployed_days) else None

    eras = []
    for era in ("committed-snapshot", "deployed-build"):
        rows = frame[frame.capture_source == era]
        if not len(rows):
            continue
        per_build = rows.groupby("build_timestamp").total_twh_30d.sum()
        eras.append(
            {
                "captureSource": era,
                "builds": int(rows.build_timestamp.nunique()),
                "rows": int(len(rows)),
                "distinctTotals": int(per_build.round(6).nunique()),
                "regionsPerBuild": int(rows.groupby("build_timestamp").region_id.nunique().median()),
                "firstBuild": rows.stamp.min().strftime("%Y-%m-%dT%H:%M:%SZ"),
                "lastBuild": rows.stamp.max().strftime("%Y-%m-%dT%H:%M:%SZ"),
            }
        )

    return {
        "days": [str(d) for d in coverage.index],
        "tiers": tier_order,
        "coverage": {tier: [int(v) for v in coverage[tier]] for tier in tier_order},
        "totalTwh30d": [round(float(v), 3) for v in totals],
        "captureSource": [capture[day] for day in coverage.index],
        "cutoverDay": cutover,
        "eras": eras,
        "totalRows": int(len(frame)),
        "totalBuilds": int(frame.build_timestamp.nunique()),
    }


def build() -> dict:
    return {
        "$comment": (
            "Generated by scripts/build_history_trends.py from "
            "data/historical/curtailment_backfill.parquet and "
            "curtailment_history.parquet. Do not hand-edit — regenerate. "
            "Backfill months/years are observation time (disjoint buckets); "
            "archive days are capture time (coverage only, never a trend)."
        ),
        "backfill": build_backfill(),
        "archive": build_archive(),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="verify the committed JSON matches a fresh build; write nothing",
    )
    args = parser.parse_args()

    payload = build()
    # No build timestamp in the output: it would make every regeneration a
    # diff even when the archives have not moved, which is the
    # build_region_docs date-stamp churn this repo already learned to avoid.
    rendered = json.dumps(payload, indent=1, sort_keys=False) + "\n"

    if args.check:
        if not OUT.exists():
            fail(f"{OUT.relative_to(REPO_ROOT)} does not exist")
        if OUT.read_text(encoding="utf8") != rendered:
            fail(
                f"{OUT.relative_to(REPO_ROOT)} is stale — "
                "run `python3 scripts/build_history_trends.py` and commit the result"
            )
        print(f"build_history_trends: {OUT.relative_to(REPO_ROOT)} is current")
        return

    OUT.write_text(rendered, encoding="utf8")
    backfill = payload["backfill"]
    archive = payload["archive"]
    print(
        f"build_history_trends: wrote {OUT.relative_to(REPO_ROOT)} "
        f"({OUT.stat().st_size / 1024:.1f} kB) — "
        f"{len(backfill['months'])} months x {backfill['regionCount']} regions, "
        f"{len(archive['days'])} archive days",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
