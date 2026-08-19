#!/usr/bin/env python3
"""Unit tests for peru-coes-fetch.py response validation + CSV aggregation.

No network: every input is an inline fixture. Run directly:
  python3 scripts/relay/peru_coes_fetch_test.py
or via the vitest wrapper tests/relay-peru-coes-fetch.test.ts.
"""

import importlib.util
import pathlib
import sys
import unittest

_HERE = pathlib.Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location(
    "peru_coes_fetch", _HERE / "peru-coes-fetch.py")
mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(mod)

BOM = "﻿"

# Mirrors the live /Exportar shape (2026-08 contract): BOM, spaced commas,
# "COMPANY -UNIT" headers, DD/MM/YYYY HH:MM local timestamps.
VALID_CSV = BOM + (
    "fechahora , KALLPA GENERACION S.A. -SUNNY-BL1,"
    " JOYA SOLAR S.A.C. -SAN_MARTIN_SOLAR-BL1\r\n"
    # Day 1: published (sum far above PUBLISHED_DAY_MIN_MW_SUM)
    "01/07/2026 12:15, 600.5, 700.25\r\n"
    "01/07/2026 12:30, 601.5, 699.75\r\n"
    "01/07/2026 13:15, 300.0, 400.0\r\n"
    # Day 2: unpublished (all zero) — must be dropped
    "02/07/2026 12:15, 0, 0\r\n"
    "02/07/2026 12:30, 0, 0\r\n"
)

UNPUBLISHED_CSV = BOM + (
    "fechahora \r\n"
    "01/08/2026 00:15\r\n"
    "01/08/2026 00:30\r\n"
)

HTML_BODY = (
    "\r\n<!DOCTYPE html>\r\n<html lang=\"es-pe\">\r\n<head><title>Error"
    "</title></head><body></body></html>"
)


class EnsureExportCsvTest(unittest.TestCase):
    def test_accepts_valid_csv(self):
        self.assertEqual(mod.ensure_export_csv(VALID_CSV), VALID_CSV)

    def test_rejects_html_page(self):
        with self.assertRaisesRegex(RuntimeError, "HTML page"):
            mod.ensure_export_csv(HTML_BODY)

    def test_rejects_unpublished_window(self):
        with self.assertRaisesRegex(RuntimeError, "no plant columns"):
            mod.ensure_export_csv(UNPUBLISHED_CSV)

    def test_rejects_garbage(self):
        with self.assertRaisesRegex(RuntimeError, "unrecognised"):
            mod.ensure_export_csv('"1"')  # the old POST-flag contract


class AggregateTest(unittest.TestCase):
    def test_aggregates_published_day_and_drops_zero_day(self):
        agg = {}
        mod.aggregate(VALID_CSV, "solar", agg)
        self.assertEqual(agg["_days"], {"2026-07-01"})

        sunny = agg["solar-sunny"]
        self.assertEqual(sunny["days"], {"2026-07-01"})
        # 12:15/12:30 local = 17:15/17:30 UTC (Peru is UTC-5)
        self.assertAlmostEqual(sunny["sum"][17], 600.5 + 601.5)
        self.assertEqual(sunny["cnt"][17], 2)
        self.assertAlmostEqual(sunny["sum"][18], 300.0)
        # quarter-hourly readings: MWh = MW * 0.25
        self.assertAlmostEqual(sunny["mwh"], (600.5 + 601.5 + 300.0) * 0.25)

        sm = agg["solar-san-martin"]
        self.assertAlmostEqual(sm["mwh"], (700.25 + 699.75 + 400.0) * 0.25)

    def test_header_unit_matching_ignores_company_prefix(self):
        self.assertEqual(
            mod.match_plant("ENGIE ENERGIA PERU S.A.A. -CE P LOMITAS_EXP-BL2",
                            "wind"),
            "wind-punta-lomitas")
        self.assertIsNone(mod.match_plant("GR TARUCA S.A.C. -EOLICO_DUNA",
                                          "wind"))


if __name__ == "__main__":
    result = unittest.main(exit=False, verbosity=2).result
    sys.exit(0 if result.wasSuccessful() else 1)
