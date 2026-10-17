"""Tests for scripts/silent_regions.py (the health check's 24-hour silence rule).

No network: find_silent is pure, and main() is not exercised here.
"""

from __future__ import annotations

import importlib.util
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]

spec = importlib.util.spec_from_file_location(
    "silent_regions", REPO_ROOT / "scripts" / "silent_regions.py"
)
assert spec and spec.loader
silent_regions = importlib.util.module_from_spec(spec)
# dataclasses look their module up in sys.modules while the class is built.
sys.modules["silent_regions"] = silent_regions
spec.loader.exec_module(silent_regions)

NOW = datetime(2026, 10, 13, 9, 0, tzinfo=timezone.utc)


def iso(ts: datetime) -> str:
    return ts.strftime("%Y-%m-%dT%H:%M:%S.000Z")


def ago(hours: float) -> str:
    return iso(NOW - timedelta(hours=hours))


def rec(status: str | None, last_success_at: str | None) -> dict:
    return {"sourceStatus": status, "lastSuccessAt": last_success_at}


def hist(build_hours_ago: float, region_id: str, status: str, success_hours_ago: float):
    return (ago(build_hours_ago), region_id, status, ago(success_hours_ago))


def ids(report) -> list[str]:
    return [s.region_id for s in report.silent]


def test_fresh_region_is_not_silent():
    report = silent_regions.find_silent({"a"}, {"a": rec("live", ago(1))}, [], NOW)
    assert ids(report) == []
    assert report.absent == []


def test_region_missing_from_build_for_over_24h_is_silent():
    # The 18 ENTSO-E zones: fresh in history, then gone from the build.
    history = [hist(30, "austria-wind", "cached", 30)]
    report = silent_regions.find_silent({"austria-wind"}, {}, history, NOW)
    assert ids(report) == ["austria-wind"]
    assert report.silent[0].in_build is False
    assert report.absent == ["austria-wind"]


def test_region_missing_for_under_24h_is_absent_but_not_silent():
    history = [hist(5, "austria-wind", "cached", 5)]
    report = silent_regions.find_silent({"austria-wind"}, {}, history, NOW)
    assert ids(report) == []
    assert report.absent == ["austria-wind"]


def test_degraded_record_does_not_count_as_fresh():
    # The 54 ENTSO-E zones on a fallback build: in the build, but `degraded`
    # with June's lastSuccessAt. Their newest fresh reading is from history.
    history = [hist(26, "spain-wind", "live", 26)]
    current = {"spain-wind": rec("degraded", "2026-06-17T04:11:00.000Z")}
    report = silent_regions.find_silent({"spain-wind"}, current, history, NOW)
    assert ids(report) == ["spain-wind"]
    assert report.silent[0].in_build is True
    assert report.silent[0].status == "degraded"


def test_degraded_build_within_24h_of_a_fresh_one_is_not_silent():
    history = [hist(4, "spain-wind", "live", 4)]
    current = {"spain-wind": rec("degraded", "2026-06-17T04:11:00.000Z")}
    report = silent_regions.find_silent({"spain-wind"}, current, history, NOW)
    assert ids(report) == []


def test_static_anchor_never_alerts():
    # An annual figure stamped 2026-06-01 and served `cached` on every build.
    history = [(ago(h), "xinjiang-solar", "cached", "2026-06-01T00:00:00.000Z") for h in (3, 30, 300)]
    current = {"xinjiang-solar": rec("cached", "2026-06-01T00:00:00.000Z")}
    report = silent_regions.find_silent({"xinjiang-solar"}, current, history, NOW)
    assert ids(report) == []


def test_cached_record_keeps_its_own_age():
    # A `cached` record carries the time its reading was taken, so a feed that
    # serves an 11-day-old reading as `cached` is still silent.
    history = [hist(24 * 11, "mexico-solar", "live", 24 * 11)]
    current = {"mexico-solar": rec("cached", ago(24 * 11))}
    report = silent_regions.find_silent({"mexico-solar"}, current, history, NOW)
    assert ids(report) == ["mexico-solar"]


def test_silent_beyond_lookback_drops_out():
    # The documented cost of the window: a feed dead for longer than LOOKBACK
    # no longer qualifies.
    days = silent_regions.LOOKBACK.days + 1
    history = [hist(24 * days, "gone", "live", 24 * days)]
    report = silent_regions.find_silent({"gone"}, {}, history, NOW)
    assert ids(report) == []


def test_build_time_stamps_older_than_lookback_do_not_qualify():
    # A modelled region stamped with each build's time before Sep 2026, and
    # dated by its anchor since: not a feed.
    days = silent_regions.LOOKBACK.days + 5
    history = [hist(24 * days, "china-x", "cached", 24 * days)]
    history += [(ago(h), "china-x", "cached", "2026-06-01T00:00:00.000Z") for h in (48, 3)]
    report = silent_regions.find_silent({"china-x"}, {}, history, NOW)
    assert ids(report) == []


def test_re_dated_static_anchor_never_alerts():
    # An annual anchor re-dated to 1 Oct in a data PR, then served unchanged.
    history = [(ago(h), "anchor", "cached", "2026-10-01T00:00:00.000Z") for h in (200, 30, 3)]
    current = {"anchor": rec("cached", "2026-10-01T00:00:00.000Z")}
    report = silent_regions.find_silent({"anchor"}, current, history, NOW)
    assert ids(report) == []


def test_reading_stamped_after_its_build_is_ignored():
    # A history row whose reading is a day newer than its build is skew.
    history = [(ago(48), "a", "live", ago(20))]
    report = silent_regions.find_silent({"a"}, {}, history, NOW)
    assert ids(report) == []


def test_future_timestamp_is_not_fresh():
    current = {"a": rec("live", iso(NOW + timedelta(days=2)))}
    history = [hist(48, "a", "live", 48)]
    report = silent_regions.find_silent({"a"}, current, history, NOW)
    assert ids(report) == ["a"]


def test_ids_off_the_roster_are_ignored():
    history = [hist(48, "denmark", "live", 48)]
    report = silent_regions.find_silent({"a"}, {"a": rec("live", ago(1))}, history, NOW)
    assert ids(report) == []
    assert report.checked == 1


def test_unparseable_and_missing_timestamps_are_not_fresh():
    current = {"a": rec("live", "not a date"), "b": rec(None, None)}
    report = silent_regions.find_silent({"a", "b"}, current, [], NOW)
    assert ids(report) == []


def test_newest_fresh_reading_wins_across_history_and_build():
    history = [hist(40, "a", "live", 40), hist(2, "a", "live", 2)]
    current = {"a": rec("degraded", "2026-06-17T04:11:00.000Z")}
    report = silent_regions.find_silent({"a"}, current, history, NOW)
    assert ids(report) == []


def test_format_names_age_and_where():
    item = silent_regions.SilentRegion("x", NOW - timedelta(hours=30), False, None)
    line = silent_regions.format_silent(item, NOW)
    assert line == "- x: last fresh reading 2026-10-12 03:00Z (30 h ago), missing from the build"
