"""Tests for scripts/relay/abed-xm-capture.py's chunked-fetch transport fix.

Covers: chunk boundaries (full month / part month / single day), the
1st-of-month month_bounds edge case, and that a failing chunk does not
discard chunks that already succeeded. No network access -- fetch() is
stubbed at the module level in every test.

See scripts/validation/test_history_tier_taxonomy.py for the load-module-by-
path convention this file follows (the script's filename has a hyphen, so it
can't be imported with a normal `import` statement).
"""
import datetime
import importlib.util
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


capture = load_module("abed_xm_capture", REPO_ROOT / "scripts" / "relay" / "abed-xm-capture.py")


# ---------------------------------------------------------------------------
# windows() chunk boundaries
# ---------------------------------------------------------------------------

def test_windows_full_month_chunks_of_seven():
    chunks = list(capture.windows("2026-08-01", "2026-08-31", 7))
    assert chunks == [
        ("2026-08-01", "2026-08-07"),
        ("2026-08-08", "2026-08-14"),
        ("2026-08-15", "2026-08-21"),
        ("2026-08-22", "2026-08-28"),
        ("2026-08-29", "2026-08-31"),  # trailing partial chunk (3 days)
    ]
    # every day of the month is covered exactly once
    covered = []
    for ws, we in chunks:
        d = datetime.date.fromisoformat(ws)
        end = datetime.date.fromisoformat(we)
        while d <= end:
            covered.append(d)
            d += datetime.timedelta(days=1)
    assert covered == [datetime.date(2026, 8, 1) + datetime.timedelta(days=i) for i in range(31)]


def test_windows_part_month_mid_month_run():
    # e.g. a --month current run on 2026-08-18: window is 1st..17th
    chunks = list(capture.windows("2026-08-01", "2026-08-17", 7))
    assert chunks == [
        ("2026-08-01", "2026-08-07"),
        ("2026-08-08", "2026-08-14"),
        ("2026-08-15", "2026-08-17"),
    ]


def test_windows_single_day():
    chunks = list(capture.windows("2026-08-02", "2026-08-02", 7))
    assert chunks == [("2026-08-02", "2026-08-02")]


def test_windows_chunk_days_is_configurable():
    chunks = list(capture.windows("2026-08-01", "2026-08-10", 3))
    assert chunks == [
        ("2026-08-01", "2026-08-03"),
        ("2026-08-04", "2026-08-06"),
        ("2026-08-07", "2026-08-09"),
        ("2026-08-10", "2026-08-10"),
    ]


def test_windows_default_uses_module_chunk_days_default():
    # capture_month's default chunk size should match the documented constant
    assert capture.CHUNK_DAYS == 7


# ---------------------------------------------------------------------------
# month_bounds() -- 1st-of-month edge case
# ---------------------------------------------------------------------------

def test_month_bounds_mid_month_is_normal():
    assert capture.month_bounds("2026-08", datetime.date(2026, 8, 18)) == (
        "2026-08-01", "2026-08-17",
    )


def test_month_bounds_last_day_of_month():
    assert capture.month_bounds("2026-08", datetime.date(2026, 8, 31)) == (
        "2026-08-01", "2026-08-30",
    )


def test_month_bounds_first_of_month_returns_none_not_inverted_range():
    # today - 1 day is 2026-07-31, which precedes 2026-08-01: no valid window.
    # Must NOT return a (start, end) with start > end.
    result = capture.month_bounds("2026-08", datetime.date(2026, 8, 1))
    assert result is None


def test_month_bounds_second_of_month_self_heals():
    assert capture.month_bounds("2026-08", datetime.date(2026, 8, 2)) == (
        "2026-08-01", "2026-08-01",
    )


def test_capture_month_skips_cleanly_on_first_of_month(monkeypatch):
    calls = []

    def fake_fetch(metric, path, entity, start, end, retries=2):
        calls.append((metric, start, end))
        return {"Items": []}

    monkeypatch.setattr(capture, "fetch", fake_fetch)
    monkeypatch.setattr(capture, "write_parquet", lambda *a, **k: (_ for _ in ()).throw(
        AssertionError("write_parquet must not be called for an empty window")
    ))

    total, had_failure = capture.capture_month("2026-08", datetime.date(2026, 8, 1), None)
    assert total == 0
    assert had_failure is False
    assert calls == []  # no fetch attempted at all -- clean skip, not a failed call


# ---------------------------------------------------------------------------
# capture_month() -- a failing chunk must not discard already-fetched chunks
# ---------------------------------------------------------------------------

def _rows_for(metric, start, end, units="kWh"):
    """Build a minimal Items[] response covering [start, end] with one row/day."""
    s = datetime.date.fromisoformat(start)
    e = datetime.date.fromisoformat(end)
    items = []
    d = s
    while d <= e:
        items.append({
            "Date": d.isoformat(),
            "HourlyEntities": [
                {"Values": {"code": "PLANT1", "Hour01": "10.5"}},
            ],
        })
        d += datetime.timedelta(days=1)
    return {"Items": items}


def test_capture_month_writes_partial_data_when_a_later_chunk_fails(monkeypatch):
    """A month window of 1st..17th chunked at 7 days is 3 chunks
    (1-7, 8-14, 15-17). The 3rd chunk fails; rows from chunks 1 and 2 must
    still be written, and the run must report failure."""
    written = {}

    def fake_fetch(metric, path, entity, start, end, retries=2):
        if start == "2026-08-15":
            raise RuntimeError(f"fetch failed {metric} {start}..{end}: rc=28 out=''")
        return _rows_for(metric, start, end)

    def fake_write_parquet(metric, rows, tag):
        written.setdefault(metric, []).append((tag, list(rows)))
        return f"/fake/{metric}/{tag}.parquet"

    monkeypatch.setattr(capture, "fetch", fake_fetch)
    monkeypatch.setattr(capture, "write_parquet", fake_write_parquet)

    total, had_failure = capture.capture_month(
        "2026-08", datetime.date(2026, 8, 18), {"Gene"}, chunk_days=7
    )

    assert had_failure is True
    # 14 days successfully fetched (1-7 and 8-14) before the 15-17 chunk failed
    assert total == 14
    assert "Gene" in written
    (tag, rows), = written["Gene"]
    assert tag == "2026-08"
    dates_written = sorted({r[1].isoformat() if hasattr(r[1], "isoformat") else r[1] for r in rows})
    assert dates_written == [
        f"2026-08-{d:02d}" for d in range(1, 15)
    ]
    # the failed chunk's dates (15, 16, 17) must NOT appear -- no hole-filling
    # with partial/garbage data, and no silent gap presented as complete data
    assert "2026-08-15" not in dates_written
    assert "2026-08-17" not in dates_written


def test_capture_month_one_metric_failure_does_not_block_other_metrics(monkeypatch):
    written = {}

    def fake_fetch(metric, path, entity, start, end, retries=2):
        if metric == "Gene":
            raise RuntimeError("fetch failed Gene: rc=28 out=''")
        return _rows_for(metric, start, end)

    def fake_write_parquet(metric, rows, tag):
        written.setdefault(metric, []).append((tag, len(rows)))
        return f"/fake/{metric}/{tag}.parquet"

    monkeypatch.setattr(capture, "fetch", fake_fetch)
    monkeypatch.setattr(capture, "write_parquet", fake_write_parquet)

    total, had_failure = capture.capture_month(
        "2026-08", datetime.date(2026, 8, 3), None, chunk_days=7
    )

    assert had_failure is True
    # Gene failed on its first chunk (0 rows), but the other 4 metrics
    # (window is just 2026-08-01..02, one chunk) should have succeeded.
    assert "Gene" not in written
    for metric in ("GeneIdea", "PrecOferDesp", "PrecBolsNaci", "RecoNegEner"):
        assert metric in written


def test_capture_month_full_success_reports_no_failure(monkeypatch):
    def fake_fetch(metric, path, entity, start, end, retries=2):
        return _rows_for(metric, start, end)

    monkeypatch.setattr(capture, "fetch", fake_fetch)
    monkeypatch.setattr(capture, "write_parquet", lambda metric, rows, tag: f"/fake/{metric}/{tag}.parquet")

    total, had_failure = capture.capture_month(
        "2026-08", datetime.date(2026, 8, 18), {"Gene"}, chunk_days=7
    )

    assert had_failure is False
    assert total == 17  # 2026-08-01 .. 2026-08-17 inclusive, one row/day


# ---------------------------------------------------------------------------
# main() exit codes for --month mode
# ---------------------------------------------------------------------------

def test_main_month_mode_exits_nonzero_on_partial_failure(monkeypatch):
    def fake_fetch(metric, path, entity, start, end, retries=2):
        raise RuntimeError("fetch failed: rc=28 out=''")

    monkeypatch.setattr(capture, "fetch", fake_fetch)
    monkeypatch.setattr(capture, "write_parquet", lambda *a, **k: "/fake.parquet")
    monkeypatch.setattr(capture.datetime, "date", capture.datetime.date)  # sanity: module still usable
    monkeypatch.setattr(
        "sys.argv",
        ["abed-xm-capture.py", "--month", "2026-08", "--metrics", "Gene"],
    )

    class FixedDate(datetime.date):
        @classmethod
        def today(cls):
            return datetime.date(2026, 8, 18)

    monkeypatch.setattr(capture.datetime, "date", FixedDate)

    rc = capture.main()
    assert rc == 1


def test_main_month_mode_exits_zero_on_first_of_month_skip(monkeypatch):
    def fake_fetch(metric, path, entity, start, end, retries=2):
        raise AssertionError("fetch should not be called when the window is empty")

    monkeypatch.setattr(capture, "fetch", fake_fetch)
    monkeypatch.setattr(
        "sys.argv",
        ["abed-xm-capture.py", "--month", "current"],
    )

    class FixedDate(datetime.date):
        @classmethod
        def today(cls):
            return datetime.date(2026, 8, 1)

    monkeypatch.setattr(capture.datetime, "date", FixedDate)

    rc = capture.main()
    assert rc == 0
