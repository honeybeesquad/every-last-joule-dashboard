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


def test_column_order_has_20_entries():
    assert len(schema.COLUMN_ORDER) == 20
    assert schema.COLUMN_ORDER[0] == "country"
    assert schema.COLUMN_ORDER[11] == "annual_anchor_TWh"
    assert schema.COLUMN_ORDER[15] == "priority_score"
    assert schema.COLUMN_ORDER[-3:] == [
        "parent_region_id", "granularity_available", "expected_new_regions",
    ]


# --- v2: granularity-split scoring (spec: no already-modelled penalty) ---

def test_priority_score_split_row_plant_json_api():
    # 4 TWh × 1.0 (plant) × 1.0 (JSON-API) = 4.0; penalty must NOT apply
    # even though region_id_in_project is set.
    row = make_row(
        annual_anchor_TWh=4.0,
        region_id_in_project="brazil-ne",
        parent_region_id="brazil-ne",
        granularity_available="plant",
        data_format="JSON-API",
    )
    assert schema.priority_score(row) == 4.0


def test_priority_score_split_row_fuel_split_csv():
    # 4 TWh × 0.7 (fuel-split) × 0.9 (CSV-download) = 2.52
    row = make_row(
        annual_anchor_TWh=4.0,
        parent_region_id="japan-kyushu",
        granularity_available="fuel-split",
        data_format="CSV-download",
    )
    assert abs(schema.priority_score(row) - 2.52) < 1e-9


def test_priority_score_gap_rows_unchanged_by_v2_fields():
    # Default v2 fields (empty parent) must reproduce the v1 formula exactly.
    row = make_row(annual_anchor_TWh=4.0, region_id_in_project="", data_format="JSON-API")
    assert schema.priority_score(row) == 4.0


# --- v2: validation rules ---

def test_validate_catches_bad_granularity_enum():
    row = make_row(granularity_available="county")
    assert any("granularity_available" in e for e in schema.validate_row(row, 2))


def test_validate_rejects_bad_parent_region_id_pattern():
    row = make_row(parent_region_id="Bad_ID", granularity_available="state")
    assert any("parent_region_id" in e for e in schema.validate_row(row, 2))


def test_validate_rejects_negative_expected_new_regions():
    row = make_row(expected_new_regions=-1)
    assert any("expected_new_regions" in e for e in schema.validate_row(row, 2))


def test_validate_rejects_split_row_with_granularity_none():
    row = make_row(parent_region_id="brazil-ne", granularity_available="none")
    assert any("granularity_available" in e for e in schema.validate_row(row, 2))


def test_v1_world_csv_scores_are_byte_stable_under_v2():
    """Every committed priority_score in the migrated 2026-04-26 file must be
    reproduced exactly by the v2 formula (spec: v1 scores byte-stable)."""
    import csv
    csv_path = Path(__file__).parents[2] / "data" / "coverage-audit" / "2026-04-26-world.csv"
    with csv_path.open(newline="") as f:
        for d in csv.DictReader(f):
            row = schema.Row(
                country=d["country"], subdivision=d["subdivision"],
                operator_name=d["operator_name"], operator_url=d["operator_url"],
                region_id_in_project=d["region_id_in_project"], current_tier=d["current_tier"],
                phenomenon=d["phenomenon"], coverage_status=d["coverage_status"],
                data_format=d["data_format"], probe_result=d["probe_result"],
                available_anchor=d["available_anchor"],
                annual_anchor_TWh=float(d["annual_anchor_TWh"] or 0),
                recommended_action=d["recommended_action"],
                recommended_tier_landing=d["recommended_tier_landing"],
                loader_pattern_hint=d["loader_pattern_hint"],
                priority_score=float(d["priority_score"] or 0), notes=d["notes"],
                parent_region_id=d["parent_region_id"],
                granularity_available=d["granularity_available"],
                expected_new_regions=int(d["expected_new_regions"] or 0),
            )
            assert f"{schema.priority_score(row):.4f}" == d["priority_score"], d["operator_name"]
