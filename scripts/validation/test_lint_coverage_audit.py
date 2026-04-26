"""Tests for lint_coverage_audit CLI."""
from __future__ import annotations

import csv
import subprocess
import sys
from pathlib import Path

LINT_SCRIPT = Path(__file__).parent / "lint_coverage_audit.py"

VALID_HEADER = [
    "country", "subdivision", "operator_name", "operator_url",
    "region_id_in_project", "current_tier", "phenomenon",
    "coverage_status", "data_format", "probe_result", "available_anchor",
    "annual_anchor_TWh", "recommended_action", "recommended_tier_landing",
    "loader_pattern_hint", "priority_score", "notes",
]

VALID_ROW = [
    "VNM / Vietnam", "", "EVN-NLDC", "https://www.evn.com.vn/",
    "", "not-modelled", "curtailment-renewable", "published",
    "JSON-API", "200 / application/json", "EVN 2024 Operations Report",
    "4.0", "introduce-as-T1", "T1a", "Pattern-A", "4.0", "",
]


def write_csv(path: Path, rows: list[list[str]]) -> None:
    with path.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(VALID_HEADER)
        for r in rows:
            w.writerow(r)


def run_lint(path: Path) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(LINT_SCRIPT), str(path)],
        capture_output=True, text=True,
    )


def test_lint_passes_on_valid_csv(tmp_path):
    p = tmp_path / "valid.csv"
    write_csv(p, [VALID_ROW])
    result = run_lint(p)
    assert result.returncode == 0, result.stdout + result.stderr


def test_lint_fails_on_missing_column(tmp_path):
    p = tmp_path / "bad.csv"
    with p.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(VALID_HEADER[:-1])  # drop 'notes'
        w.writerow(VALID_ROW[:-1])
    result = run_lint(p)
    assert result.returncode != 0
    assert "column" in (result.stdout + result.stderr).lower()


def test_lint_fails_on_bad_enum(tmp_path):
    bad = list(VALID_ROW)
    bad[5] = "T9-bogus"  # current_tier
    p = tmp_path / "bad.csv"
    write_csv(p, [bad])
    result = run_lint(p)
    assert result.returncode != 0
    assert "current_tier" in result.stdout + result.stderr


def test_lint_fails_on_negative_anchor_twh(tmp_path):
    bad = list(VALID_ROW)
    bad[11] = "-1.5"
    p = tmp_path / "bad.csv"
    write_csv(p, [bad])
    result = run_lint(p)
    assert result.returncode != 0
    assert "annual_anchor_TWh" in result.stdout + result.stderr


def test_lint_fails_on_non_numeric_anchor(tmp_path):
    bad = list(VALID_ROW)
    bad[11] = "four"
    p = tmp_path / "bad.csv"
    write_csv(p, [bad])
    result = run_lint(p)
    assert result.returncode != 0


def test_lint_reports_all_errors_not_just_first(tmp_path):
    bad1 = list(VALID_ROW); bad1[5] = "T9-bogus"
    bad2 = list(VALID_ROW); bad2[8] = "GraphQL-feed"
    p = tmp_path / "bad.csv"
    write_csv(p, [bad1, bad2])
    result = run_lint(p)
    assert result.returncode != 0
    out = result.stdout + result.stderr
    assert "current_tier" in out
    assert "data_format" in out


def test_lint_summary_includes_row_count(tmp_path):
    p = tmp_path / "valid.csv"
    write_csv(p, [VALID_ROW, VALID_ROW])
    result = run_lint(p)
    assert result.returncode == 0
    assert "2" in result.stdout
