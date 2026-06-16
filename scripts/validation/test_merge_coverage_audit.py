"""Tests for merge_coverage_audit CLI."""
from __future__ import annotations

import csv
import subprocess
import sys
from pathlib import Path

MERGE_SCRIPT = Path(__file__).parent / "merge_coverage_audit.py"

HEADER = [
    "country", "subdivision", "operator_name", "operator_url",
    "region_id_in_project", "current_tier", "phenomenon",
    "coverage_status", "data_format", "probe_result", "available_anchor",
    "annual_anchor_TWh", "recommended_action", "recommended_tier_landing",
    "loader_pattern_hint", "priority_score", "notes",
    "parent_region_id", "granularity_available", "expected_new_regions",
]


def make_row(country, op, **kw):
    """Return a list-row with sensible defaults; override via kwargs."""
    base = {
        "country": country,
        "subdivision": "",
        "operator_name": op,
        "operator_url": f"https://example.com/{op}",
        "region_id_in_project": "",
        "current_tier": "not-modelled",
        "phenomenon": "curtailment-renewable",
        "coverage_status": "published",
        "data_format": "JSON-API",
        "probe_result": "200",
        "available_anchor": "Some 2024 report",
        "annual_anchor_TWh": "1.0",
        "recommended_action": "introduce-as-T1",
        "recommended_tier_landing": "T1a",
        "loader_pattern_hint": "Pattern-A",
        "priority_score": "0.0",  # will be recomputed by merge
        "notes": "",
        "parent_region_id": "",
        "granularity_available": "none",
        "expected_new_regions": "0",
    }
    base.update(kw)
    return [base[k] for k in HEADER]


def write(path, rows):
    with path.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(HEADER)
        for r in rows:
            w.writerow(r)


def read(path):
    with path.open("r", newline="") as f:
        return list(csv.reader(f))


def run_merge(*inputs, output):
    return subprocess.run(
        [sys.executable, str(MERGE_SCRIPT), "--output", str(output), *map(str, inputs)],
        capture_output=True, text=True,
    )


def test_merge_concat_two_files(tmp_path):
    a = tmp_path / "a.csv"; b = tmp_path / "b.csv"; out = tmp_path / "out.csv"
    write(a, [make_row("VNM / Vietnam", "EVN-NLDC")])
    write(b, [make_row("THA / Thailand", "EGAT")])
    result = run_merge(a, b, output=out)
    assert result.returncode == 0, result.stdout + result.stderr
    rows = read(out)
    assert len(rows) == 3  # header + 2 rows


def test_merge_dedupes_on_identity_triple(tmp_path):
    a = tmp_path / "a.csv"; b = tmp_path / "b.csv"; out = tmp_path / "out.csv"
    write(a, [make_row("VNM / Vietnam", "EVN-NLDC")])
    write(b, [make_row("VNM / Vietnam", "EVN-NLDC", available_anchor="Different anchor")])
    result = run_merge(a, b, output=out)
    assert result.returncode == 0
    rows = read(out)
    assert len(rows) == 2  # header + 1 (deduped)


def test_merge_recomputes_priority_score(tmp_path):
    a = tmp_path / "a.csv"; out = tmp_path / "out.csv"
    # 4 TWh × 1.0 (introducing) × 1.0 (JSON-API) - 0 = 4.0
    write(a, [make_row("VNM / Vietnam", "EVN-NLDC",
                       annual_anchor_TWh="4.0", priority_score="999.0")])
    result = run_merge(a, output=out)
    assert result.returncode == 0
    rows = read(out)
    score_idx = HEADER.index("priority_score")
    assert float(rows[1][score_idx]) == 4.0


def test_merge_sorts_by_priority_then_tier_then_country(tmp_path):
    a = tmp_path / "a.csv"; out = tmp_path / "out.csv"
    write(a, [
        make_row("ZAF / South Africa", "ESKOM", annual_anchor_TWh="1.0"),  # score 1.0
        make_row("VNM / Vietnam", "EVN-NLDC", annual_anchor_TWh="4.0"),    # score 4.0
        make_row("THA / Thailand", "EGAT", annual_anchor_TWh="2.0"),       # score 2.0
    ])
    result = run_merge(a, output=out)
    rows = read(out)
    # Descending priority score order: VNM (4.0), THA (2.0), ZAF (1.0)
    assert rows[1][0] == "VNM / Vietnam"
    assert rows[2][0] == "THA / Thailand"
    assert rows[3][0] == "ZAF / South Africa"


def test_merge_fails_if_dedupe_finds_conflicting_rows(tmp_path):
    """Two rows with same identity-triple but materially different recommended_action."""
    a = tmp_path / "a.csv"; b = tmp_path / "b.csv"; out = tmp_path / "out.csv"
    write(a, [make_row("VNM / Vietnam", "EVN-NLDC", recommended_action="introduce-as-T1")])
    write(b, [make_row("VNM / Vietnam", "EVN-NLDC", recommended_action="introduce-as-T3")])
    result = run_merge(a, b, output=out)
    assert result.returncode != 0
    assert "conflict" in (result.stdout + result.stderr).lower()
