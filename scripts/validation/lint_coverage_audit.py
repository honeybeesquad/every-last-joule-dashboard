#!/usr/bin/env python3
"""Lint a coverage-audit CSV against the schema.

Usage:
    python3 scripts/validation/lint_coverage_audit.py <csv-path> [<csv-path> ...]

Exits 0 if every row in every file passes validate_row(); exits 1 otherwise,
printing all errors to stderr.
"""
from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import coverage_audit_schema as schema


def lint_file(path: Path) -> tuple[int, list[str]]:
    """Return (rows_seen, errors)."""
    errors: list[str] = []

    with path.open("r", newline="") as f:
        reader = csv.reader(f)
        header = next(reader, None)
        if header is None:
            return 0, [f"{path}: empty file"]

        if header != schema.COLUMN_ORDER:
            missing = set(schema.COLUMN_ORDER) - set(header)
            extra = set(header) - set(schema.COLUMN_ORDER)
            return 0, [
                f"{path}: header column mismatch. "
                f"missing={sorted(missing)} extra={sorted(extra)}"
            ]

        rows_seen = 0
        for line_no, raw in enumerate(reader, start=2):
            rows_seen += 1
            if len(raw) != len(schema.COLUMN_ORDER):
                errors.append(
                    f"{path}:line {line_no}: expected {len(schema.COLUMN_ORDER)} columns, got {len(raw)}"
                )
                continue
            try:
                row_dict = dict(zip(schema.COLUMN_ORDER, raw))
                row = schema.Row(
                    country=row_dict["country"],
                    subdivision=row_dict["subdivision"],
                    operator_name=row_dict["operator_name"],
                    operator_url=row_dict["operator_url"],
                    region_id_in_project=row_dict["region_id_in_project"],
                    current_tier=row_dict["current_tier"],
                    phenomenon=row_dict["phenomenon"],
                    coverage_status=row_dict["coverage_status"],
                    data_format=row_dict["data_format"],
                    probe_result=row_dict["probe_result"],
                    available_anchor=row_dict["available_anchor"],
                    annual_anchor_TWh=float(row_dict["annual_anchor_TWh"]),
                    recommended_action=row_dict["recommended_action"],
                    recommended_tier_landing=row_dict["recommended_tier_landing"],
                    loader_pattern_hint=row_dict["loader_pattern_hint"],
                    priority_score=float(row_dict["priority_score"] or 0),
                    notes=row_dict["notes"],
                    parent_region_id=row_dict["parent_region_id"],
                    granularity_available=row_dict["granularity_available"],
                    expected_new_regions=int(float(row_dict["expected_new_regions"] or 0)),
                )
            except ValueError as exc:
                errors.append(f"{path}:line {line_no}: failed to coerce types: {exc}")
                continue

            for err in schema.validate_row(row, line_no=line_no):
                errors.append(f"{path}: {err}")

    return rows_seen, errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Lint coverage-audit CSV(s).")
    parser.add_argument("paths", nargs="+", type=Path)
    args = parser.parse_args()

    total_rows = 0
    all_errors: list[str] = []

    for p in args.paths:
        rows_seen, errs = lint_file(p)
        total_rows += rows_seen
        all_errors.extend(errs)

    if all_errors:
        for e in all_errors:
            print(e, file=sys.stderr)
        print(
            f"\nFAIL: {len(all_errors)} error(s) across {len(args.paths)} file(s) ({total_rows} rows)",
            file=sys.stderr,
        )
        return 1

    print(f"OK: {total_rows} rows across {len(args.paths)} file(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
