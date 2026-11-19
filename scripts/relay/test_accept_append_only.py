"""unittest for the append-only relay copy guard. CI has no pytest;
tests/accept-append-only.test.ts runs this file.
"""

from __future__ import annotations

import importlib.util
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("accept_append_only", HERE / "accept_append_only.py")
assert spec and spec.loader
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)

HEADER = "utc_timestamp,eolica_mw,fotovoltaica_mw,hidraulica_mw,biocombustible_mw"
COMMITTED = [
    "2026-06-15T03:05:00Z,3202.84,0,113.67,164.77",
    "2026-06-15T03:10:00Z,3190.10,0,113.60,164.70",
]


class AcceptAppendOnly(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        self.dst = self.dir / "dst.csv"
        self.src = self.dir / "src.csv"
        self.dst.write_text("\n".join([HEADER, *COMMITTED]) + "\n")

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def write_src(self, lines: list[str]) -> None:
        self.src.write_text("\n".join(lines) + "\n")

    def run_guard(self) -> str:
        guard.main(["x", str(self.src), str(self.dst)])
        return self.dst.read_text()

    def test_accepts_strict_append(self) -> None:
        new = "2026-11-17T00:00:00Z,2900,10,100,160"
        self.write_src([HEADER, *COMMITTED, new])
        self.assertIn(new, self.run_guard())

    def test_refuses_relay_copy_that_drops_committed_rows(self) -> None:
        self.write_src([HEADER, "2026-11-17T00:00:00Z,2900,10,100,160"])
        self.assertEqual(self.run_guard().splitlines()[1:], COMMITTED)

    def test_refuses_changed_header(self) -> None:
        self.write_src(["ts,mw", *COMMITTED, "2026-11-17T00:00:00Z,1"])
        self.assertEqual(self.run_guard().splitlines()[0], HEADER)

    def test_refuses_empty_or_missing_source(self) -> None:
        self.write_src([])
        before = self.dst.read_text()
        self.assertEqual(self.run_guard(), before)
        self.src.unlink()
        self.assertEqual(self.run_guard(), before)

    def test_no_new_rows_leaves_file_alone(self) -> None:
        self.write_src([HEADER, *COMMITTED])
        ok, why = guard.decide(self.src, self.dst)
        self.assertFalse(ok)
        self.assertIn("no new rows", why)

    def test_takes_source_when_committed_file_absent(self) -> None:
        self.dst.unlink()
        self.write_src([HEADER, *COMMITTED])
        self.assertEqual(self.run_guard().splitlines(), [HEADER, *COMMITTED])

    def test_crlf_relay_copy_still_matches(self) -> None:
        new = "2026-11-17T00:00:00Z,2900,10,100,160"
        self.src.write_bytes(("\r\n".join([HEADER, *COMMITTED, new]) + "\r\n").encode())
        self.assertIn(new, self.run_guard())


if __name__ == "__main__":
    unittest.main()
