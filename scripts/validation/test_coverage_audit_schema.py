"""Tests for coverage_audit_schema."""
from __future__ import annotations

import sys
from pathlib import Path

# Make sibling import work without packaging.
sys.path.insert(0, str(Path(__file__).parent))

import coverage_audit_schema as schema


def make_row(**overrides) -> schema.Row:
    """Return a known-valid Row, with optional overrides."""
    base = dict(
        country="VNM / Vietnam",
        subdivision="",
        operator_name="EVN-NLDC",
        operator_url="https://www.evn.com.vn/",
        region_id_in_project="",
        current_tier="not-modelled",
        phenomenon="curtailment-renewable",
        coverage_status="published",
        data_format="JSON-API",
        probe_result="200 / application/json",
        available_anchor="EVN 2024 Operations Report",
        annual_anchor_TWh=4.0,
        recommended_action="introduce-as-T1",
        recommended_tier_landing="T1a",
        loader_pattern_hint="Pattern-A",
        priority_score=0.0,
        notes="",
    )
    base.update(overrides)
    return schema.Row(**base)


def test_priority_score_zero_for_no_anchor():
    row = make_row(annual_anchor_TWh=0.0)
    assert schema.priority_score(row) == 0.0


def test_priority_score_introducing_new_with_json_api():
    # 4 TWh × 1.0 (introducing-new) × 1.0 (JSON-API) - 0 (penalty) = 4.0
    row = make_row(annual_anchor_TWh=4.0, region_id_in_project="", data_format="JSON-API")
    assert schema.priority_score(row) == 4.0


def test_priority_score_promote_existing_t3_with_csv_download():
    # 2 TWh × 0.6 (promoting T3) × 0.9 (CSV) - 0.5×2 (penalty) = 1.08 - 1.0 = 0.08
    row = make_row(
        annual_anchor_TWh=2.0,
        region_id_in_project="vietnam",
        current_tier="T3",
        data_format="CSV-download",
        recommended_action="promote-to-T1",
        recommended_tier_landing="T1a",
    )
    assert abs(schema.priority_score(row) - 0.08) < 1e-9


def test_priority_score_unreachable_zeros_format_weight():
    row = make_row(annual_anchor_TWh=10.0, data_format="unreachable")
    # 10 × 1.0 × 0.0 - 0 = 0.0
    assert schema.priority_score(row) == 0.0


def test_validate_passes_for_valid_row():
    row = make_row()
    assert schema.validate_row(row, line_no=2) == []


def test_validate_catches_bad_current_tier_enum():
    row = make_row(current_tier="T1d-invented")
    errors = schema.validate_row(row, line_no=2)
    assert any("current_tier" in e for e in errors)


def test_validate_catches_bad_data_format_enum():
    row = make_row(data_format="GraphQL-feed")
    errors = schema.validate_row(row, line_no=2)
    assert any("data_format" in e for e in errors)


def test_validate_requires_country():
    row = make_row(country="")
    errors = schema.validate_row(row, line_no=2)
    assert any("country" in e for e in errors)


def test_validate_requires_operator_name():
    row = make_row(operator_name="")
    errors = schema.validate_row(row, line_no=2)
    assert any("operator_name" in e for e in errors)


def test_validate_rejects_negative_anchor_twh():
    row = make_row(annual_anchor_TWh=-1.5)
    errors = schema.validate_row(row, line_no=2)
    assert any("annual_anchor_TWh" in e and "negative" in e for e in errors)


def test_validate_rejects_promote_without_region_id():
    row = make_row(
        recommended_action="promote-to-T1",
        region_id_in_project="",  # contradiction
    )
    errors = schema.validate_row(row, line_no=2)
    assert any("promote-to-T1" in e and "region_id_in_project" in e for e in errors)


def test_validate_rejects_introduce_with_region_id():
    row = make_row(
        recommended_action="introduce-as-T1",
        region_id_in_project="some-existing-region",  # contradiction
    )
    errors = schema.validate_row(row, line_no=2)
    assert any("introduce-as-T1" in e and "region_id_in_project" in e for e in errors)


def test_validate_rejects_introduce_with_none_anchor():
    row = make_row(
        recommended_action="introduce-as-T1",
        available_anchor="none",
    )
    errors = schema.validate_row(row, line_no=2)
    assert any("available_anchor" in e for e in errors)


def test_validate_rejects_notes_over_200_chars():
    row = make_row(notes="x" * 201)
    errors = schema.validate_row(row, line_no=2)
    assert any("notes" in e and "200" in e for e in errors)


def test_column_order_has_17_entries():
    assert len(schema.COLUMN_ORDER) == 17
    # Spot-check known column names exist in expected positions.
    assert schema.COLUMN_ORDER[0] == "country"
    assert schema.COLUMN_ORDER[11] == "annual_anchor_TWh"
    assert schema.COLUMN_ORDER[15] == "priority_score"
