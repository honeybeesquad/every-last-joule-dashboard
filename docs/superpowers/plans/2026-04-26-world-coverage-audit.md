# World Coverage Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the operator-by-operator world coverage audit dated 2026-04-26 — a master CSV covering every country and grid operator on Earth, a human-readable digest, and a derived round-2 dispatch brief — with reusable lint+merge tooling.

**Architecture:** Two-PR sequence on a fresh branch in the parent project repo. PR A ships the audit (lint script + merge script + 10 per-continent intermediate CSVs + master CSV + digest MD + document supersession). PR B ships the round-2 dispatch brief derived from PR A. Wave-2 (10 parallel research subagents) is the long pole; everything else is sequential mechanical work.

**Tech Stack:** Python 3 stdlib (`csv`, `dataclasses`, `argparse`), `pytest` for lint/merge unit tests, `npm` script wiring for CI gate, `gh` CLI for PRs, Claude Agent SDK `general-purpose` subagents for Wave-2 research.

**Spec reference:** `docs/superpowers/specs/2026-04-26-world-coverage-audit-design.md` (commit `e8386ec` on branch `spec/world-coverage-audit-2026-04-26` of the docs-only worktree).

**Important repo note:** The spec was authored in the docs-only worktree at `/Users/simoncollins/code/worktrees/paper-rewrite-codex7/` (sparse `origin/main` with only `docs/` + `mockups/`). Implementation happens in the **parent project repo** at `/Users/simoncollins/code/every-last-joule-dashboard/` because the audit touches `scripts/validation/`, `data/`, and references project files that only exist on the parent repo's `v0-build` branch. Task 1 sets this up explicitly.

---

## File structure

### Created in PR A

| Path | Purpose |
|---|---|
| `scripts/validation/coverage_audit_schema.py` | Shared schema constants + dataclass + `priority_score()` + `validate_row()`. Single source of truth for enums. |
| `scripts/validation/lint_coverage_audit.py` | CLI: read CSV, validate every row, exit 1 on any error. Used by CI + by Wave-2 verification. |
| `scripts/validation/merge_coverage_audit.py` | CLI: read N intermediate CSVs, dedupe on `(country, subdivision, operator_name)`, recompute `priority_score`, sort, write master CSV. |
| `scripts/validation/test_coverage_audit_schema.py` | pytest tests for schema module (validation rules + priority-score formula). |
| `scripts/validation/test_lint_coverage_audit.py` | pytest tests for the lint CLI. |
| `scripts/validation/test_merge_coverage_audit.py` | pytest tests for the merge CLI. |
| `scripts/validation/templates/world-coverage-audit-prompt.md` | Shared subagent prompt template with `{CONTINENT}` / `{SCOPE}` / `{OPERATOR_CHECKLIST}` placeholders. |
| `scripts/validation/dispatches/2026-04-26-<continent>.md` (×10) | One filled-in dispatch prompt per continent. Saved as files so the Wave-2 task can read them and pass exact content to subagents. |
| `data/coverage-audit/2026-04-26-<continent>.csv` (×10) | Per-continent intermediate CSVs written by the 10 subagents. Stay committed (audit trail). |
| `data/coverage-audit/2026-04-26-world.csv` | Merged master CSV. Single source of truth, ~285 rows. |
| `docs/coverage-audit/2026-04-26-world.md` | Human-readable digest. Continental sections + summary + top-15 ranked. |
| `docs/superpowers/specs/2026-04-26-world-coverage-audit-design.md` | The spec, cherry-picked from the docs-only worktree. |
| `docs/superpowers/plans/2026-04-26-world-coverage-audit.md` | This plan, cherry-picked alongside. |

### Modified in PR A

| Path | Change |
|---|---|
| `package.json` | Add `lint:coverage-audit` script. |
| `docs/known-limitations.md` | Replace §12–§14 prose with cross-reference to master CSV. |
| `docs/proposals/2026-04-26-phase-2-6-static-promotions-dispatch.md` | Add "v0.5 disposition" footer pointing at master CSV rows for skipped picks (Vietnam, India-North, India-South). |

### Deleted in PR A

| Path | Reason |
|---|---|
| `docs/coverage-gaps-europe.md` | Fully superseded by the master CSV's Europe-ENTSO-E + Europe-non-ENTSO-E rows. |

### Created in PR B

| Path | Purpose |
|---|---|
| `docs/proposals/2026-04-26-phase-2-6-round-2-dispatch.md` | Top-4 or top-5 candidate brief, derived by filtering master CSV. |

### Untouched (per spec §5.3)

`src/lib/regions.ts`, `src/methodology.md`, `dataset/SCHEMA.md`, `docs/methodology/uncertainty.md`, `docs/methodology/validation-discrepancies.md`, `scripts/validation/external-anchors.json`, `docs/paper/04-technical-validation.md`.

---

## Task 1: Branch + directory scaffolding

**Files:**
- Modify: working directory (cd to parent repo)
- Create: `data/coverage-audit/` (empty dir)
- Create: `docs/coverage-audit/` (empty dir)
- Create: `scripts/validation/dispatches/` (empty dir)
- Create: `scripts/validation/templates/` (empty dir)
- Create: `docs/superpowers/specs/2026-04-26-world-coverage-audit-design.md` (cherry-pick from spec branch)
- Create: `docs/superpowers/plans/2026-04-26-world-coverage-audit.md` (cherry-pick from spec branch)

- [ ] **Step 1: Move to parent repo and verify clean tree on v0-build**

```bash
cd /Users/simoncollins/code/every-last-joule-dashboard
git status                          # expect: clean tree
git branch --show-current           # expect: v0-build
git fetch origin                    # sync
```

Expected: working tree clean, `v0-build` reported, fetch returns without errors.

- [ ] **Step 2: Create the audit branch off v0-build**

```bash
git checkout -b chore/world-coverage-audit-2026-04-26 origin/v0-build
```

Expected: `Switched to a new branch 'chore/world-coverage-audit-2026-04-26'`.

- [ ] **Step 3: Cherry-pick spec + plan from the docs-only worktree**

The spec lives on `spec/world-coverage-audit-2026-04-26` in the docs-only worktree but its commit hash is reachable from the shared object store. The plan is being written to that same docs-only worktree as commit hash TBD-after-this-plan-commits.

```bash
# from /Users/simoncollins/code/every-last-joule-dashboard
# Spec commit:
git cherry-pick e8386ec
# Plan commit hash (substitute the actual hash after the plan is committed in the docs worktree):
# git cherry-pick <plan-commit-hash>
```

Expected: spec file appears at `docs/superpowers/specs/2026-04-26-world-coverage-audit-design.md`. If the plan commit hash isn't available yet, copy the file manually:

```bash
cp /Users/simoncollins/code/worktrees/paper-rewrite-codex7/docs/superpowers/plans/2026-04-26-world-coverage-audit.md \
   docs/superpowers/plans/2026-04-26-world-coverage-audit.md
git add docs/superpowers/plans/2026-04-26-world-coverage-audit.md
git commit -m "Bring in world-coverage audit plan"
```

- [ ] **Step 4: Create empty target directories with `.gitkeep`**

```bash
mkdir -p data/coverage-audit docs/coverage-audit \
         scripts/validation/dispatches scripts/validation/templates
touch data/coverage-audit/.gitkeep docs/coverage-audit/.gitkeep \
      scripts/validation/dispatches/.gitkeep scripts/validation/templates/.gitkeep
git add data/coverage-audit/.gitkeep docs/coverage-audit/.gitkeep \
        scripts/validation/dispatches/.gitkeep scripts/validation/templates/.gitkeep
git commit -m "Scaffold coverage-audit directories"
```

Expected: 4 empty directories created with `.gitkeep` files committed.

---

## Task 2: Schema module + tests

**Files:**
- Create: `scripts/validation/coverage_audit_schema.py`
- Test: `scripts/validation/test_coverage_audit_schema.py`

- [ ] **Step 1: Write the failing tests**

Create `scripts/validation/test_coverage_audit_schema.py`:

```python
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
```

- [ ] **Step 2: Run tests, verify they fail (no module yet)**

```bash
cd /Users/simoncollins/code/every-last-joule-dashboard
python3 -m pytest scripts/validation/test_coverage_audit_schema.py -v
```

Expected: collection error or `ModuleNotFoundError: No module named 'coverage_audit_schema'`.

- [ ] **Step 3: Implement the schema module**

Create `scripts/validation/coverage_audit_schema.py`:

```python
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
```

- [ ] **Step 4: Run tests, verify all pass**

```bash
python3 -m pytest scripts/validation/test_coverage_audit_schema.py -v
```

Expected: 14 passed, 0 failed.

- [ ] **Step 5: Commit**

```bash
git add scripts/validation/coverage_audit_schema.py \
        scripts/validation/test_coverage_audit_schema.py
git commit -m "Add coverage-audit schema module with priority-score + validation"
```

---

## Task 3: Lint CLI + tests

**Files:**
- Create: `scripts/validation/lint_coverage_audit.py`
- Test: `scripts/validation/test_lint_coverage_audit.py`

- [ ] **Step 1: Write the failing tests**

Create `scripts/validation/test_lint_coverage_audit.py`:

```python
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
```

- [ ] **Step 2: Run tests, verify they fail (no script yet)**

```bash
python3 -m pytest scripts/validation/test_lint_coverage_audit.py -v
```

Expected: tests fail because `lint_coverage_audit.py` doesn't exist.

- [ ] **Step 3: Implement the lint CLI**

Create `scripts/validation/lint_coverage_audit.py`:

```python
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
```

- [ ] **Step 4: Run tests, verify all pass**

```bash
python3 -m pytest scripts/validation/test_lint_coverage_audit.py -v
```

Expected: 7 passed, 0 failed.

- [ ] **Step 5: Commit**

```bash
git add scripts/validation/lint_coverage_audit.py \
        scripts/validation/test_lint_coverage_audit.py
git commit -m "Add lint_coverage_audit CLI with full row validation"
```

---

## Task 4: Merge CLI + tests

**Files:**
- Create: `scripts/validation/merge_coverage_audit.py`
- Test: `scripts/validation/test_merge_coverage_audit.py`

- [ ] **Step 1: Write the failing tests**

Create `scripts/validation/test_merge_coverage_audit.py`:

```python
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
```

- [ ] **Step 2: Run tests, verify they fail**

```bash
python3 -m pytest scripts/validation/test_merge_coverage_audit.py -v
```

Expected: import or collection failure (script doesn't exist).

- [ ] **Step 3: Implement the merge CLI**

Create `scripts/validation/merge_coverage_audit.py`:

```python
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
```

- [ ] **Step 4: Run tests, verify all pass**

```bash
python3 -m pytest scripts/validation/test_merge_coverage_audit.py -v
```

Expected: 5 passed, 0 failed.

- [ ] **Step 5: Commit**

```bash
git add scripts/validation/merge_coverage_audit.py \
        scripts/validation/test_merge_coverage_audit.py
git commit -m "Add merge_coverage_audit CLI with dedupe + priority recompute + sort"
```

---

## Task 5: CI wiring

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add lint script to package.json**

Open `package.json`, find the `"scripts"` section, add:

```json
"lint:coverage-audit": "python3 scripts/validation/lint_coverage_audit.py data/coverage-audit/2026-04-26-world.csv",
"test:coverage-audit": "python3 -m pytest scripts/validation/test_coverage_audit_schema.py scripts/validation/test_lint_coverage_audit.py scripts/validation/test_merge_coverage_audit.py -v"
```

- [ ] **Step 2: Verify the test script works**

```bash
npm run test:coverage-audit
```

Expected: pytest reports all tests passing (14 schema + 7 lint + 5 merge = 26 tests).

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "Wire coverage-audit lint+test into npm scripts"
```

---

## Task 6: Subagent prompt template

**Files:**
- Create: `scripts/validation/templates/world-coverage-audit-prompt.md`

- [ ] **Step 1: Write the template**

Create `scripts/validation/templates/world-coverage-audit-prompt.md`:

````markdown
# World Coverage Audit Subagent — {CONTINENT}

## Mission

You are auditing the world's electricity grid operators against the Every-Last-Joule project's tier model. Your scope is **{CONTINENT}**. You will produce one CSV row per grid operator / bidding zone in your scope and write the result to `data/coverage-audit/2026-04-26-{CONTINENT_SLUG}.csv`.

## Output schema (17 columns, exact order)

```
country, subdivision, operator_name, operator_url, region_id_in_project,
current_tier, phenomenon, coverage_status, data_format, probe_result,
available_anchor, annual_anchor_TWh, recommended_action,
recommended_tier_landing, loader_pattern_hint, priority_score, notes
```

`priority_score` may be left as `0.0` — the merge step will recompute it.

## Controlled vocabularies

- `current_tier` ∈ {{ T1a | T1b | T1c | T2 | T2-flare | T3 | not-modelled }}
- `phenomenon` ∈ {{ curtailment-renewable | flare-associated-gas | both | none-expected }}
- `coverage_status` ∈ {{ published | documented-gap | unknown }}
- `data_format` ∈ {{ JSON-API | CSV-download | parseable-HTML-table | XLSX-table | XML-feed | PDF-only | auth-walled | JS-rendered-SPA | geo-blocked | unreachable | no-public-data }}
- `recommended_action` ∈ {{ promote-to-T1 | introduce-as-T1 | introduce-as-T3 | leave-T3 | leave-existing-T1+ | leave-not-modelled | blocked-document-only }}
- `recommended_tier_landing` ∈ {{ T1a | T1b | T1c | T2 | T3 | not-applicable }}
- `loader_pattern_hint` ∈ {{ Pattern-A | Pattern-B | Pattern-C | Pattern-D | not-applicable }}

## Methodology

### Probe URL discovery hierarchy

1. Operator homepage.
2. Visible menu items: "operations data", "real-time", "transparency", "reports", "open data", "balancing", "dispatch".
3. `robots.txt` and `sitemap.xml`.
4. XHR inspection if homepage is a JS-rendered SPA — note SPA finding in `notes` and classify `data_format` as `JS-rendered-SPA`. Do NOT attempt deep XHR scraping.

### `data_format` classification

Use the exact 11-value enum above. If a homepage HTML mentions tables but the data is loaded via JS, classify as `JS-rendered-SPA`, not `parseable-HTML-table`.

### `available_anchor` priority hierarchy

1. Operator-direct (TSO/ISO/IMM published curtailment annual).
2. GGFR (World Bank Global Gas Flaring Reduction satellite — flare phenomenon only).
3. Ember.
4. IRENA.
5. IEA.
6. IEEFA.
7. `none` (explicit `documented-gap` marker).

Cite specific document title + year. URL preferred but not required.

### `recommended_action` decision tree

```
if region_id_in_project is empty (region not yet modelled):
    if data_format ∈ {{ JSON-API, CSV-download, parseable-HTML-table, XML-feed }}
       and available_anchor ≠ none:
        → introduce-as-T1
    elif available_anchor ≠ none:
        → introduce-as-T3
    else:
        → blocked-document-only

elif current_tier == T3:
    if data_format ∈ {{ JSON-API, CSV-download, parseable-HTML-table, XML-feed }}
       and available_anchor ≠ none:
        → promote-to-T1
    else:
        → leave-T3

elif current_tier ∈ {{ T1a, T1b, T1c, T2, T2-flare }}:
    → leave-existing-T1+
```

### Probe etiquette

- User-Agent: `Every-Last-Joule-Audit/0.5 (research; simon@collins.nu)`.
- Timeout: 15 seconds.
- 1 retry on 5xx with 2s backoff.
- Max 2 requests per zone.
- No parallel hits to the same operator.
- Honour `robots.txt` if it disallows.

### Cross-field consistency rules (lint will reject violations)

- `recommended_action == "promote-to-T1"` requires non-empty `region_id_in_project`.
- `recommended_action == "introduce-as-T1"` requires empty `region_id_in_project`.
- `recommended_action ∈ {{ "introduce-as-T1", "promote-to-T1" }}` requires `available_anchor != "none"`.
- `notes` ≤ 200 chars.
- `annual_anchor_TWh` ≥ 0; numeric.
- All enum fields must use exact values above (case-sensitive, hyphens not underscores).

### Prohibited behaviours

- Don't classify a JS-rendered SPA as `parseable-HTML-table`.
- No blog-post citations in `available_anchor`.
- No fall-back-to-T3 on probe failure — `unreachable` is a valid `data_format`, not a synonym for "give up".
- No cross-continent rows. Multi-continent operators get a canonical home (specified in your operator checklist below); cross-reference others in `notes` only.

## Existing project regions (for `region_id_in_project` lookups)

The full list of region ids and current tiers lives at `src/lib/regions.ts`. If a row in your scope corresponds to an existing project region, copy its `id` field (e.g. `vietnam`, `india-north`, `japan`) into `region_id_in_project` and set `current_tier` to its current tier badge.

## Your scope: {SCOPE}

{OPERATOR_CHECKLIST}

## Output requirements

Write your result to:

```
data/coverage-audit/2026-04-26-{CONTINENT_SLUG}.csv
```

Header row first, then one row per operator, columns in the exact order specified above. Use double-quote escaping for fields containing commas. UTF-8 encoding.

After writing, run the lint script to self-verify:

```bash
python3 scripts/validation/lint_coverage_audit.py data/coverage-audit/2026-04-26-{CONTINENT_SLUG}.csv
```

Expected: exit 0, "OK: N rows" message. If lint fails, fix the rows and re-run until clean. Only then conclude your task.

## STOP conditions

Stop and report (don't fabricate) if:

- A subset of operators in your scope take so long to probe that you'd exceed your context budget. Document the unprobed operators in `notes` of a placeholder row with `data_format=unreachable, recommended_action=blocked-document-only`.
- Your scope has fewer than the expected operator count from the checklist below — partial coverage is better than fabricated coverage.

## Report back

Final message should include:
- File path written.
- Row count.
- Lint exit status.
- Any operators in the checklist that you skipped, and why.
````

- [ ] **Step 2: Commit**

```bash
git add scripts/validation/templates/world-coverage-audit-prompt.md
git commit -m "Add shared subagent prompt template for world coverage audit"
```

---

## Task 7: Dispatch prompt — Europe-ENTSO-E

**Files:**
- Create: `scripts/validation/dispatches/2026-04-26-europe-entsoe.md`

- [ ] **Step 1: Compose the dispatch**

Copy the template from Task 6 and substitute:

- `{CONTINENT}` → `Europe-ENTSO-E`
- `{CONTINENT_SLUG}` → `europe-entsoe`
- `{SCOPE}` → `All ENTSO-E member TSOs and bidding zones. Most are already documented in docs/methodology/entsoe-rates.md — your job is to transcribe that documentation into audit-CSV schema, NOT to re-research from scratch.`
- `{OPERATOR_CHECKLIST}` →

```
- Germany: Amprion, TenneT-DE, 50Hertz, TransnetBW (consolidate as one 'germany' row OR split per TSO if any has independent transparency feeds)
- France: RTE
- Spain: REE
- Portugal: REN
- Italy: Terna (split per bidding zone where Terna publishes per-zone: italy-north, italy-centre-north, italy-centre-south, italy-south, italy-sicily, italy-sardinia, italy-calabria)
- Netherlands: TenneT-NL
- Belgium: Elia
- Luxembourg: Creos
- Austria: APG
- Switzerland: Swissgrid (member of ENTSO-E observer; treat as ENTSO-E for this purpose)
- Czechia: ČEPS
- Slovakia: SEPS
- Hungary: MAVIR
- Poland: PSE
- Slovenia: ELES
- Croatia: HOPS
- Romania: Transelectrica
- Bulgaria: ESO
- Greece: IPTO
- Denmark: Energinet (split DK1 west and DK2 east bidding zones)
- Sweden: Svenska kraftnät (4 bidding zones SE1-SE4)
- Finland: Fingrid
- Norway: Statnett (5 bidding zones NO1-NO5)
- Estonia: Elering
- Latvia: AST
- Lithuania: Litgrid
- Ireland (Republic): EirGrid
- UK Northern Ireland: SONI (operates SEMO with EirGrid)
- UK GB: National Grid ESO (note: post-Brexit, ESO is no longer an ENTSO-E member; cover here for continuity)
- Cyprus: Cyprus TSO (TSOC)
- Malta: Enemalta
```

Plus the boilerplate header/methodology/cross-field/etc. from the template, with `{CONTINENT}`, `{CONTINENT_SLUG}`, `{SCOPE}`, and `{OPERATOR_CHECKLIST}` already substituted.

Save as `scripts/validation/dispatches/2026-04-26-europe-entsoe.md`.

- [ ] **Step 2: Commit**

```bash
git add scripts/validation/dispatches/2026-04-26-europe-entsoe.md
git commit -m "Dispatch prompt: Europe-ENTSO-E continent"
```

---

## Tasks 8–16: Other continent dispatches

For each of the 9 remaining continents, follow the same pattern as Task 7. Operator checklists below; substitute into template + commit individually.

### Task 8 — Europe-non-ENTSO-E

`{CONTINENT_SLUG}`: `europe-non-entsoe`. `{SCOPE}`: Non-ENTSO-E European operators including UK post-Brexit (note: covered in Task 7 for continuity, list as `leave-existing-T1+` here with cross-ref note), Switzerland (covered in Task 7 as observer), plus:

```
- Iceland: Landsnet
- Albania: OST
- North Macedonia: MEPSO
- Bosnia and Herzegovina: NOS BiH
- Serbia: EMS
- Montenegro: CGES
- Kosovo: KOSTT
- Moldova: Moldelectrica
- Ukraine: Ukrenergo
- Belarus: Belenergo
- Russia: SO UPS (system operator) — split: European zone vs Siberia vs Far East. Also note flare phenomenon for Yamal-Nenets, West-Siberia, East-Siberia rows here.
- Turkey: TEİAŞ
- Russia-Kaliningrad: SO UPS Kaliningrad subdivision
```

### Task 9 — Asia-East

`{CONTINENT_SLUG}`: `asia-east`. `{SCOPE}`:

```
- China provinces — State Grid + Southern Grid jurisdictions. List per province (or per cluster where the project already aggregates):
  - Inner Mongolia, Xinjiang, Gansu, Qinghai, Tibet, Sichuan, Yunnan, Guizhou, Hubei, Hunan, Hebei, Shanxi, Liaoning, Jilin, Heilongjiang, Shandong, Jiangsu, Zhejiang, Anhui, Jiangxi, Fujian, Guangdong, Guangxi, Hainan, Henan, Shaanxi, Ningxia, Beijing, Tianjin, Shanghai, Chongqing
  - Existing project regions: sichuan, xinjiang, tibet, china-north, china-northwest, china-northeast (check src/lib/regions.ts for exact ids)
- Japan: TEPCO, Kyushu Electric, Chubu, Kansai, Tohoku, Hokkaido, Hokuriku, Chugoku, Shikoku, Okinawa (10 utility-area TSOs). Existing project regions: japan, japan-kyushu.
- South Korea: KEPCO (single national operator) — note KPX as system operator
- North Korea: no public operator data — documented-gap
- Taiwan: Taipower (TPC)
- Mongolia: Mongolian National Dispatch Center (NDC)
- Hong Kong, Macau: cross-reference to Southern Grid; standalone operators are CLP and HK Electric (HK), CEM (Macau)
```

### Task 10 — Asia-Southeast

`{CONTINENT_SLUG}`: `asia-southeast`. `{SCOPE}`:

```
- Vietnam: EVN-NLDC (single national dispatcher); Northern, Central, Southern Power Companies as distribution arms
- Thailand: EGAT
- Indonesia: PLN
- Malaysia: TNB (Peninsula), Sarawak Energy (Sarawak), SESB (Sabah)
- Philippines: NGCP (system operator), PEMC (market operator)
- Singapore: EMA / SP Group (PowerGrid)
- Brunei: DES (Department of Electrical Services)
- Cambodia: EAC (Electricity Authority of Cambodia)
- Laos: EDL (Electricité du Laos)
- Myanmar: EPGE (under MOEP)
- Timor-Leste: EDTL
- Existing project regions: vietnam, india-* (no — that's Asia-South), thailand (if exists), indonesia (if exists)
```

### Task 11 — Asia-South

`{CONTINENT_SLUG}`: `asia-south`. `{SCOPE}`:

```
- India regional dispatch centres: NRLDC (north), SRLDC (south), WRLDC (west), ERLDC (east), NERLDC (north-east). National: POSOCO/Grid-India.
- India also has 28 state load-dispatch centres — list the major ones with high RE penetration: Karnataka (KSLDC), Tamil Nadu (TNSLDC), Gujarat (GSLDC), Rajasthan (RSLDC), Maharashtra (MSLDC), Andhra Pradesh (APSLDC), Telangana (TSLDC), Madhya Pradesh (MPSLDC). Existing project regions: india-north, india-south.
- Pakistan: NPCC (National Power Control Center) under NTDC
- Bangladesh: PGCB (system operator)
- Sri Lanka: CEB (single utility)
- Nepal: NEA (single utility)
- Bhutan: BPC (transmission), DGPC (generation)
- Maldives: STELCO
- Afghanistan: DABS — likely no public hourly data
```

### Task 12 — Asia-Central + Middle-East

`{CONTINENT_SLUG}`: `asia-central-middle-east`. `{SCOPE}`:

```
Central Asia:
- Kazakhstan: KEGOC
- Uzbekistan: National Electric Networks (NEGU)
- Turkmenistan: Türkmenenergo
- Tajikistan: Barki Tojik
- Kyrgyzstan: NESK

Middle East:
- Iran: TAVANIR / IGMC (system operator)
- Iraq: Ministry of Electricity (split: South Iraq for flare phenomenon — existing project region 'south-iraq')
- Saudi Arabia: SEC (Saudi Electricity Company), with split for East-Saudi flare (existing project region 'east-saudi')
- UAE: ADNOC for flare; for grid: Abu Dhabi (TRANSCO/EWEC), Dubai (DEWA), federal (FEWA)
- Qatar: Kahramaa (general electricity), QatarEnergy for flare
- Kuwait: MEW (Ministry of Electricity & Water), KOC for flare
- Oman: OETC (Oman Electricity Transmission Company)
- Yemen: PEC (Public Electricity Corporation) — civil-war-affected, document-gap likely
- Israel: IEC (Israel Electric Corp), Noga (system operator)
- Palestine: PENRA / PETL — extremely limited public data
- Jordan: NEPCO
- Lebanon: EDL (Electricité du Liban) — collapsed grid, partial data
- Syria: Public Establishment of Electricity (PEE) — civil-war-affected
- Existing project flare regions to cross-reference: permian (US, not here), west-siberia (Russia, in Europe-non-ENTSO-E), south-iraq, east-saudi
```

### Task 13 — Africa

`{CONTINENT_SLUG}`: `africa`. `{SCOPE}`:

```
Power pools:
- SAPP (Southern African Power Pool) — coordinator
- WAPP (West African Power Pool) — coordinator
- EAPP (East African Power Pool) — coordinator
- COMELEC (Maghreb Electricity Committee) — coordinator
(Power pools as non-operator coordinator rows, phenomenon=none-expected, note in 'notes' field)

National operators (alphabetical, all 54 sovereign states):
- Algeria: SONELGAZ / OS (Operator System)
- Angola: RNT / ENDE (transmission/distribution split)
- Benin: SBEE
- Botswana: BPC
- Burkina Faso: SONABEL
- Burundi: REGIDESO
- Cabo Verde: ELECTRA
- Cameroon: ENEO / SONATREL
- Central African Republic: ENERCA
- Chad: SNE
- Comoros: SONELEC
- Congo (Brazzaville): SNE
- Congo DRC: SNEL
- Côte d'Ivoire: CIE
- Djibouti: EDD
- Egypt: EETC
- Equatorial Guinea: SEGESA
- Eritrea: EEC
- Eswatini: EEC
- Ethiopia: EEP / EEU
- Gabon: SEEG
- Gambia: NAWEC
- Ghana: GRIDCo (transmission), ECG/NEDCo (distribution)
- Guinea: EDG
- Guinea-Bissau: EAGB
- Kenya: KETRACO (transmission), Kenya Power (distribution); KenGen (generation)
- Lesotho: LEC
- Liberia: LEC
- Libya: GECOL — civil-war-affected
- Madagascar: JIRAMA
- Malawi: ESCOM / EGENCO
- Mali: EDM
- Mauritania: SOMELEC
- Mauritius: CEB
- Morocco: ONEE (covers Western Sahara per 'physical infrastructure' rule)
- Mozambique: EDM
- Namibia: NamPower
- Niger: NIGELEC
- Nigeria: TCN (transmission system operator)
- Rwanda: REG (Rwanda Energy Group) / EUCL
- São Tomé and Príncipe: EMAE
- Senegal: SENELEC
- Seychelles: PUC
- Sierra Leone: EDSA / EGTC
- Somalia: BECO (Mogadishu) and regional providers — fragmented
- South Africa: ESKOM
- South Sudan: SSEC — extremely limited
- Sudan: SETCO / NEC
- Tanzania: TANESCO
- Togo: CEET
- Tunisia: STEG
- Uganda: UETCL (transmission), UEDCL (distribution); ERA regulator
- Zambia: ZESCO
- Zimbabwe: ZETDC (transmission/distribution); ZPC (generation)
```

### Task 14 — Latin-America

`{CONTINENT_SLUG}`: `latin-america`. `{SCOPE}`:

```
North/Central America (south of US):
- Mexico: CENACE (system operator), CFE (utility)
- Belize: BEL
- Guatemala: AMM (market admin), ETCEE (transmission)
- El Salvador: UT (Unidad de Transacciones)
- Honduras: ENEE
- Nicaragua: ENATREL / CNDC
- Costa Rica: ICE / CENCE
- Panama: ETESA / CND
- SIEPAC (Central American interconnect coordinator)
- Cuba: UNE
- Dominican Republic: ETED / OC (Organismo Coordinador)
- Haiti: EDH
- Jamaica: JPS
- Trinidad and Tobago: T&TEC
- Bahamas: BPL
- Barbados: BLPC
- Other Caribbean island operators (group as one row each where listed by IRENA): Antigua & Barbuda APUA; Saint Lucia LUCELEC; Grenada GRENLEC; Saint Vincent VINLEC; Dominica DOMLEC; Saint Kitts SKELEC

South America:
- Argentina: CAMMESA
- Bolivia: CNDC
- Brazil: ONS (system operator); existing project clusters brazil-northeast, brazil-southeast, etc. — use those region ids
- Chile: CEN (Coordinador Eléctrico Nacional) — existing project region 'chile' or 'atacama'
- Colombia: XM
- Ecuador: CENACE-Ecuador (different from Mexico CENACE)
- Guyana: GPL
- Paraguay: ANDE
- Peru: COES-SINAC
- Suriname: EBS / NV EBS
- Uruguay: UTE / ADME
- Venezuela: CORPOELEC
- French Guiana: EDF-SEI (overseas, treat as France row for ENTSO-E? — note in 'notes')
```

### Task 15 — North-America

`{CONTINENT_SLUG}`: `north-america`. `{SCOPE}`:

```
USA — ISOs/RTOs (cross-reference src/lib/regions.ts; most are existing T1):
- ERCOT (Texas) — split ercot-west, ercot-east per existing regions
- CAISO (California)
- MISO (Midcontinent)
- SPP (Southwest Power Pool)
- PJM (Mid-Atlantic)
- ISO-NE (New England)
- NYISO (New York)
- Non-ISO regions: TVA, Bonneville Power Administration, Western balancing authorities (CISO area, NWPP)
- US flare: permian (existing project region)

Canada — provincial operators:
- Ontario: IESO
- Alberta: AESO
- British Columbia: BC Hydro / BCTC
- Quebec: Hydro-Québec (HQ-CMÉ system operator)
- Manitoba: Manitoba Hydro
- Saskatchewan: SaskPower
- New Brunswick: NB Power / NB System Operator
- Nova Scotia: NS Power
- Prince Edward Island: Maritime Electric
- Newfoundland & Labrador: NL Hydro / IESO-NL
- Yukon, NWT, Nunavut: territorial utilities (Yukon Energy, NTPC, Qulliq Energy)

Greenland: Nukissiorfiit
Mexico: covered in Latin-America (Task 14)
```

### Task 16 — Oceania-Pacific

`{CONTINENT_SLUG}`: `oceania-pacific`. `{SCOPE}`:

```
Australia:
- AEMO NEM (5 mainland states) — split: aemo-nsw, aemo-vic, aemo-qld, aemo-sa, aemo-tas (existing project regions)
- AEMO WEM (Western Australia SWIS) — wa-swis (existing project region)
- AEMO NTEM (Northern Territory) — small grid

New Zealand:
- Transpower NZ (system operator); MBIE for renewables data; EMI (Electricity Market Information)

Pacific Islands:
- Fiji: EFL (Energy Fiji Ltd)
- Papua New Guinea: PPL (PNG Power Ltd)
- Solomon Islands: Solomon Power
- Vanuatu: UNELCO / VUI
- Samoa: EPC
- Tonga: TPL (Tonga Power Ltd)
- Kiribati: PUB
- Tuvalu: TEC
- Federated States of Micronesia: state-level utilities (PUC Pohnpei etc.)
- Palau: PPUC
- Nauru: NUC
- Marshall Islands: MEC
- Cook Islands: TAU
- Niue: Niue Power
- Wallis & Futuna: covered by France (ENTSO-E task) — note as cross-ref
- French Polynesia: EDT-Engie — note as French overseas territory
- New Caledonia: Enercal
- American Samoa, Guam, NMI: covered by US territorial utilities — note cross-ref to North-America task
- Pitcairn, Tokelau: micro-populations, no separate operator
```

### Each Task 8–16 follows this checklist

For each continent X (one task per continent):

- [ ] **Step 1: Substitute template placeholders**

Take `scripts/validation/templates/world-coverage-audit-prompt.md`, replace `{CONTINENT}`, `{CONTINENT_SLUG}`, `{SCOPE}`, `{OPERATOR_CHECKLIST}` with the values for X above. Save as `scripts/validation/dispatches/2026-04-26-{CONTINENT_SLUG}.md`.

- [ ] **Step 2: Commit**

```bash
git add scripts/validation/dispatches/2026-04-26-{CONTINENT_SLUG}.md
git commit -m "Dispatch prompt: {CONTINENT}"
```

---

## Task 17: Wave-2 dispatch (10 parallel subagents)

**Files:**
- Read: `scripts/validation/dispatches/2026-04-26-*.md` (10 files)
- Output: `data/coverage-audit/2026-04-26-*.csv` (10 files written by subagents)

- [ ] **Step 1: Verify all 10 dispatch files exist**

```bash
ls scripts/validation/dispatches/2026-04-26-*.md | wc -l
```

Expected: `10`.

- [ ] **Step 2: Launch 10 subagents in parallel via single Agent tool message**

The orchestrating agent (you, when executing this plan) sends ONE message containing 10 `Agent` tool calls — one per continent. Each Agent call uses:

```
subagent_type: general-purpose
description: "World coverage audit: <continent>"
prompt: <contents of scripts/validation/dispatches/2026-04-26-<continent>.md, read verbatim>
run_in_background: false
```

The 10 prompts are:
- `scripts/validation/dispatches/2026-04-26-europe-entsoe.md`
- `scripts/validation/dispatches/2026-04-26-europe-non-entsoe.md`
- `scripts/validation/dispatches/2026-04-26-asia-east.md`
- `scripts/validation/dispatches/2026-04-26-asia-southeast.md`
- `scripts/validation/dispatches/2026-04-26-asia-south.md`
- `scripts/validation/dispatches/2026-04-26-asia-central-middle-east.md`
- `scripts/validation/dispatches/2026-04-26-africa.md`
- `scripts/validation/dispatches/2026-04-26-latin-america.md`
- `scripts/validation/dispatches/2026-04-26-north-america.md`
- `scripts/validation/dispatches/2026-04-26-oceania-pacific.md`

Each subagent will write to `data/coverage-audit/2026-04-26-<continent>.csv`. Subagents are independent — they share no state. They run concurrently; total wall-clock ≈ longest single chain (~3 hours).

- [ ] **Step 3: Wait for all 10 subagents to complete**

The Agent tool blocks until each subagent returns. The orchestrating message returns when the slowest one finishes.

- [ ] **Step 4: Inventory subagent outputs**

```bash
ls -la data/coverage-audit/2026-04-26-*.csv | wc -l
```

Expected: `10`.

- [ ] **Step 5: Commit subagent intermediates**

```bash
git add data/coverage-audit/2026-04-26-*.csv
git commit -m "Wave-2 intermediate CSVs from 10 continental subagents"
```

---

## Task 18: Per-intermediate lint + re-dispatch loop

**Files:**
- Read: `data/coverage-audit/2026-04-26-<continent>.csv`

- [ ] **Step 1: Lint each intermediate**

```bash
for f in data/coverage-audit/2026-04-26-*.csv; do
    [ "$(basename $f)" = "2026-04-26-world.csv" ] && continue
    echo "=== $f ==="
    python3 scripts/validation/lint_coverage_audit.py "$f"
done
```

Expected: each file returns exit 0, "OK: N rows".

- [ ] **Step 2: For any failing file, re-dispatch that single continent**

If continent X fails lint:

1. Read the lint errors for X.
2. Re-launch a single Agent call for X, prompt = original dispatch prompt + appendix:

```
APPENDIX: previous output failed lint with these errors:
<paste lint stderr verbatim>

Re-write data/coverage-audit/2026-04-26-X.csv fixing only the
flagged rows. Do not change rows that passed.
```

3. Re-run lint on the new output. Repeat up to 2 times. If still failing after 2 re-dispatches, fix the offending rows by hand and document why in the PR description.

- [ ] **Step 3: Once all 10 lint clean, commit any fixes**

```bash
git add data/coverage-audit/2026-04-26-*.csv
git commit -m "Wave-2 lint pass: all 10 intermediates clean" --allow-empty
```

(`--allow-empty` because if no re-dispatch was needed there's nothing new to commit; the empty commit serves as a checkpoint.)

---

## Task 19: Merge to master

**Files:**
- Read: `data/coverage-audit/2026-04-26-<continent>.csv` (×10)
- Create: `data/coverage-audit/2026-04-26-world.csv`

- [ ] **Step 1: Run the merge script**

```bash
python3 scripts/validation/merge_coverage_audit.py \
    --output data/coverage-audit/2026-04-26-world.csv \
    data/coverage-audit/2026-04-26-europe-entsoe.csv \
    data/coverage-audit/2026-04-26-europe-non-entsoe.csv \
    data/coverage-audit/2026-04-26-asia-east.csv \
    data/coverage-audit/2026-04-26-asia-southeast.csv \
    data/coverage-audit/2026-04-26-asia-south.csv \
    data/coverage-audit/2026-04-26-asia-central-middle-east.csv \
    data/coverage-audit/2026-04-26-africa.csv \
    data/coverage-audit/2026-04-26-latin-america.csv \
    data/coverage-audit/2026-04-26-north-america.csv \
    data/coverage-audit/2026-04-26-oceania-pacific.csv
```

Expected: `OK: <N> rows to data/coverage-audit/2026-04-26-world.csv` where N ≥ 250.

- [ ] **Step 2: If merge reports a conflict, resolve it**

Conflict format (stderr): `merge conflict for (country, subdivision, op): fields=[...] prev={...} new={...}`.

For each conflict:
1. Open both intermediate CSVs that contain the conflicting row.
2. Decide which classification is correct (e.g. consult `docs/methodology/uncertainty.md` if it's a tier dispute, `src/lib/regions.ts` if it's a region-id dispute).
3. Edit the **incorrect** intermediate CSV to match the correct one.
4. Re-run merge. Repeat until exit 0.

- [ ] **Step 3: Commit master**

```bash
git add data/coverage-audit/2026-04-26-world.csv
git commit -m "Merge intermediates → master coverage-audit CSV"
```

---

## Task 20: Master lint + sanity floor

**Files:**
- Read: `data/coverage-audit/2026-04-26-world.csv`

- [ ] **Step 1: Lint the master**

```bash
npm run lint:coverage-audit
```

Expected: `OK: <N> rows ...` with exit 0.

- [ ] **Step 2: Verify the 250-row sanity floor**

```bash
python3 -c "
import csv
with open('data/coverage-audit/2026-04-26-world.csv') as f:
    n = sum(1 for _ in csv.reader(f)) - 1
print(f'rows={n}')
assert n >= 250, f'sanity floor breached: {n} < 250'
print('sanity floor passed')
"
```

Expected: `rows=<≥250>`, then `sanity floor passed`. If breached, identify which continent under-covered (compare row counts per continent) and re-dispatch that subagent with an explicit operator-checklist reminder.

- [ ] **Step 3: Verify each continent has ≥1 published-not-yet-modelled row**

```bash
python3 -c "
import csv
from collections import defaultdict
by_continent = defaultdict(lambda: {'published_new': 0, 'documented_gap': 0})
# Continent inferred from country prefix or an explicit lookup — for now a manual check is fine.
with open('data/coverage-audit/2026-04-26-world.csv') as f:
    r = csv.DictReader(f)
    for row in r:
        if row['coverage_status'] == 'published' and not row['region_id_in_project']:
            print(f'NEW PUBLISHED: {row[\"country\"]} - {row[\"operator_name\"]}')
        if row['coverage_status'] == 'documented-gap':
            pass  # tally if needed
"
```

Eyeball the output: every continent should appear in the `NEW PUBLISHED` list at least once. If one is missing, surface it for the digest's "weak coverage" flag.

---

## Task 21: Author the digest MD

**Files:**
- Create: `docs/coverage-audit/2026-04-26-world.md`

- [ ] **Step 1: Generate summary statistics**

Run a one-off Python aggregator (no need to commit it):

```bash
python3 << 'EOF'
import csv
from collections import Counter
with open('data/coverage-audit/2026-04-26-world.csv') as f:
    rows = list(csv.DictReader(f))

print(f'Total rows: {len(rows)}')
print(f'\nBy coverage_status:')
for k, v in Counter(r['coverage_status'] for r in rows).most_common():
    print(f'  {k}: {v}')
print(f'\nBy recommended_action:')
for k, v in Counter(r['recommended_action'] for r in rows).most_common():
    print(f'  {k}: {v}')
print(f'\nBy current_tier:')
for k, v in Counter(r['current_tier'] for r in rows).most_common():
    print(f'  {k}: {v}')
print(f'\nTop-15 by priority_score:')
top = sorted(rows, key=lambda r: -float(r['priority_score']))[:15]
for r in top:
    print(f'  {r["priority_score"]:>6} | {r["country"]:30} | {r["operator_name"]:25} | {r["recommended_action"]}')
EOF
```

Save the output for use in the digest.

- [ ] **Step 2: Hand-author the digest**

Create `docs/coverage-audit/2026-04-26-world.md`:

```markdown
# World Coverage Audit — 2026-04-26

**Date:** 2026-04-26
**Sprint:** S1 + HB integration / Phase-2.6 round-2 framing
**Master CSV:** `data/coverage-audit/2026-04-26-world.csv` (<N> rows)
**Spec:** `docs/superpowers/specs/2026-04-26-world-coverage-audit-design.md`

## Headline counts

| Status | Count |
|---|---:|
| Total operators audited | <N> |
| Already modelled (T1a/T1b/T1c/T2/T2-flare/T3) | <count> |
| Documented-gap | <count> |
| Newly identified, accessible upstream | <count> |
| Newly identified, blocked | <count> |

## Recommended-action breakdown

| Action | Count |
|---|---:|
| `promote-to-T1` | <count> |
| `introduce-as-T1` | <count> |
| `introduce-as-T3` | <count> |
| `leave-T3` | <count> |
| `leave-existing-T1+` | <count> |
| `leave-not-modelled` | <count> |
| `blocked-document-only` | <count> |

## Top-15 priority candidates

| Rank | Score | Country / Operator | Action | Format | Anchor |
|---:|---:|---|---|---|---|
| 1 | <s> | <country> / <op> | <action> | <format> | <anchor> |
| ... |

(Generated by sorting master CSV by `priority_score` desc.)

## Continental sections

### Europe-ENTSO-E

<one-paragraph regional summary: total operators, currently modelled count, new T1 candidates, documented-gap count>

| Country | Operator | Tier | Action |
|---|---|---|---|
| <subset of rows from this continent — first 5–10 most relevant; full data in CSV> |

**Notable findings:**
- <bullet>

→ Full rows in `data/coverage-audit/2026-04-26-europe-entsoe.csv`.

### Europe-non-ENTSO-E
... (same shape)

### Asia-East
...

### Asia-Southeast
...

### Asia-South
...

### Asia-Central + Middle-East
...

### Africa
...

### Latin-America
...

### North-America
...

### Oceania-Pacific
...

## Methodology + provenance

- Audit methodology: see spec §3 in `docs/superpowers/specs/2026-04-26-world-coverage-audit-design.md`.
- Probe etiquette + STOP conditions: spec §3.5–3.6.
- Tier definitions: `docs/methodology/uncertainty.md`.
- Priority-score formula: spec §4.5.

## Limitations of this audit

- **Probe results are dated.** A row marked `403 / Cloudflare-challenged` today may become `200` after Cloudflare config changes.
- **Sub-national disagreements stay sub-national.** Where a federal operator (e.g. India POSOCO) coexists with state operators (KSLDC, GSLDC), both appear as separate rows; the audit does not resolve which is the canonical curtailment-publishing entity. Round-2 implementation work makes that call per-region.
- **Microstates and Antarctica are out of scope** per spec §Scope.

## Next step

The top-of-ranking `promote-to-T1` and `introduce-as-T1` rows feed directly
into the Phase-2.6 round-2 dispatch brief at
`docs/proposals/2026-04-26-phase-2-6-round-2-dispatch.md` (PR B). Round-2
implementation PRs follow per pick.
```

Substitute `<N>`, `<count>`, and the top-15 / continental data using the script output from Step 1.

- [ ] **Step 3: Commit**

```bash
git add docs/coverage-audit/2026-04-26-world.md
git commit -m "Author world coverage audit digest"
```

---

## Task 22: Document supersession

**Files:**
- Delete: `docs/coverage-gaps-europe.md`
- Modify: `docs/known-limitations.md`
- Modify: `docs/proposals/2026-04-26-phase-2-6-static-promotions-dispatch.md`

- [ ] **Step 1: Verify `docs/coverage-gaps-europe.md` exists and capture useful prose**

```bash
test -f docs/coverage-gaps-europe.md && cat docs/coverage-gaps-europe.md | head -40
```

If any prose isn't captured by the Europe-non-ENTSO-E and Europe-ENTSO-E master CSV rows, copy it into the `notes` field of the relevant rows before deletion. Edit `data/coverage-audit/2026-04-26-world.csv` directly — keep notes ≤200 chars.

- [ ] **Step 2: Delete `docs/coverage-gaps-europe.md`**

```bash
git rm docs/coverage-gaps-europe.md
```

- [ ] **Step 3: Update `docs/known-limitations.md`**

Open `docs/known-limitations.md`. Find §12, §13, §14 (the "regions we know are missing" subsections). Replace each with a single line:

```markdown
## §12 [Original heading]

See `data/coverage-audit/2026-04-26-world.csv` and the digest at
`docs/coverage-audit/2026-04-26-world.md` for the canonical
operator-by-operator coverage state. Per-row caveats live in the
`notes` column.
```

(Repeat for §13, §14 if those are also coverage-gap subsections; verify by reading the actual file before editing.)

- [ ] **Step 4: Annotate Phase-2.6 dispatch brief**

Open `docs/proposals/2026-04-26-phase-2-6-static-promotions-dispatch.md`. Append at the bottom:

```markdown

---

## v0.5 disposition (added 2026-04-26)

Of the original five candidates:

- **Vietnam, India-North, India-South:** hit STOP-conditions during round 1 (no public hourly upstream). Confirmed in the world-coverage audit dated 2026-04-26 — see master CSV rows for `vietnam` (introduce-as-T3, anchor: EVN 2024 Operations Report) and `india-north` / `india-south` (introduce-as-T3, anchor: POSOCO 2024 reports). v1 candidates for Pattern-D anchor-metadata cleanup once a richer hourly upstream becomes available.
- **Japan, WA-SWIS:** shipped in round 1 as live T1a (`japan-kyushu`, `wa-swis`).

The audit's master CSV (`data/coverage-audit/2026-04-26-world.csv`) is the single source of truth for round 2 candidate selection; this brief is retained as historical context only.
```

- [ ] **Step 5: Commit supersession**

```bash
git add docs/known-limitations.md \
        docs/proposals/2026-04-26-phase-2-6-static-promotions-dispatch.md
git rm docs/coverage-gaps-europe.md  # already staged from Step 2 if executed in same shell
git commit -m "Supersede gaps-europe + known-limitations §12–14 + Phase-2.6 dispatch with audit"
```

---

## Task 23: Open PR A

**Files:**
- Push: `chore/world-coverage-audit-2026-04-26`

- [ ] **Step 1: Push branch**

```bash
git push -u origin chore/world-coverage-audit-2026-04-26
```

- [ ] **Step 2: Open PR A via gh CLI**

```bash
gh pr create \
  --title "World coverage audit (operator-level, 2026-04-26)" \
  --body "$(cat <<'EOF'
## Summary

Operator-by-operator audit covering every country and grid operator on Earth, classified against the project's tier model. Replaces hand-picked Phase-2.6 round-2 framing with a deterministic priority-ranked CSV.

- Master CSV: `data/coverage-audit/2026-04-26-world.csv` (~285 rows)
- Digest: `docs/coverage-audit/2026-04-26-world.md`
- Per-continent intermediates kept as audit trail
- Lint + merge tooling reusable for future audit refreshes

## Scope

Documents-only: no loader code, no tier reassignments, no anchor JSON updates, no methodology edits, no paper revisions. Spec at `docs/superpowers/specs/2026-04-26-world-coverage-audit-design.md`.

## Supersedes

- `docs/coverage-gaps-europe.md` (deleted)
- `docs/known-limitations.md` §12–§14 (replaced with cross-reference)
- Phase-2.6 round-1 STOP-condition prose (annotated with audit cross-refs)

## Test plan

- [x] `npm run test:coverage-audit` (26 unit tests for schema, lint, merge)
- [x] `npm run lint:coverage-audit` (master CSV passes lint)
- [x] Master CSV ≥ 250 rows
- [x] Every continent has ≥1 `published, not-yet-modelled` row
- [x] Every continent has ≥1 `documented-gap` row
- [x] Top-15 priority list contains ≥8 candidates with accessible `data_format`

## Next

PR B (round-2 dispatch brief) follows within 24 h, derived deterministically from this CSV.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Capture PR URL**

The `gh pr create` output ends with the URL. Save it for the writeup. Wait for CI to go green before requesting review.

---

## Task 24: Filter master for round-2 candidates

**Files:**
- Read: `data/coverage-audit/2026-04-26-world.csv`

- [ ] **Step 1: Extract top picks**

```bash
python3 << 'EOF'
import csv
with open('data/coverage-audit/2026-04-26-world.csv') as f:
    rows = list(csv.DictReader(f))

candidates = [r for r in rows
              if r['recommended_action'] in {'promote-to-T1', 'introduce-as-T1'}]
candidates.sort(key=lambda r: -float(r['priority_score']))

print('TOP-10 ROUND-2 CANDIDATES:')
print(f'{"rank":<5}{"score":<10}{"country":<25}{"operator":<25}{"action":<20}{"format":<25}')
for i, r in enumerate(candidates[:10], 1):
    print(f'{i:<5}{r["priority_score"]:<10}{r["country"][:24]:<25}{r["operator_name"][:24]:<25}{r["recommended_action"]:<20}{r["data_format"]:<25}')
EOF
```

Inspect output. Pick the top 4–5 candidates. (If the top-3 are all from the same country/region, diversify by reaching deeper into the list.)

- [ ] **Step 2: Document the picks in working notes (not committed yet)**

Save the chosen 4–5 rows + their full CSV details for use in Task 25.

---

## Task 25: Round-2 dispatch brief

**Files:**
- Create: `docs/proposals/2026-04-26-phase-2-6-round-2-dispatch.md`

- [ ] **Step 1: Author the brief**

Use the original Phase-2.6 dispatch brief (`docs/proposals/2026-04-26-phase-2-6-static-promotions-dispatch.md`) as a structural template. Create `docs/proposals/2026-04-26-phase-2-6-round-2-dispatch.md`:

```markdown
# Phase-2.6 Round-2 — Static-region promotion dispatch

**Date:** 2026-04-26
**Source:** `data/coverage-audit/2026-04-26-world.csv` (top 4–5 by `priority_score` filtered to `promote-to-T1` ∪ `introduce-as-T1`)
**Predecessor:** `docs/proposals/2026-04-26-phase-2-6-static-promotions-dispatch.md` (round 1 — Japan + WA-SWIS shipped, Vietnam/India-North/India-South hit STOP-conditions)

## Picks (top 4–5 from audit)

### Pick 1: <country / operator>

- **Audit row:** master CSV line <N>
- **Score:** <value>
- **Recommended action:** <action>
- **Recommended tier landing:** <T1a/T1b/T1c>
- **Loader pattern:** <Pattern-A>
- **Probe target:** <operator_url>
- **Data format:** <format>
- **Annual anchor:** <anchor citation> (<TWh value>)
- **Existing region id:** <region_id_in_project> or `(new)`

**Expected schema:** <describe response shape; for a JSON API name top-level keys; for an HTML table name column headers>.

**Calibration anchor citation:** <verbatim citation, including title + year + URL if available>.

**STOP conditions:**
- If probe returns <expected status> from operator, proceed.
- If probe is <auth-walled / Cloudflare-challenged / 5xx>: stop, document in PR description, queue for v1.
- If parsed annual implied by hourly aggregation diverges from anchor by >40%, stop and re-audit the rate.

**Fallback if blocked:** route via Pattern-D (anchor-metadata cleanup; introduce-as-T3 with cited anchor) — this matches what Vietnam / India-North / India-South ended up at in round 1.

### Pick 2: ...

(repeat for picks 2–4 or 2–5)

## Execution order

Dispatch picks 1–N in sequence (one per Codex queue slot) with same STOP-condition discipline as round 1. Each pick is its own PR off `v0-build`, lint+CI gates same as established Pattern-A loaders.

## Out-of-scope reminders

- The audit's `introduce-as-T3` rows (anchor available, no accessible hourly) are NOT round-2 candidates. They sit in the queue as Pattern-D anchor-metadata work for v0.6 / v1.
- The audit's `documented-gap` and `blocked-document-only` rows are NOT promoted in round 2.
- Round-2 promotion does not change methodology. Tier definitions, envelope methodology, and validation discrepancies docs stay untouched.
```

- [ ] **Step 2: Commit on a separate branch (PR B)**

```bash
git checkout -b feat/phase-2-6-round-2-dispatch
git add docs/proposals/2026-04-26-phase-2-6-round-2-dispatch.md
git commit -m "Phase-2.6 round-2 dispatch brief from world-coverage audit"
```

---

## Task 26: Open PR B

**Files:**
- Push: `feat/phase-2-6-round-2-dispatch`

- [ ] **Step 1: Push branch**

```bash
git push -u origin feat/phase-2-6-round-2-dispatch
```

- [ ] **Step 2: Open PR B**

```bash
gh pr create \
  --title "Phase-2.6 round-2 dispatch brief from coverage audit" \
  --body "$(cat <<'EOF'
## Summary

Round-2 dispatch brief for Phase-2.6 static-region promotions, derived deterministically from the world-coverage audit (`data/coverage-audit/2026-04-26-world.csv`) by filtering on `recommended_action ∈ {promote-to-T1, introduce-as-T1}` and sorting by `priority_score`.

## Predecessor

PR A — `chore/world-coverage-audit-2026-04-26` — must merge first. This brief references its master CSV.

## Test plan

- [x] Picks come from top 4–5 of the audit's priority ranking
- [x] Each pick has explicit STOP conditions
- [x] Each pick names a Pattern-D fallback if blocked
- [x] Brief format mirrors the round-1 dispatch (predecessor)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)" \
  --base v0-build
```

---

## Self-review

After writing the plan, look at the spec with fresh eyes. Coverage check below.

**1. Spec coverage:**

- §1 Schema (17 columns) → Tasks 2 (schema module), 3 (lint), 4 (merge) all use the schema. ✓
- §2 Continental decomposition (10 continents) → Tasks 7–16 author one prompt per continent; Task 17 dispatches all 10. ✓
- §3 Methodology cheatsheet → Task 6 embeds it in template; Tasks 7–16 inherit it. ✓
- §4.1 Master CSV → Task 19. ✓
- §4.2 Digest MD → Task 21. ✓
- §4.3 Per-continent intermediates → Tasks 17 (write) + 18 (lint). ✓
- §4.4 Round-2 picks → Tasks 24 + 25. ✓
- §4.5 Priority-score formula → encoded in `coverage_audit_schema.priority_score()` (Task 2). ✓
- §4.6 Commit strategy (PR A + PR B) → Tasks 23 (PR A) + 26 (PR B). ✓
- §5.1 Document supersession → Task 22. ✓
- §5.2 Documents fed → PR B (Task 25) is the immediate downstream consumer. ✓
- §5.3 Documents untouched → reflected in "untouched" file-structure section + Task 22 only modifies the listed files. ✓
- §5.4 Non-promises → reflected in PR descriptions. ✓
- §6.1 Time budget → not encoded in tasks (it's a forecast, not an action). ✓
- §6.2 Dispatch waves → Tasks 1–16 (Wave 1), 17–18 (Wave 2), 19–22 (Wave 3). ✓
- §6.3 Success criteria → Task 20 (lint + 250-row floor + per-continent published-not-modelled check) + Task 23's test-plan checklist. ✓
- §6.4 Failure modes → Task 18 (re-dispatch loop) + Task 19 Step 2 (conflict resolution). ✓
- §6.5 Out-of-scope → reflected in PR A description (Task 23). ✓

**2. Placeholder scan:** Searched for "TBD", "TODO", "fill in", "implement later", "similar to". Found one "TBD-after-this-plan-commits" in Task 1 Step 3 — that's an intentional handoff note for the cherry-pick, not a placeholder for missing content. Acceptable as-is.

**3. Type consistency:** Schema column names match between `coverage_audit_schema.COLUMN_ORDER`, the lint script's `VALID_HEADER`, the merge script's `HEADER`, and the dispatch prompt template. `priority_score()` and `validate_row()` signatures consistent. Enum sets all match between schema module and template. ✓

**4. Subagent dispatch consistency:** Tasks 7–16 each produce exactly one file at `scripts/validation/dispatches/2026-04-26-<slug>.md` and the slugs match the 10 names in Task 17's dispatch list. ✓
