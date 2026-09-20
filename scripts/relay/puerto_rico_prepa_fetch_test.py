#!/usr/bin/env python3
"""Unit tests for puerto-rico-prepa-fetch.py. No network."""

import importlib.util
import pathlib
import unittest

_HERE = pathlib.Path(__file__).resolve().parent
_ROOT = _HERE.parent.parent
_spec = importlib.util.spec_from_file_location(
    "puerto_rico_prepa_fetch", _HERE / "puerto-rico-prepa-fetch.py"
)
mod = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
_spec.loader.exec_module(mod)

FIXTURE = (_ROOT / "tests" / "fixtures" / "prepa-datasource.js").read_text(encoding="utf-8")


class ParseDatasourceTest(unittest.TestCase):
    def test_parses_live_fixture(self):
        row = mod.parse_datasource(FIXTURE)
        self.assertEqual(row["utc_timestamp"], "2026-09-20T11:22:21Z")
        self.assertAlmostEqual(row["solar_mw"], 19.78)
        self.assertAlmostEqual(row["wind_mw"], 1.5)
        self.assertAlmostEqual(row["system_mw"], 2040)
        self.assertEqual(row["source_updated_local"], "9/20/2026 7:22:21 AM")

    def test_rejects_html(self):
        with self.assertRaisesRegex(RuntimeError, "missing"):
            mod.parse_datasource("<html>cloudflare</html>")


if __name__ == "__main__":
    unittest.main()
