"""Schema and validation for coverage-audit CSVs.

Single source of truth for column order, controlled vocabularies,
the priority-score formula, and per-row validation. Used by both
lint_coverage_audit.py and merge_coverage_audit.py.
"""
from __future__ import annotations

from dataclasses import dataclass

# --- Controlled vocabularies (spec §1, §3.2, §3.4) -----------------

CURRENT_TIER_ENUM: set[str] = {
    "T1a", "T1b", "T1c", "T2", "T2-flare", "T3", "not-modelled",
}

PHENOMENON_ENUM: set[str] = {
    "curtailment-renewable", "flare-associated-gas", "both", "none-expected",
}

COVERAGE_STATUS_ENUM: set[str] = {
    "published", "documented-gap", "unknown",
}

DATA_FORMAT_ENUM: set[str] = {
    "JSON-API", "CSV-download", "parseable-HTML-table", "XLSX-table",
    "XML-feed", "PDF-only", "auth-walled", "JS-rendered-SPA",
    "geo-blocked", "unreachable", "no-public-data",
}

RECOMMENDED_ACTION_ENUM: set[str] = {
    "promote-to-T1", "introduce-as-T1", "introduce-as-T3",
    "leave-T3", "leave-existing-T1+", "leave-not-modelled",
    "blocked-document-only",
}

RECOMMENDED_TIER_LANDING_ENUM: set[str] = {
    "T1a", "T1b", "T1c", "T2", "T3", "not-applicable",
}

LOADER_PATTERN_HINT_ENUM: set[str] = {
    "Pattern-A", "Pattern-B", "Pattern-C", "Pattern-D", "not-applicable",
}

# --- Priority-score weights (spec §4.5) ----------------------------

FORMAT_WEIGHTS: dict[str, float] = {
    "JSON-API": 1.0,
    "CSV-download": 0.9,
    "parseable-HTML-table": 0.7,
    "XML-feed": 0.7,
    "XLSX-table": 0.6,
    "JS-rendered-SPA": 0.4,
    "auth-walled": 0.2,
    "geo-blocked": 0.1,
    "PDF-only": 0.1,
    "unreachable": 0.0,
    "no-public-data": 0.0,
}

# --- Column order (spec §1, columns 1–17) --------------------------

COLUMN_ORDER: list[str] = [
    "country",
    "subdivision",
    "operator_name",
    "operator_url",
    "region_id_in_project",
    "current_tier",
    "phenomenon",
    "coverage_status",
    "data_format",
    "probe_result",
    "available_anchor",
    "annual_anchor_TWh",
    "recommended_action",
    "recommended_tier_landing",
    "loader_pattern_hint",
    "priority_score",
    "notes",
]

NOTES_MAX_CHARS = 200


@dataclass
class Row:
    """One operator row."""
    country: str
    subdivision: str
    operator_name: str
    operator_url: str
    region_id_in_project: str
    current_tier: str
    phenomenon: str
    coverage_status: str
    data_format: str
    probe_result: str
    available_anchor: str
    annual_anchor_TWh: float
    recommended_action: str
    recommended_tier_landing: str
    loader_pattern_hint: str
    priority_score: float
    notes: str


def priority_score(row: Row) -> float:
    """Spec §4.5:

        score = (anchor_TWh × tier_uplift_weight × format_accessibility_weight)
                - already_modelled_penalty
    """
    anchor_twh = row.annual_anchor_TWh
    if anchor_twh <= 0:
        return 0.0

    tier_uplift_weight = 0.6 if row.region_id_in_project else 1.0
    fmt_weight = FORMAT_WEIGHTS.get(row.data_format, 0.0)
    base = anchor_twh * tier_uplift_weight * fmt_weight
    penalty = 0.5 * anchor_twh if row.region_id_in_project else 0.0
    return base - penalty


def validate_row(row: Row, line_no: int) -> list[str]:
    """Return list of error strings for this row (empty list = valid)."""
    errors: list[str] = []

    def check_enum(field: str, value: str, allowed: set[str]) -> None:
        if value not in allowed:
            errors.append(
                f"line {line_no}: {field}={value!r} not in {sorted(allowed)}"
            )

    check_enum("current_tier", row.current_tier, CURRENT_TIER_ENUM)
    check_enum("phenomenon", row.phenomenon, PHENOMENON_ENUM)
    check_enum("coverage_status", row.coverage_status, COVERAGE_STATUS_ENUM)
    check_enum("data_format", row.data_format, DATA_FORMAT_ENUM)
    check_enum("recommended_action", row.recommended_action, RECOMMENDED_ACTION_ENUM)
    check_enum("recommended_tier_landing", row.recommended_tier_landing, RECOMMENDED_TIER_LANDING_ENUM)
    check_enum("loader_pattern_hint", row.loader_pattern_hint, LOADER_PATTERN_HINT_ENUM)

    if not row.country:
        errors.append(f"line {line_no}: country is empty")
    if not row.operator_name:
        errors.append(f"line {line_no}: operator_name is empty")
    if not row.operator_url:
        errors.append(f"line {line_no}: operator_url is empty")

    if row.annual_anchor_TWh < 0:
        errors.append(f"line {line_no}: annual_anchor_TWh={row.annual_anchor_TWh} is negative")

    if row.notes and len(row.notes) > NOTES_MAX_CHARS:
        errors.append(
            f"line {line_no}: notes is {len(row.notes)} chars (>{NOTES_MAX_CHARS})"
        )

    if row.recommended_action == "promote-to-T1" and not row.region_id_in_project:
        errors.append(
            f"line {line_no}: recommended_action=promote-to-T1 requires non-empty region_id_in_project"
        )
    if row.recommended_action == "introduce-as-T1" and row.region_id_in_project:
        errors.append(
            f"line {line_no}: recommended_action=introduce-as-T1 requires empty region_id_in_project (got {row.region_id_in_project!r})"
        )
    if row.recommended_action in {"introduce-as-T1", "promote-to-T1"} and row.available_anchor in {"none", ""}:
        errors.append(
            f"line {line_no}: recommended_action={row.recommended_action} requires non-'none' available_anchor"
        )

    return errors
