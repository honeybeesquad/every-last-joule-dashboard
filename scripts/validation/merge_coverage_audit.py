#!/usr/bin/env python3
"""Merge per-continent coverage-audit CSVs into a master CSV.

- Concatenates input rows.
- Dedupes on identity triple (country, subdivision, operator_name).
- On dedupe, fails if rows conflict on recommended_action or coverage_status
  (both are decision-critical fields).
- Recomputes priority_score per current schema.
- Sorts by priority_score desc, then current_tier (T1a < T1b < T1c < T2 <
  T2-flare < T3 < not-modelled), then country.

Usage:
    python3 scripts/validation/merge_coverage_audit.py \
        --output data/coverage-audit/2026-04-26-world.csv \
        data/coverage-audit/2026-04-26-asia-east.csv \
        ...
"""
from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import coverage_audit_schema as schema

TIER_ORDER = ["T1a", "T1b", "T1c", "T2", "T2-flare", "T3", "not-modelled"]
TIER_RANK = {t: i for i, t in enumerate(TIER_ORDER)}

CONFLICT_FIELDS = ("recommended_action", "coverage_status")


def read_rows(path: Path) -> list[dict[str, str]]:
    with path.open("r", newline="") as f:
        reader = csv.DictReader(f)
        if reader.fieldnames != schema.COLUMN_ORDER:
            raise SystemExit(
                f"{path}: header mismatch. expected={schema.COLUMN_ORDER} got={reader.fieldnames}"
            )
        return list(reader)


def identity(d: dict[str, str]) -> tuple[str, str, str]:
    return (d["country"], d["subdivision"], d["operator_name"])


def dict_to_row(d: dict[str, str]) -> schema.Row:
    return schema.Row(
        country=d["country"],
        subdivision=d["subdivision"],
        operator_name=d["operator_name"],
        operator_url=d["operator_url"],
        region_id_in_project=d["region_id_in_project"],
        current_tier=d["current_tier"],
        phenomenon=d["phenomenon"],
        coverage_status=d["coverage_status"],
        data_format=d["data_format"],
        probe_result=d["probe_result"],
        available_anchor=d["available_anchor"],
        annual_anchor_TWh=float(d["annual_anchor_TWh"] or 0),
        recommended_action=d["recommended_action"],
        recommended_tier_landing=d["recommended_tier_landing"],
        loader_pattern_hint=d["loader_pattern_hint"],
        priority_score=float(d["priority_score"] or 0),
        notes=d["notes"],
        parent_region_id=d.get("parent_region_id", ""),
        granularity_available=d.get("granularity_available", "none"),
        expected_new_regions=int(float(d.get("expected_new_regions") or 0)),
    )


def merge(input_paths: list[Path], output: Path) -> int:
    seen: dict[tuple[str, str, str], dict[str, str]] = {}

    for p in input_paths:
        for d in read_rows(p):
            key = identity(d)
            if key in seen:
                prev = seen[key]
                conflicts = [f for f in CONFLICT_FIELDS if prev[f] != d[f]]
                if conflicts:
                    print(
                        f"merge conflict for {key} in {p}: "
                        f"fields={conflicts} prev={ {f: prev[f] for f in conflicts} } new={ {f: d[f] for f in conflicts} }",
                        file=sys.stderr,
                    )
                    return 1
                # Non-conflicting duplicate: keep the first.
                continue
            seen[key] = d

    # Recompute priority_score from current schema, then sort.
    enriched: list[dict[str, str]] = []
    for d in seen.values():
        row_obj = dict_to_row(d)
        d["priority_score"] = f"{schema.priority_score(row_obj):.4f}"
        enriched.append(d)

    enriched.sort(
        key=lambda d: (
            -float(d["priority_score"]),
            TIER_RANK.get(d["current_tier"], 999),
            d["country"],
        )
    )

    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=schema.COLUMN_ORDER)
        writer.writeheader()
        for d in enriched:
            writer.writerow(d)

    print(f"OK: wrote {len(enriched)} rows to {output}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Merge coverage-audit CSVs.")
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("inputs", nargs="+", type=Path)
    args = parser.parse_args()
    return merge(args.inputs, args.output)


if __name__ == "__main__":
    sys.exit(main())
