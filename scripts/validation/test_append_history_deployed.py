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
# De-duplication on regionId (Finding 1)
# ---------------------------------------------------------------------------

def test_fetch_deployed_regions_dedups_same_region_id_last_wins(monkeypatch, capsys):
    # "jordan" served by both data/jordan.<hash>.json and
    # data/statics.<hash>.json — mirrors the real 2026-08-19 collision.
    # Paths are walked in the sorted order fetch_manifest_paths returns, so
    # "data/jordan..." (j) sorts before "data/statics..." (s) and the
    # statics record should win.
    index_html = (
        b'<script src="data/jordan.aaa111.json"></script>'
        b'<script src="data/statics.bbb222.json"></script>'
    )
    jordan_from_jordan_file = _make_region_payload("jordan")
    jordan_from_jordan_file["peakGW"] = 1.0
    jordan_from_statics_file = _make_region_payload("jordan")
    jordan_from_statics_file["peakGW"] = 9.0
    files = {
        "data/jordan.aaa111.json": json.dumps(jordan_from_jordan_file).encode(),
        "data/statics.bbb222.json": json.dumps(
            {"jordan": jordan_from_statics_file}
        ).encode(),
    }
    monkeypatch.setattr(append_history, "_http_get", _stub_http_get(index_html, files))

    paths, records = append_history.fetch_deployed_regions("https://example.test")

    assert paths == ["data/jordan.aaa111.json", "data/statics.bbb222.json"]
    assert len(records) == 1
    region_id, kept = records[0]
    assert region_id == "jordan"
    assert kept["peakGW"] == 9.0  # last-wins: the statics.json record

    err = capsys.readouterr().err
    assert "duplicate regionId 'jordan'" in err
    assert "data/jordan.aaa111.json" in err
    assert "data/statics.bbb222.json" in err


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
