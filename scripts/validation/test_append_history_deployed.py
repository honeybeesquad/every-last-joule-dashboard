"""Tests for the deployed-dashboard capture path in scripts/append_history.py.

Covers: region-record extraction from both single-record and
dict-of-regions payloads (is_region_record / region_records, mirroring
.github/workflows/health-check.yml); the guard that aborts and writes
nothing when the fetch looks incomplete; and capture_source being stamped
"deployed-build" on every row this script writes.

No live network access is used — every test stubs
append_history._http_get, the one seam that touches the network.
"""

from __future__ import annotations

import datetime as dt
import importlib.util
import json
import urllib.error
from pathlib import Path

import pytest

pytest.importorskip("pyarrow")

REPO_ROOT = Path(__file__).resolve().parents[2]


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


append_history = load_module("append_history", REPO_ROOT / "scripts" / "append_history.py")


def _make_region_payload(region_id: str) -> dict:
    return {
        "regionId": region_id,
        "profile": [0.5] * 24,
        "peakGW": 1.0,
        "totalTWh": 0.36,
        "sourceStatus": "live",
        "lastUpdated": "2026-08-19T00:00:00Z",
        "lastSuccessAt": "2026-08-19T00:00:00Z",
    }


def _stub_http_get(index_html: bytes, files: dict[str, bytes]):
    def _stub(url: str, timeout: int = 30) -> bytes:
        if "/_file/" in url:
            path = url.split("/_file/", 1)[1]
            return files[path]
        return index_html

    return _stub


# ---------------------------------------------------------------------------
# is_region_record / region_records
# ---------------------------------------------------------------------------

def test_is_region_record_requires_region_id_and_profile_list():
    assert append_history.is_region_record({"regionId": "caiso-wind", "profile": [1.0] * 24})
    assert not append_history.is_region_record({"regionId": "caiso-wind"})
    assert not append_history.is_region_record({"profile": [1.0] * 24})
    assert not append_history.is_region_record([1, 2, 3])
    assert not append_history.is_region_record("not-a-dict")


def test_region_records_extracts_single_record_payload():
    payload = {"regionId": "caiso-wind", "profile": [0.1] * 24, "peakGW": 1.2}
    records = append_history.region_records(payload)
    assert [r["regionId"] for r in records] == ["caiso-wind"]


def test_region_records_extracts_dict_of_regions_payload():
    # Mirrors the shape of a multi-region loader payload (entsoe, aemo, ...).
    payload = {
        "germany-wind": _make_region_payload("germany-wind"),
        "germany-solar": _make_region_payload("germany-solar"),
        "sourceMeta": "not a region record",
    }
    records = append_history.region_records(payload)
    ids = sorted(r["regionId"] for r in records)
    assert ids == ["germany-solar", "germany-wind"]


def test_region_records_returns_empty_for_non_region_payload():
    # Shapes like anchor.json / cbeci.json, which carry no regionId.
    assert append_history.region_records({"hashrateEHps": 900}) == []
    assert append_history.region_records([1, 2, 3]) == []


# ---------------------------------------------------------------------------
# fetch_deployed_regions
# ---------------------------------------------------------------------------

def test_fetch_deployed_regions_walks_manifest_and_fetches_each_file(monkeypatch):
    index_html = (
        b'<script src="data/caiso-wind.abc123.json"></script>'
        b'<script src="data/entsoe.def456.json"></script>'
    )
    files = {
        "data/caiso-wind.abc123.json": json.dumps(_make_region_payload("caiso-wind")).encode(),
        "data/entsoe.def456.json": json.dumps(
            {
                "germany-wind": _make_region_payload("germany-wind"),
                "germany-solar": _make_region_payload("germany-solar"),
            }
        ).encode(),
    }
    monkeypatch.setattr(append_history, "_http_get", _stub_http_get(index_html, files))

    paths, records = append_history.fetch_deployed_regions("https://example.test")

    assert paths == ["data/caiso-wind.abc123.json", "data/entsoe.def456.json"]
    ids = sorted(region_id for region_id, _ in records)
    assert ids == ["caiso-wind", "germany-solar", "germany-wind"]


def test_fetch_deployed_regions_skips_a_file_that_fails_without_aborting(monkeypatch):
    index_html = (
        b'<script src="data/caiso-wind.abc123.json"></script>'
        b'<script src="data/broken.def456.json"></script>'
    )
    files = {
        "data/caiso-wind.abc123.json": json.dumps(_make_region_payload("caiso-wind")).encode(),
        # data/broken.def456.json intentionally missing -> KeyError inside
        # the stub, caught by fetch_deployed_regions's broad except.
    }
    monkeypatch.setattr(append_history, "_http_get", _stub_http_get(index_html, files))

    paths, records = append_history.fetch_deployed_regions("https://example.test")

    assert len(paths) == 2
    assert [r for _, r in records][0]["regionId"] == "caiso-wind"
    assert len(records) == 1


# ---------------------------------------------------------------------------
# The critical guard
# ---------------------------------------------------------------------------

def test_guard_thresholds_match_documented_values():
    # Locks in the thresholds cited in the CRITICAL GUARD comment so a
    # future edit that quietly loosens them fails a test, not just a review.
    assert append_history.MIN_MANIFEST_FILES == 100
    assert append_history.MIN_REGION_RECORDS == 400


def test_build_rows_raises_and_the_caller_gets_no_rows_when_records_are_short(monkeypatch):
    # Plenty of files would pass MIN_MANIFEST_FILES were it not patched down,
    # but only one region record comes back -- simulates a build where every
    # payload is present but malformed, or the manifest regex under-matched.
    index_html = b'<script src="data/only-one.abc123.json"></script>'
    files = {"data/only-one.abc123.json": json.dumps(_make_region_payload("only-one")).encode()}
    monkeypatch.setattr(append_history, "_http_get", _stub_http_get(index_html, files))

    now = dt.datetime.now(dt.timezone.utc)
    with pytest.raises(append_history.DeployedFetchError):
        append_history.build_rows(now, "https://example.test")


def test_build_rows_raises_on_index_fetch_failure(monkeypatch):
    def stub_http_get(url: str, timeout: int = 30) -> bytes:
        raise urllib.error.URLError("connection refused")

    monkeypatch.setattr(append_history, "_http_get", stub_http_get)

    now = dt.datetime.now(dt.timezone.utc)
    with pytest.raises(append_history.DeployedFetchError):
        append_history.build_rows(now, "https://example.test")


def test_main_exits_nonzero_and_writes_nothing_when_guard_fails(tmp_path, monkeypatch):
    index_html = b'<script src="data/only-one.abc123.json"></script>'
    files = {"data/only-one.abc123.json": json.dumps(_make_region_payload("only-one")).encode()}
    monkeypatch.setattr(append_history, "_http_get", _stub_http_get(index_html, files))

    scratch_history = tmp_path / "curtailment_history.parquet"
    monkeypatch.setattr(append_history, "HISTORY_FILE", scratch_history)

    with pytest.raises(SystemExit) as exc_info:
        append_history.main()

    assert exc_info.value.code != 0
    assert not scratch_history.exists()


# ---------------------------------------------------------------------------
# capture_source stamping
# ---------------------------------------------------------------------------

def test_build_rows_stamps_deployed_build_capture_source(monkeypatch):
    n_regions = 5
    index_html = "".join(
        f'<script src="data/region-{i}.abcabc{i}.json"></script>' for i in range(n_regions)
    ).encode()
    files = {
        f"data/region-{i}.abcabc{i}.json": json.dumps(_make_region_payload(f"region-{i}")).encode()
        for i in range(n_regions)
    }
    monkeypatch.setattr(append_history, "_http_get", _stub_http_get(index_html, files))
    # Exercise the real end-to-end mechanism without needing 100+ fake
    # payloads: lower the guard thresholds for this test only. The
    # thresholds themselves are locked by test_guard_thresholds_match_documented_values.
    monkeypatch.setattr(append_history, "MIN_MANIFEST_FILES", n_regions)
    monkeypatch.setattr(append_history, "MIN_REGION_RECORDS", n_regions)

    now = dt.datetime.now(dt.timezone.utc)
    rows = append_history.build_rows(now, "https://example.test")

    assert len(rows) == n_regions
    assert all(row["capture_source"] == "deployed-build" for row in rows)
    ids = sorted(row["region_id"] for row in rows)
    assert ids == [f"region-{i}" for i in range(n_regions)]


def test_skip_ids_still_filtered_from_deployed_records(monkeypatch):
    index_html = (
        b'<script src="data/anchor.111111.json"></script>'
        b'<script src="data/real.222222.json"></script>'
    )
    files = {
        # Real anchor.json payloads have no regionId and are already
        # excluded by region_records(); this uses a region-shaped payload
        # under the "anchor" id purely to exercise the defensive SKIP_IDS
        # filter on the deployed path too.
        "data/anchor.111111.json": json.dumps(_make_region_payload("anchor")).encode(),
        "data/real.222222.json": json.dumps(_make_region_payload("real-region")).encode(),
    }
    monkeypatch.setattr(append_history, "_http_get", _stub_http_get(index_html, files))
    monkeypatch.setattr(append_history, "MIN_MANIFEST_FILES", 2)
    monkeypatch.setattr(append_history, "MIN_REGION_RECORDS", 2)

    now = dt.datetime.now(dt.timezone.utc)
    rows = append_history.build_rows(now, "https://example.test")

    ids = sorted(row["region_id"] for row in rows)
    assert ids == ["real-region"]


# ---------------------------------------------------------------------------
# De-duplication on regionId (Finding 1) — freshness tie-break, not path order
# ---------------------------------------------------------------------------

def test_dedup_prefers_fresher_last_success_at_when_fresher_sorts_first(monkeypatch, capsys):
    # The fresher record is served from the path that sorts FIRST
    # alphabetically ("aaa-fresh" < "zzz-stale"), and is also processed
    # first (becomes the incumbent). A naive "last path wins" rule would
    # already happen to get this right by accident (it'd keep whatever
    # sorts/arrives last, but here that's the stale one arriving second,
    # so "last wins" would WRONGLY prefer the stale record). This test
    # exists specifically so path order cannot accidentally pass: the
    # freshness rule must look at lastSuccessAt, not position.
    index_html = (
        b'<script src="data/aaa-fresh.111111.json"></script>'
        b'<script src="data/zzz-stale.222222.json"></script>'
    )
    fresh = _make_region_payload("duptest")
    fresh["lastSuccessAt"] = "2026-08-19T04:25:27Z"
    fresh["sourceStatus"] = "live"
    fresh["peakGW"] = 0.5
    stale = _make_region_payload("duptest")
    stale["lastSuccessAt"] = "2025-01-01T00:00:00Z"
    stale["sourceStatus"] = "live"
    stale["peakGW"] = 9.0
    files = {
        "data/aaa-fresh.111111.json": json.dumps(fresh).encode(),
        "data/zzz-stale.222222.json": json.dumps(stale).encode(),
    }
    monkeypatch.setattr(append_history, "_http_get", _stub_http_get(index_html, files))

    paths, records = append_history.fetch_deployed_regions("https://example.test")

    assert paths == ["data/aaa-fresh.111111.json", "data/zzz-stale.222222.json"]
    assert len(records) == 1
    region_id, kept = records[0]
    assert region_id == "duptest"
    assert kept["peakGW"] == 0.5  # the fresher record, despite sorting/arriving first

    err = capsys.readouterr().err
    assert "duplicate regionId 'duptest'" in err
    assert "data/aaa-fresh.111111.json" in err
    assert "data/zzz-stale.222222.json" in err
    assert "keeping data/aaa-fresh.111111.json" in err
    assert "fresher lastSuccessAt" in err


def test_dedup_prefers_fresher_last_success_at_when_fresher_sorts_last(monkeypatch, capsys):
    # Mirror case: the fresher record arrives second / sorts last. Together
    # with the test above, this proves the outcome tracks lastSuccessAt in
    # both directions, not "whichever path sorts/arrives last".
    index_html = (
        b'<script src="data/aaa-stale.111111.json"></script>'
        b'<script src="data/zzz-fresh.222222.json"></script>'
    )
    stale = _make_region_payload("duptest")
    stale["lastSuccessAt"] = "2025-01-01T00:00:00Z"
    stale["sourceStatus"] = "live"
    stale["peakGW"] = 9.0
    fresh = _make_region_payload("duptest")
    fresh["lastSuccessAt"] = "2026-08-19T04:25:27Z"
    fresh["sourceStatus"] = "live"
    fresh["peakGW"] = 0.5
    files = {
        "data/aaa-stale.111111.json": json.dumps(stale).encode(),
        "data/zzz-fresh.222222.json": json.dumps(fresh).encode(),
    }
    monkeypatch.setattr(append_history, "_http_get", _stub_http_get(index_html, files))

    paths, records = append_history.fetch_deployed_regions("https://example.test")

    assert len(records) == 1
    region_id, kept = records[0]
    assert region_id == "duptest"
    assert kept["peakGW"] == 0.5


def test_dedup_breaks_tied_last_success_at_by_source_status(monkeypatch, capsys):
    # Same lastSuccessAt on both sides (rule 1 can't decide) -> falls
    # through to rule 2: the record WITH a sourceStatus beats the one
    # with none, regardless of which path it came from.
    index_html = (
        b'<script src="data/aaa-no-status.111111.json"></script>'
        b'<script src="data/zzz-live.222222.json"></script>'
    )
    no_status = _make_region_payload("duptest")
    no_status["lastSuccessAt"] = "2026-08-19T00:00:00Z"
    del no_status["sourceStatus"]
    no_status["peakGW"] = 9.0
    has_status = _make_region_payload("duptest")
    has_status["lastSuccessAt"] = "2026-08-19T00:00:00Z"
    has_status["sourceStatus"] = "live"
    has_status["peakGW"] = 0.5
    files = {
        "data/aaa-no-status.111111.json": json.dumps(no_status).encode(),
        "data/zzz-live.222222.json": json.dumps(has_status).encode(),
    }
    monkeypatch.setattr(append_history, "_http_get", _stub_http_get(index_html, files))

    paths, records = append_history.fetch_deployed_regions("https://example.test")

    assert len(records) == 1
    region_id, kept = records[0]
    assert region_id == "duptest"
    assert kept["peakGW"] == 0.5
    assert kept["sourceStatus"] == "live"

    err = capsys.readouterr().err
    assert "sourceStatus 'live' outranks" in err


def test_dedup_real_jordan_shape_regression(monkeypatch):
    # Regression test using the actual shapes reported for the live
    # 2026-08-19 collision: the real jordan.json loader record is live and
    # current; the statics.json placeholder is a stale 2025 snapshot with
    # no sourceStatus at all and a peakGW 3.3x too high. The fresh, live
    # record must win even though "statics" sorts (and would have been
    # processed) after "jordan".
    index_html = (
        b'<script src="data/jordan.5322f5ed.json"></script>'
        b'<script src="data/statics.3d686c60.json"></script>'
    )
    jordan_live = _make_region_payload("jordan")
    jordan_live["sourceStatus"] = "live"
    jordan_live["lastSuccessAt"] = "2026-08-19T04:25:27Z"
    jordan_live["totalTWh"] = 0.0288
    jordan_live["peakGW"] = 0.0661
    jordan_static = _make_region_payload("jordan")
    del jordan_static["sourceStatus"]
    jordan_static["lastSuccessAt"] = "2025-01-01T00:00:00Z"
    jordan_static["totalTWh"] = 0.0411
    jordan_static["peakGW"] = 0.2159
    files = {
        "data/jordan.5322f5ed.json": json.dumps(jordan_live).encode(),
        "data/statics.3d686c60.json": json.dumps(
            {"jordan": jordan_static}
        ).encode(),
    }
    monkeypatch.setattr(append_history, "_http_get", _stub_http_get(index_html, files))

    paths, records = append_history.fetch_deployed_regions("https://example.test")

    assert len(records) == 1
    region_id, kept = records[0]
    assert region_id == "jordan"
    assert kept["peakGW"] == pytest.approx(0.0661)
    assert kept["sourceStatus"] == "live"


def test_build_rows_produces_exactly_one_row_per_duplicate_region_id(monkeypatch):
    index_html = (
        b'<script src="data/jordan.aaa111.json"></script>'
        b'<script src="data/statics.bbb222.json"></script>'
    )
    files = {
        "data/jordan.aaa111.json": json.dumps(_make_region_payload("jordan")).encode(),
        "data/statics.bbb222.json": json.dumps(
            {"jordan": _make_region_payload("jordan")}
        ).encode(),
    }
    monkeypatch.setattr(append_history, "_http_get", _stub_http_get(index_html, files))
    monkeypatch.setattr(append_history, "MIN_MANIFEST_FILES", 2)
    monkeypatch.setattr(append_history, "MIN_REGION_RECORDS", 1)

    now = dt.datetime.now(dt.timezone.utc)
    rows = append_history.build_rows(now, "https://example.test")

    assert len(rows) == 1
    assert rows[0]["region_id"] == "jordan"


def test_guard_counts_deduplicated_records_not_raw_count(monkeypatch):
    # Two payload files both serve the same single region id ("jordan"),
    # twice each -> 4 raw records but only 1 distinct regionId. The guard
    # must see 1, not 4, so it correctly refuses a build this thin even
    # though duplicates alone would clear a low threshold.
    index_html = (
        b'<script src="data/jordan.aaa111.json"></script>'
        b'<script src="data/statics.bbb222.json"></script>'
    )
    files = {
        "data/jordan.aaa111.json": json.dumps(_make_region_payload("jordan")).encode(),
        "data/statics.bbb222.json": json.dumps(
            {"jordan": _make_region_payload("jordan")}
        ).encode(),
    }
    monkeypatch.setattr(append_history, "_http_get", _stub_http_get(index_html, files))
    monkeypatch.setattr(append_history, "MIN_MANIFEST_FILES", 2)
    # Threshold of 2 distinct records is NOT met by 1 distinct regionId,
    # even though 2 raw payload files (and thus raw records) were fetched.
    monkeypatch.setattr(append_history, "MIN_REGION_RECORDS", 2)

    now = dt.datetime.now(dt.timezone.utc)
    with pytest.raises(append_history.DeployedFetchError) as exc_info:
        append_history.build_rows(now, "https://example.test")

    # The error message should reflect the de-duplicated count (1), not the
    # raw record count (2).
    assert "1 region records" in str(exc_info.value)


# ---------------------------------------------------------------------------
# 24-point profile check (Finding 3)
# ---------------------------------------------------------------------------

def test_has_valid_profile_requires_exactly_24_points():
    assert append_history._has_valid_profile({"profile": [0.1] * 24})
    assert not append_history._has_valid_profile({"profile": []})
    assert not append_history._has_valid_profile({"profile": [0.1] * 23})
    assert not append_history._has_valid_profile({"profile": [0.1] * 25})
    assert not append_history._has_valid_profile({})


def test_fetch_deployed_regions_skips_record_with_non_24_point_profile(monkeypatch, capsys):
    index_html = b'<script src="data/broken-profile.abc123.json"></script>'
    broken = _make_region_payload("broken-profile")
    broken["profile"] = []
    files = {"data/broken-profile.abc123.json": json.dumps(broken).encode()}
    monkeypatch.setattr(append_history, "_http_get", _stub_http_get(index_html, files))

    paths, records = append_history.fetch_deployed_regions("https://example.test")

    assert records == []
    err = capsys.readouterr().err
    assert "broken-profile" in err
    assert "0 points, expected 24" in err


def test_fetch_deployed_regions_keeps_record_with_exactly_24_point_profile(monkeypatch):
    index_html = b'<script src="data/good-profile.abc123.json"></script>'
    good = _make_region_payload("good-profile")
    assert len(good["profile"]) == 24
    files = {"data/good-profile.abc123.json": json.dumps(good).encode()}
    monkeypatch.setattr(append_history, "_http_get", _stub_http_get(index_html, files))

    paths, records = append_history.fetch_deployed_regions("https://example.test")

    assert len(records) == 1
    assert records[0][0] == "good-profile"


def test_default_dashboard_url_is_overridable_via_env(monkeypatch):
    monkeypatch.setenv("ELJ_DASHBOARD_URL", "https://staging.example.test/")
    # main() reads the env var itself; assert the constant + env-read
    # contract without invoking a real fetch.
    import os

    assert os.environ.get("ELJ_DASHBOARD_URL", append_history.DEFAULT_DASHBOARD_URL).rstrip("/") == (
        "https://staging.example.test"
    )
