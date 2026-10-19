"""unittest for the CEA gen-daily relay copy guard. CI has no pytest;
tests/accept-india-gen-daily.test.ts runs this file.
"""

from __future__ import annotations

import importlib.util
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location(
    "accept_india_gen_daily", HERE / "accept_india_gen_daily.py"
)
assert spec and spec.loader
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)

COMMITTED = """date,wind_gwh,solar_gwh
2025-10-13,5.870,20.010
2025-10-14,6.150,12.530
2025-10-15,14.260,19.230
2026-10-14,6.760,40.700
2026-10-15,6.160,32.850
"""


class AcceptIndiaGenDaily(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.dst = Path(self.tmp.name) / "india-andhra-pradesh-gen-daily.csv"
        self.dst.write_text(COMMITTED)
        self.src = Path(self.tmp.name) / "relay.csv"

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_a_longer_plausible_file_copies(self) -> None:
        self.src.write_text(COMMITTED + "2026-10-16,4.100,30.200\n")
        msg = guard.accept(self.src, self.dst)
        self.assertIn("ACCEPT", msg)
        self.assertIn("2026-10-16,4.100,30.200", self.dst.read_text())

    def test_excel_serial_45944_is_left_in_place(self) -> None:
        poisoned = COMMITTED.replace("2025-10-14,6.150,12.530", "2025-10-14,37.000,45944.000")
        self.src.write_text(poisoned)
        msg = guard.accept(self.src, self.dst)
        self.assertIn("REJECT", msg)
        self.assertIn("45944", msg)
        self.assertEqual(self.dst.read_text(), COMMITTED)

    def test_a_shorter_series_is_left_in_place(self) -> None:
        lines = COMMITTED.splitlines(keepends=True)
        self.src.write_text("".join(lines[:4]))
        msg = guard.accept(self.src, self.dst)
        self.assertIn("drops", msg)
        self.assertIn("2026-10-14", msg)
        self.assertEqual(self.dst.read_text(), COMMITTED)

    def test_a_missing_middle_day_is_left_in_place(self) -> None:
        self.src.write_text(COMMITTED.replace("2025-10-14,6.150,12.530\n", ""))
        msg = guard.accept(self.src, self.dst)
        self.assertIn("2025-10-14", msg)
        self.assertEqual(self.dst.read_text(), COMMITTED)

    def test_a_plausible_revision_of_an_existing_day_copies(self) -> None:
        revised = COMMITTED.replace("2025-10-14,6.150,12.530", "2025-10-14,6.200,12.600")
        self.src.write_text(revised)
        msg = guard.accept(self.src, self.dst)
        self.assertIn("ACCEPT", msg)
        self.assertIn("6.200,12.600", self.dst.read_text())

    def test_a_new_file_with_no_committed_copy_is_accepted(self) -> None:
        fresh = self.dst.with_name("india-new-gen-daily.csv")
        fresh.unlink(missing_ok=True)
        self.src.write_text("date,wind_gwh,solar_gwh\n2026-10-15,1.000,2.000\n")
        msg = guard.accept(self.src, fresh)
        self.assertIn("ACCEPT", msg)
        self.assertTrue(fresh.exists())

    def test_cli_rejects_without_failing_the_pull(self) -> None:
        self.src.write_text(COMMITTED.replace("12.530", "45944.000"))
        code = guard.main(["accept_india_gen_daily.py", str(self.src), str(self.dst)])
        self.assertEqual(code, 0)
        self.assertEqual(self.dst.read_text(), COMMITTED)


if __name__ == "__main__":
    unittest.main()
