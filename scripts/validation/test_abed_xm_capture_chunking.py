"""Tests for scripts/relay/abed-xm-capture.py's chunked-fetch transport fix.

Covers: chunk boundaries (full month / part month / single day), the
1st-of-month month_bounds edge case, that a failing chunk does not discard
chunks that already succeeded, and the merge-on-partial-failure semantics
that stop a chunk failure from ever reducing on-disk coverage. No network
access -- fetch()/write_parquet()/read_parquet_rows() are stubbed at the
module level in every test.

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
# Fake in-memory lake used by the capture_month tests below.
#
# fake_write_parquet stores rows as-is (dates are the plain ISO strings
# parse_rows produces). fake_read_parquet_rows returns them with `date`
# converted to a real datetime.date -- mirroring what duckdb actually hands
# back for a DATE column -- so the tests exercise _row_key's normalisation
# rather than assuming string dates throughout.
# ---------------------------------------------------------------------------

def _make_fake_lake(monkeypatch, store=None):
    store = {} if store is None else store

    def fake_write_parquet(metric, rows, tag):
        store[(metric, tag)] = list(rows)
        return f"/fake/{metric}/{tag}.parquet"

    def fake_read_parquet_rows(metric, tag):
        rows = store.get((metric, tag), [])
        out = []
        for (m, date, hour, code, value, units) in rows:
            d = date if isinstance(date, datetime.date) else datetime.date.fromisoformat(date)
            out.append((m, d, hour, code, value, units))
        return out

    monkeypatch.setattr(capture, "write_parquet", fake_write_parquet)
    monkeypatch.setattr(capture, "read_parquet_rows", fake_read_parquet_rows)
    return store


def _rows_for(metric, start, end, units="kWh", value=10.5):
    """Build a minimal Items[] response covering [start, end] with one row/day."""
    s = datetime.date.fromisoformat(start)
    e = datetime.date.fromisoformat(end)
    items = []
    d = s
    while d <= e:
        items.append({
            "Date": d.isoformat(),
            "HourlyEntities": [
                {"Values": {"code": "PLANT1", "Hour01": str(value)}},
            ],
        })
        d += datetime.timedelta(days=1)
    return {"Items": items}


def _dates_in(rows):
    out = set()
    for r in rows:
        d = r[1]
        out.add(d.isoformat() if isinstance(d, datetime.date) else d)
    return out


# ---------------------------------------------------------------------------
# _row_key / merge_rows unit tests
# ---------------------------------------------------------------------------

def test_row_key_normalises_string_and_date_object_the_same():
    row_str = ("Gene", "2026-08-05", 1, "PLANT1", 10.0, "kWh")
    row_date = ("Gene", datetime.date(2026, 8, 5), 1, "PLANT1", 999.0, "kWh")
    assert capture._row_key(row_str) == capture._row_key(row_date)


def test_merge_rows_prefers_fresh_on_key_collision():
    existing = [("Gene", datetime.date(2026, 8, 5), 1, "PLANT1", 100.0, "kWh")]
    fresh = [("Gene", "2026-08-05", 1, "PLANT1", 999.0, "kWh")]
    merged = capture.merge_rows(existing, fresh)
    assert len(merged) == 1
    assert merged[0][4] == 999.0  # fresh value wins


def test_merge_rows_preserves_existing_rows_not_covered_by_fresh():
    existing = [
        ("Gene", datetime.date(2026, 8, d), 1, "PLANT1", float(d), "kWh")
        for d in range(1, 11)
    ]
    fresh = [("Gene", "2026-08-01", 1, "PLANT1", 999.0, "kWh")]  # only day 1
    merged = capture.merge_rows(existing, fresh)
    # nothing lost: still 10 rows, days 2-10 untouched, day 1 updated
    assert len(merged) == 10
    by_key = {capture._row_key(r): r for r in merged}
    assert by_key[("Gene", "2026-08-01", 1, "PLANT1")][4] == 999.0
    assert by_key[("Gene", "2026-08-05", 1, "PLANT1")][4] == 5.0


# ---------------------------------------------------------------------------
# capture_month() -- a failing chunk must not discard already-fetched chunks
# ---------------------------------------------------------------------------

def test_capture_month_writes_partial_data_when_a_later_chunk_fails_no_existing_file(monkeypatch):
    """A month window of 1st..17th chunked at 7 days is 3 chunks
    (1-7, 8-14, 15-17). The 3rd chunk fails; rows from chunks 1 and 2 must
    still be written (nothing was on disk yet), and the run must report
    failure."""
    store = _make_fake_lake(monkeypatch)

    def fake_fetch(metric, path, entity, start, end, retries=2):
        if start == "2026-08-15":
            raise RuntimeError(f"fetch failed {metric} {start}..{end}: rc=28 out=''")
        return _rows_for(metric, start, end)

    monkeypatch.setattr(capture, "fetch", fake_fetch)

    total, had_failure = capture.capture_month(
        "2026-08", datetime.date(2026, 8, 18), {"Gene"}, chunk_days=7
    )

    assert had_failure is True
    assert total == 14  # days 1-14 fetched before the 15-17 chunk failed
    rows = store[("Gene", "2026-08")]
    assert _dates_in(rows) == {f"2026-08-{d:02d}" for d in range(1, 15)}
    assert "2026-08-15" not in _dates_in(rows)  # no hole-filling with garbage


def test_capture_month_one_metric_failure_does_not_block_other_metrics(monkeypatch):
    store = _make_fake_lake(monkeypatch)

    def fake_fetch(metric, path, entity, start, end, retries=2):
        if metric == "Gene":
            raise RuntimeError("fetch failed Gene: rc=28 out=''")
        return _rows_for(metric, start, end)

    monkeypatch.setattr(capture, "fetch", fake_fetch)

    total, had_failure = capture.capture_month(
        "2026-08", datetime.date(2026, 8, 3), None, chunk_days=7
    )

    assert had_failure is True
    # Gene failed on its first chunk (0 rows, nothing existing) -> not written
    assert ("Gene", "2026-08") not in store
    for metric in ("GeneIdea", "PrecOferDesp", "PrecBolsNaci", "RecoNegEner"):
        assert (metric, "2026-08") in store


def test_capture_month_full_success_reports_no_failure(monkeypatch):
    store = _make_fake_lake(monkeypatch)

    def fake_fetch(metric, path, entity, start, end, retries=2):
        return _rows_for(metric, start, end)

    monkeypatch.setattr(capture, "fetch", fake_fetch)

    total, had_failure = capture.capture_month(
        "2026-08", datetime.date(2026, 8, 18), {"Gene"}, chunk_days=7
    )

    assert had_failure is False
    assert total == 17  # 2026-08-01 .. 2026-08-17 inclusive, one row/day
    assert len(store[("Gene", "2026-08")]) == 17


# ---------------------------------------------------------------------------
# capture_month() -- merge-on-partial-failure: coverage must never shrink
# ---------------------------------------------------------------------------

def test_partial_run_over_existing_fuller_file_preserves_earlier_rows(monkeypatch):
    """Existing on-disk file already has the full 1st..17th (17 rows, from
    a prior successful run). Tonight's window has grown to 1st..20th and
    is chunked (1-7, 8-14, 15-20 with chunk_days=7 -> 1-7, 8-14, 15-20 -- use
    chunk_days=7 so the 3rd chunk 15-20 fails outright). The failure must
    not reduce the file below its prior 17 rows."""
    store = _make_fake_lake(monkeypatch)
    # Seed the fake lake with row tuples directly (matching what
    # write_parquet would have stored from a prior successful run).
    store[("Gene", "2026-08")] = [
        ("Gene", f"2026-08-{d:02d}", 1, "PLANT1", float(d), "kWh") for d in range(1, 18)
    ]

    def fake_fetch(metric, path, entity, start, end, retries=2):
        if start == "2026-08-15":
            raise RuntimeError("fetch failed Gene 2026-08-15..2026-08-20: rc=28 out=''")
        return _rows_for(metric, start, end)

    monkeypatch.setattr(capture, "fetch", fake_fetch)

    total, had_failure = capture.capture_month(
        "2026-08", datetime.date(2026, 8, 21), {"Gene"}, chunk_days=7
    )

    assert had_failure is True
    rows = store[("Gene", "2026-08")]
    # invariant: never fewer rows, and never an earlier max date, than before this run
    assert len(rows) >= 17
    assert max(_dates_in(rows)) >= "2026-08-17"
    # the pre-existing days 1-17 are all still present
    assert {f"2026-08-{d:02d}" for d in range(1, 18)} <= _dates_in(rows)


def test_partial_run_merges_new_days_into_existing_file(monkeypatch):
    """Existing file covers days 1-10 (a previous partial or complete run).
    Tonight fetches days 1-14 successfully before failing on day 15-17.
    The merged file must contain the union: days 1-14 (with day 1-10
    refreshed to tonight's values, since fresh wins on collision)."""
    store = _make_fake_lake(monkeypatch)
    store[("Gene", "2026-08")] = [
        ("Gene", f"2026-08-{d:02d}", 1, "PLANT1", -1.0, "kWh") for d in range(1, 11)
    ]

    def fake_fetch(metric, path, entity, start, end, retries=2):
        if start == "2026-08-15":
            raise RuntimeError("fetch failed Gene 2026-08-15..2026-08-17: rc=28 out=''")
        return _rows_for(metric, start, end, value=42.0)

    monkeypatch.setattr(capture, "fetch", fake_fetch)

    total, had_failure = capture.capture_month(
        "2026-08", datetime.date(2026, 8, 18), {"Gene"}, chunk_days=7
    )

    assert had_failure is True
    rows = store[("Gene", "2026-08")]
    assert _dates_in(rows) == {f"2026-08-{d:02d}" for d in range(1, 15)}  # extended to day 14
    by_key = {capture._row_key(r): r for r in rows}
    # collision on days 1-10: fresh (42.0) wins over the stale existing (-1.0)
    assert by_key[("Gene", "2026-08-01", 1, "PLANT1")][4] == 42.0
    assert total == len(rows) == 14


def test_partial_run_key_collision_takes_fresh_value(monkeypatch):
    store = _make_fake_lake(monkeypatch)
    store[("Gene", "2026-08")] = [
        ("Gene", "2026-08-01", 1, "PLANT1", 111.0, "kWh"),
    ]

    def fake_fetch(metric, path, entity, start, end, retries=2):
        if start == "2026-08-08":
            raise RuntimeError("fetch failed: rc=28 out=''")
        return {
            "Items": [{
                "Date": "2026-08-01",
                "HourlyEntities": [{"Values": {"code": "PLANT1", "Hour01": "222.0"}}],
            }],
        }

    monkeypatch.setattr(capture, "fetch", fake_fetch)

    total, had_failure = capture.capture_month(
        "2026-08", datetime.date(2026, 8, 10), {"Gene"}, chunk_days=7
    )

    assert had_failure is True
    rows = store[("Gene", "2026-08")]
    assert len(rows) == 1
    assert rows[0][4] == 222.0  # the late-settling revision, not the stale 111.0


def test_full_success_run_still_overwrites_and_drops_stale_rows(monkeypatch):
    """A complete, failure-free run must NOT merge -- it overwrites, which is
    what lets a row that genuinely disappeared upstream (revision/deletion)
    disappear from the lake too. read_parquet_rows must not even be called
    on the success path."""
    store = _make_fake_lake(monkeypatch)
    store[("Gene", "2026-08")] = [
        ("Gene", "2026-08-31", 1, "PLANT1", -999.0, "kWh"),  # stale/ghost row
    ]

    def fake_read_parquet_rows_should_not_be_called(metric, tag):
        raise AssertionError("read_parquet_rows must not be called on a failure-free run")

    monkeypatch.setattr(capture, "read_parquet_rows", fake_read_parquet_rows_should_not_be_called)

    def fake_fetch(metric, path, entity, start, end, retries=2):
        return _rows_for(metric, start, end)

    monkeypatch.setattr(capture, "fetch", fake_fetch)

    total, had_failure = capture.capture_month(
        "2026-08", datetime.date(2026, 8, 18), {"Gene"}, chunk_days=7
    )

    assert had_failure is False
    rows = store[("Gene", "2026-08")]
    assert "2026-08-31" not in _dates_in(rows)  # stale ghost row is gone
    assert _dates_in(rows) == {f"2026-08-{d:02d}" for d in range(1, 18)}
    assert total == 17


# ---------------------------------------------------------------------------
# main() exit codes for --month mode
# ---------------------------------------------------------------------------

def test_main_month_mode_exits_nonzero_on_partial_failure(monkeypatch):
    _make_fake_lake(monkeypatch)

    def fake_fetch(metric, path, entity, start, end, retries=2):
        raise RuntimeError("fetch failed: rc=28 out=''")

    monkeypatch.setattr(capture, "fetch", fake_fetch)
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
