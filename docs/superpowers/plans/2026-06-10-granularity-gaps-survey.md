# Granularity & Gaps Survey (coverage-audit v2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute the survey designed in `docs/superpowers/specs/2026-06-10-granularity-and-gaps-survey-design.md` — schema v2, ten-lane agent research fan-out, verification pass, ranked synthesis.

**Architecture:** Tasks 1–2 are code (schema v2 + v1 migration, TDD, pytest). Tasks 3–5 are research orchestration: lane agents write per-lane CSVs under `data/coverage-audit/lanes-2026-06/`, the existing `merge_coverage_audit.py` merges them into the master CSV, verifier agents cold-re-probe the top 15, and the synthesis doc ranks the survivors. Task 6 ships.

**Tech Stack:** Python 3 (csv, pytest — no new deps), existing `scripts/validation/` tooling, research subagents with WebSearch/WebFetch.

**Verified against:** branch `feat/granularity-gaps-survey` @ 844f71c (cut from origin/main 2026-06-10, includes peru-solar T1a→T1b). If executing later, re-run the CLAUDE.md state check first; if `GRANULARITY_ENUM` already exists in `coverage_audit_schema.py`, STOP and report.

**Non-goals:** implementing any split/new region; touching `regions.ts`, snapshots, or any TS gate; profile seasonality; backfill; VPN/relay procurement.

---

## File structure

| File | Action | Responsibility |
|---|---|---|
| `scripts/validation/coverage_audit_schema.py` | Modify | +3 Row fields (with defaults), `GRANULARITY_ENUM`, `GRANULARITY_WEIGHTS`, scoring branch, validation rules, COLUMN_ORDER 17→20 |
| `scripts/validation/test_coverage_audit_schema.py` | Modify | new scoring/validation tests; column-count test 17→20; v1 score byte-stability test |
| `scripts/validation/lint_coverage_audit.py` | Modify | Row construction gains 3 fields (one int coercion) |
| `scripts/validation/merge_coverage_audit.py` | Modify | `dict_to_row` gains 3 fields |
| `data/coverage-audit/2026-04-26-world.csv` | Modify (migrate) | 3 columns appended (`"", "none", "0"`) to all 345 rows |
| `package.json` | Modify | `lint:coverage-audit` lints both master CSVs |
| `data/coverage-audit/lanes-2026-06/<lane>.csv` | Create ×10 | per-lane agent output (committed audit trail) |
| `data/coverage-audit/2026-06-10-granularity-and-gaps.csv` | Create (generated) | merged master, lint-clean |
| `docs/research/2026-06-10-granularity-and-gaps.md` | Create | synthesis + ranked top-20 backlog |
| `STATUS.md` | Modify | ship entry |

---

### Task 0: Branch state check

- [ ] **Step 1: Confirm branch and spec**

```bash
git branch --show-current        # expect: feat/granularity-gaps-survey
git log --oneline -1             # expect: 844f71c docs(spec): granularity & gaps survey...
npm run test:coverage-audit 2>&1 | tail -2   # expect: all existing pytest green
```

If the branch differs or pytest is red, STOP and report.

---

### Task 1: Schema v2

Three appended columns with **dataclass defaults** so existing positional/named constructions and the test helper keep working; scoring branches on `parent_region_id`; new validation rules.

**Files:**
- Modify: `scripts/validation/coverage_audit_schema.py`
- Modify: `scripts/validation/lint_coverage_audit.py` (Row construction, ~line 50)
- Modify: `scripts/validation/merge_coverage_audit.py` (`dict_to_row`, ~line 49)
- Test: `scripts/validation/test_coverage_audit_schema.py`

- [ ] **Step 1: Write the failing tests**

In `scripts/validation/test_coverage_audit_schema.py`, change the column-count test and append the new tests at the end of the file:

```python
def test_column_order_has_20_entries():
    assert len(schema.COLUMN_ORDER) == 20
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
    assert schema.priority_score(row) == 2.52


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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python3 -m pytest scripts/validation/test_coverage_audit_schema.py -v 2>&1 | tail -15`
Expected: the new tests FAIL (`TypeError: Row.__init__() got an unexpected keyword argument 'parent_region_id'` and the 20-entries assert); old tests still pass.

- [ ] **Step 3: Implement schema v2**

In `scripts/validation/coverage_audit_schema.py`:

(a) After `LOADER_PATTERN_HINT_ENUM` (~line 43), add:

```python
# --- v2 (2026-06-10 granularity-and-gaps survey) --------------------

GRANULARITY_ENUM: set[str] = {
    "plant", "state", "bidding-zone", "fuel-split", "none",
}

# Data-quality gain weighting for split rows (design doc §Schema v2).
GRANULARITY_WEIGHTS: dict[str, float] = {
    "plant": 1.0,
    "state": 0.9,
    "bidding-zone": 0.8,
    "fuel-split": 0.7,
    "none": 0.0,
}
```

(b) Append the three columns to `COLUMN_ORDER` (after `"notes"`):

```python
    "notes",
    # v2 (2026-06-10): granularity lens. Appended after notes so v1 column
    # positions stay stable; v1 files are migrated by appending "", "none", "0".
    "parent_region_id",
    "granularity_available",
    "expected_new_regions",
]
```

(c) Add the three fields to the `Row` dataclass, **with defaults**, after `notes: str`:

```python
    notes: str
    # v2: empty parent_region_id = gap row (v1 semantics); non-empty = split row.
    parent_region_id: str = ""
    granularity_available: str = "none"
    expected_new_regions: int = 0
```

(d) Replace the body of `priority_score` with the branching version:

```python
def priority_score(row: Row) -> float:
    """Spec §4.5 for gap rows; design-doc v2 for split rows:

        gap row   (parent_region_id empty):
            score = (anchor_TWh × tier_uplift_weight × format_weight)
                    - already_modelled_penalty
        split row (parent_region_id set):
            score = anchor_TWh × granularity_weight × format_weight
            (no penalty — the penalty exists to deprioritise re-covering
            modelled regions, not to discourage measured splits)
    """
    anchor_twh = row.annual_anchor_TWh
    if anchor_twh <= 0:
        return 0.0

    fmt_weight = FORMAT_WEIGHTS.get(row.data_format, 0.0)

    if row.parent_region_id:
        gran_weight = GRANULARITY_WEIGHTS.get(row.granularity_available, 0.0)
        return anchor_twh * gran_weight * fmt_weight

    tier_uplift_weight = 0.6 if row.region_id_in_project else 1.0
    base = anchor_twh * tier_uplift_weight * fmt_weight
    penalty = 0.5 * anchor_twh if row.region_id_in_project else 0.0
    return base - penalty
```

(e) Add `import re` after `from dataclasses import dataclass`, and add to `validate_row` (before `return errors`):

```python
    check_enum("granularity_available", row.granularity_available, GRANULARITY_ENUM)
    if row.parent_region_id and not re.match(r"^[a-z0-9][a-z0-9-]*$", row.parent_region_id):
        errors.append(
            f"line {line_no}: parent_region_id={row.parent_region_id!r} violates kebab-case pattern"
        )
    if row.expected_new_regions < 0:
        errors.append(
            f"line {line_no}: expected_new_regions={row.expected_new_regions} is negative"
        )
    if row.parent_region_id and row.granularity_available == "none":
        errors.append(
            f"line {line_no}: split row (parent_region_id set) requires granularity_available != 'none'"
        )
```

(f) In `scripts/validation/lint_coverage_audit.py`, inside the `schema.Row(...)` construction (after `notes=row_dict["notes"],`):

```python
                    notes=row_dict["notes"],
                    parent_region_id=row_dict["parent_region_id"],
                    granularity_available=row_dict["granularity_available"],
                    expected_new_regions=int(row_dict["expected_new_regions"] or 0),
```

(g) In `scripts/validation/merge_coverage_audit.py`, inside `dict_to_row` (after `notes=d["notes"],`):

```python
        notes=d["notes"],
        parent_region_id=d.get("parent_region_id", ""),
        granularity_available=d.get("granularity_available", "none"),
        expected_new_regions=int(d.get("expected_new_regions") or 0),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python3 -m pytest scripts/validation/test_coverage_audit_schema.py scripts/validation/test_lint_coverage_audit.py scripts/validation/test_merge_coverage_audit.py -v 2>&1 | tail -8`
Expected: all PASS. If `test_lint_coverage_audit.py` or `test_merge_coverage_audit.py` fixtures embed 17-column CSVs and now fail on the header check, extend those fixture headers/rows with `,"","none","0"` (report how many fixtures needed touching).

- [ ] **Step 5: Commit**

```bash
git add scripts/validation/coverage_audit_schema.py scripts/validation/lint_coverage_audit.py scripts/validation/merge_coverage_audit.py scripts/validation/test_coverage_audit_schema.py scripts/validation/test_lint_coverage_audit.py scripts/validation/test_merge_coverage_audit.py
git commit -m "feat(coverage-audit): schema v2 — granularity columns + split-row scoring branch"
```

---

### Task 2: Migrate the v1 CSV + lint both files + byte-stability test

**Files:**
- Modify: `data/coverage-audit/2026-04-26-world.csv`
- Modify: `package.json` (`lint:coverage-audit`)
- Test: `scripts/validation/test_coverage_audit_schema.py` (byte-stability test)

- [ ] **Step 1: Baseline check — committed v1 scores match the formula TODAY**

```bash
python3 - <<'EOF'
import csv, sys
sys.path.insert(0, "scripts/validation")
import coverage_audit_schema as schema
mismatches = 0
with open("data/coverage-audit/2026-04-26-world.csv", newline="") as f:
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
        )
        if f"{schema.priority_score(row):.4f}" != d["priority_score"]:
            mismatches += 1
print(f"mismatches: {mismatches}")
EOF
```

Expected: `mismatches: 0` — proving the v2 formula reproduces every committed v1 score (defaults route all rows to the gap branch). **If non-zero: STOP and report** — either the formula branch is wrong or the committed file has hand-edited scores; do not migrate until resolved.

- [ ] **Step 2: Migrate the v1 CSV**

```bash
python3 - <<'EOF'
import csv
p = "data/coverage-audit/2026-04-26-world.csv"
with open(p, newline="") as f:
    rows = list(csv.reader(f))
rows[0] += ["parent_region_id", "granularity_available", "expected_new_regions"]
for r in rows[1:]:
    r += ["", "none", "0"]
with open(p, "w", newline="") as f:
    csv.writer(f).writerows(rows)
print(f"migrated {len(rows)-1} rows")
EOF
```

Expected: `migrated 345 rows`. Note: `csv.writer` may normalize quoting on pre-existing fields — check `git diff --stat` and eyeball `git diff data/coverage-audit/2026-04-26-world.csv | head -30`; quoting-only noise is acceptable, **content changes to the first 17 columns are not**.

- [ ] **Step 3: Add the byte-stability regression test**

Append to `scripts/validation/test_coverage_audit_schema.py`:

```python
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
```

(`Path` is already imported at the top of the test file.)

- [ ] **Step 4: Extend the npm lint script**

In `package.json`, change:

```json
"lint:coverage-audit": "python3 scripts/validation/lint_coverage_audit.py data/coverage-audit/2026-04-26-world.csv",
```

to:

```json
"lint:coverage-audit": "python3 scripts/validation/lint_coverage_audit.py data/coverage-audit/2026-04-26-world.csv data/coverage-audit/2026-06-10-granularity-and-gaps.csv",
```

(The merged file doesn't exist until Task 3 — that's fine; this commit lands with Task 3's first merge. Until then run lint with the v1 path explicitly.)

- [ ] **Step 5: Verify**

```bash
python3 scripts/validation/lint_coverage_audit.py data/coverage-audit/2026-04-26-world.csv   # OK: 345 rows
npm run test:coverage-audit 2>&1 | tail -3                                                   # all green
```

- [ ] **Step 6: Commit**

```bash
git add data/coverage-audit/2026-04-26-world.csv scripts/validation/test_coverage_audit_schema.py package.json
git commit -m "feat(coverage-audit): migrate v1 CSV to schema v2 + byte-stability regression test"
```

---

### Task 3: Ten-lane research fan-out

Each lane = one research subagent (general-purpose, WebSearch/WebFetch) that writes `data/coverage-audit/lanes-2026-06/<lane>.csv` and lints it before reporting. Lanes are independent — dispatch in parallel batches of 3–4. **The controller does not run lanes itself; it dispatches, collects, lints, merges.**

**Files:**
- Create: `data/coverage-audit/lanes-2026-06/{desk,north-america,entsoe,east-asia,china,south-asia,africa,latam,mideast-flare,seasia-pacific}.csv`
- Create (generated): `data/coverage-audit/2026-06-10-granularity-and-gaps.csv`

- [ ] **Step 1: Dispatch lane agents with this prompt template**

For each lane, fill `{LANE_NAME}`, `{LANE_SCOPE}`, `{SEEDS}`, `{MIN_ROWS}` and dispatch:

````text
You are a data-source researcher for Every Last Joule (everylastjoule.com), a dataset of
hourly renewable-curtailment + gas-flaring across 385 regions. Your lane: {LANE_NAME}.

## Mission
{LANE_SCOPE}

Two row types:
- SPLIT rows: an existing region whose upstream PUBLISHES finer breakdown (per-plant /
  per-state / per-bidding-zone / per-fuel). Evidence must be the finer breakdown itself
  (a CSV column, an API field, a per-unit table) — NOT an inference from capacity stats.
- GAP rows: a real grid absent or weakly modelled. Record why it is dark and what exists.

## Hard rules
1. Every row cites an operator_url YOU probed this session (WebFetch). probe_result
   records what happened (≤80 chars, e.g. "200 JSON", "homepage-200, data behind SPA",
   "403 geo-block", "timeout"). NO probe → NO row.
2. Fabrication is the cardinal failure. Empty-handed lanes are a valid result; a row
   you are unsure of must say so in notes or be dropped.
3. notes ≤ 200 chars. available_anchor names a citable magnitude source (Ember, IRENA,
   GGFR, operator annual report) or is empty with coverage_status=unknown.
4. Write your output as CSV (header row first) to:
   /Users/simoncollins/code/every-last-joule-dashboard/data/coverage-audit/lanes-2026-06/{LANE_NAME}.csv
   then lint it:
   python3 scripts/validation/lint_coverage_audit.py data/coverage-audit/lanes-2026-06/{LANE_NAME}.csv
   Fix until lint-clean. Do NOT commit; do NOT touch any other file.

## CSV schema (exact header order)
country,subdivision,operator_name,operator_url,region_id_in_project,current_tier,phenomenon,coverage_status,data_format,probe_result,available_anchor,annual_anchor_TWh,recommended_action,recommended_tier_landing,loader_pattern_hint,priority_score,notes,parent_region_id,granularity_available,expected_new_regions

Controlled values:
- current_tier: T1a|T1b|T1c|T2|T2-flare|T3|not-modelled  (the EXISTING region's tier; not-modelled for gaps)
- phenomenon: curtailment-renewable|flare-associated-gas|both|none-expected
- coverage_status: published|documented-gap|unknown
- data_format: JSON-API|CSV-download|parseable-HTML-table|XLSX-table|XML-feed|PDF-only|auth-walled|JS-rendered-SPA|geo-blocked|unreachable|no-public-data
- recommended_action: promote-to-T1|introduce-as-T1|introduce-as-T3|leave-T3|leave-existing-T1+|leave-not-modelled|blocked-document-only
- recommended_tier_landing: T1a|T1b|T1c|T2|T3|not-applicable
- loader_pattern_hint: always "not-applicable" (assigned at implementation time)
- priority_score: always "0.0000" (recomputed at merge)
- parent_region_id: existing region id for SPLIT rows (kebab-case, from src/lib/regions.ts — read it to confirm ids); empty for GAP rows
- granularity_available: plant|state|bidding-zone|fuel-split for SPLIT rows; none for GAP rows
- expected_new_regions: integer ≥0, net new globe entries if implemented
- region_id_in_project: existing region id if this row is ABOUT an existing region, else empty
- annual_anchor_TWh: the affected annual TWh (parent's total for splits; grid's estimated curtailment/flare for gaps); 0 if unknown

## Seeds (start here, then expand)
{SEEDS}

## Deliverable
The lint-clean CSV ({MIN_ROWS}+ rows expected) plus a ≤15-line summary: top 3 findings,
dead ends, and anything you saw but could not verify (flagged as such).
````

Lane fills:

| `{LANE_NAME}` | `{LANE_SCOPE}` + `{SEEDS}` | `{MIN_ROWS}` |
|---|---|---|
| `desk` | Granularity we already fetch but discard. Read these loaders FIRST (no web needed for evidence): `src/data/aemo.json.ts` (per-DUID rows — sub-state clusters?), `src/lib/japan-area-csv.ts` (separate 太陽光/風力 columns currently summed — fuel-split rows for all 10 areas), `src/data/entsoe.json.ts` ZONES (zone×tech combos parsed but aggregated), `src/lib/eia-iso.ts` (per-BA fuel series), `src/data/chile-cen-reductions.ts` (per-plant?), Colombia XM per-Recurso (read `docs/research/2026-06-07-colombia-xm-plant-level-findings.md`). Seeds: the files above; probe upstream URLs only to confirm a column exists where the loader comment is ambiguous. | 10 |
| `north-america` | EIA BAs beyond current ISOs + Canada. Seeds: EIA opendata BA list (api.eia.gov), SOCO, TVA, Duke DEC/DEP, WAPA regions, Salt River Project; IESO (zonal), AESO (asset-level), BC Hydro, Hydro-Québec. | 8 |
| `entsoe` | Unsplit bidding zones + mixed→per-fuel. Seeds: ENTSO-E transparency A75/B16 for IT-North/IT-South/IT-Sicily/IT-Sardinia, SE1–SE4, NO1–NO5 (vs current single `norway`), DK1/DK2, ES, PT, GR islands. Compare against existing region ids in `src/lib/regions.ts`. | 8 |
| `east-asia` | Korea KPX (smp/curtailment disclosures, Jeju mainland split), Taiwan Taipower (regional gen data), Hong Kong. Seeds: kpx.or.kr, data.go.kr curtailment datasets, taipower.com.tw open data. | 5 |
| `china` | Sub-provincial or per-fuel MEASURED sources. Seeds: provincial NDRC/NEA bulletins for Xinjiang/Gansu/Qinghai/Inner Mongolia, State Grid & CSG disclosures, CEC monthly. Flag capacity-ratio fuel splits as cosmetic (notes), recommended_action=blocked-document-only unless measured. | 5 |
| `south-asia` | India SLDC re-probe (POSOCO PR #74 found 3/6 open: re-probe all 6), POSOCO/Grid-India regional reports, Bangladesh PGCB, Pakistan NTDC, Sri Lanka CEB. Seeds: sldc URLs in `src/lib/regions.ts` India entries, grid-india.in, pgcb.gov.bd, ntdc.gov.pk. | 6 |
| `africa` | The dark-spot lane. For each grid: RE penetration vs publication reality, why dark (taxonomy), what exists. Seeds: Eskom Data Portal (eskom.co.za/dataportal — real CSV!), SAPP, Morocco ONEE, Egypt EETC, Kenya KPLC/KETRACO, Ethiopia EEP, Nigeria TCN/NERC, Ghana GRIDCo, Senegal Senelec, Namibia NamPower, GGFR for Nigeria/Algeria/Libya flare. | 10 |
| `latam` | Seeds: Mexico CENACE (nodal PML + generation), Argentina CAMMESA (cammesaweb datasets), Peru COES (portal with CSV), Ecuador CENACE-EC, Bolivia CNDC, Central America EOR/SIEPAC regional dispatch, Dominican Republic OC, Jamaica. Existing: brazil (done), chile, colombia, uruguay, paraguay, peru — check splits for those too. | 10 |
| `mideast-flare` | Gulf grids + per-field flare. Seeds: GGFR 2025 individual-flare-site data (downloadable site-level VIIRS), current 8 flare basins in `src/data/statics.json.ts` (can they split into named fields?), Saudi SEC, UAE EWEC/DEWA, Oman OETC, Kuwait MEW, Qatar Kahramaa, Israel Noga (existing live), Jordan NEPCO. | 8 |
| `seasia-pacific` | Seeds: Philippines WESM/IEMOP (market data downloads!), Vietnam NSMO/EVN (curtailment of solar boom documented), Indonesia PLN, Thailand EGAT, Malaysia TNB/GSO, Singapore EMA/NEMS, PNG, Fiji EFL. | 8 |

Dispatch in three parallel batches: (desk, entsoe, north-america) → (africa, latam, south-asia) → (east-asia, china, mideast-flare, seasia-pacific). After each batch: lint each lane CSV, spot-read 3 rows per lane for sanity, commit the batch:

```bash
python3 scripts/validation/lint_coverage_audit.py data/coverage-audit/lanes-2026-06/*.csv
git add data/coverage-audit/lanes-2026-06/
git commit -m "data(coverage-audit): lane CSVs batch N — <lanes>"
```

- [ ] **Step 2: Merge into the master CSV**

```bash
python3 scripts/validation/merge_coverage_audit.py \
  --output data/coverage-audit/2026-06-10-granularity-and-gaps.csv \
  data/coverage-audit/lanes-2026-06/*.csv
npm run lint:coverage-audit
```

Expected: `OK: wrote <N> rows` (N ≈ 70–110), then lint `OK` for both files. Merge conflicts on (country, subdivision, operator_name) mean two lanes hit the same operator — reconcile by editing the lane CSVs (keep the better-evidenced row), re-merge.

- [ ] **Step 3: Acceptance check against the spec**

```bash
python3 - <<'EOF'
import csv
with open("data/coverage-audit/2026-06-10-granularity-and-gaps.csv", newline="") as f:
    rows = list(csv.DictReader(f))
af = [r for r in rows if r["country"].split(" /")[0] in
      {"ZAF","MAR","EGY","KEN","ETH","NGA","GHA","SEN","NAM","DZA","LBY","TZA","ZMB","ZWE","MOZ","CIV"}
      or "Africa" in r["notes"]]
la = [r for r in rows if r["country"].split(" /")[0] in
      {"MEX","ARG","PER","ECU","BOL","CRI","PAN","GTM","HND","SLV","NIC","DOM","JAM","COL","CHL","URY","PRY","BRA"}]
splits = [r for r in rows if r["parent_region_id"]]
print(f"total={len(rows)} africa={len(af)} latam={len(la)} split_rows={len(splits)}")
EOF
```

Expected: `africa ≥ 8`, `latam ≥ 8`, `split_rows ≥ 10`. If a lane under-delivered, re-dispatch that lane with the gap named ("you returned 4 African grids; the acceptance bar is 8 — extend to <named seeds not yet probed>").

- [ ] **Step 4: Commit the merged master**

```bash
git add data/coverage-audit/2026-06-10-granularity-and-gaps.csv package.json
git commit -m "data(coverage-audit): merged granularity-and-gaps master CSV"
```

---

### Task 4: Verification pass (top 15)

**Files:**
- Modify: `data/coverage-audit/lanes-2026-06/*.csv` (downgrades, if any) and re-merged master

- [ ] **Step 1: List the top 15 by score**

```bash
python3 - <<'EOF'
import csv
with open("data/coverage-audit/2026-06-10-granularity-and-gaps.csv", newline="") as f:
    rows = list(csv.DictReader(f))
for r in rows[:15]:   # merge already sorts by priority_score desc
    print(f'{r["priority_score"]:>9}  {r["operator_name"][:40]:40} {r["operator_url"][:50]:50} {r["granularity_available"]}')
EOF
```

- [ ] **Step 2: Dispatch one verifier per top-15 row**

Verifier prompt (fill `{ROW}` with the full CSV row, `{CLAIM}` with the one-sentence granularity/coverage claim):

````text
You are a cold verifier. A researcher claims: {CLAIM}
Row under test: {ROW}

Re-probe the operator_url and the claimed data path YOURSELF (WebFetch). For SPLIT
claims, fetch one actual data artifact and confirm the finer breakdown column/field
exists (name it). For GAP claims, confirm the stated reason (e.g. PDF-only) is what
you actually observe. You may NOT take the researcher's word for anything.

Return exactly:
VERDICT: CONFIRMED | REFUTED | UNREACHABLE
EVIDENCE: <one line — the column/field/file you saw, or what you got instead>
````

Dispatch in parallel (15 agents). Tally verdicts.

- [ ] **Step 3: Apply downgrades**

For each REFUTED or UNREACHABLE row: edit the row **in its lane CSV** — set `coverage_status` to `unknown`, prepend `VERIFY-FAILED <date>: <evidence>` to `notes` (≤200 chars total), and for refuted split rows set `granularity_available` to `none` and clear `parent_region_id`. Then re-merge (Task 3 Step 2 command) and re-lint. Record the confirm/refute tally for the synthesis doc.

- [ ] **Step 4: Commit**

```bash
git add data/coverage-audit/
git commit -m "data(coverage-audit): top-15 verification pass — <X> confirmed, <Y> downgraded"
```

---

### Task 5: Synthesis doc

**Files:**
- Create: `docs/research/2026-06-10-granularity-and-gaps.md`

- [ ] **Step 1: Write the synthesis** with exactly this skeleton, filled from the merged CSV + lane summaries + verification tally:

```markdown
# Granularity & Gaps — survey synthesis (2026-06-10)

Source: `data/coverage-audit/2026-06-10-granularity-and-gaps.csv` (<N> rows, 10 lanes,
top-15 verified: <X> confirmed / <Y> downgraded). Spec:
`docs/superpowers/specs/2026-06-10-granularity-and-gaps-survey-design.md`.

## 1. Where the world's grids are — and where we're dark
<Per continent: grids with material RE penetration; ours vs dark. One table.>

## 2. Why the dark spots are dark
<Gap taxonomy table: no-portal / PDF-only / geo-blocked / auth-walled /
genuinely-negligible — one row per assessed dark grid, with probe evidence.>

## 3. What would light each one up
<Per gap class: the concrete unlock (parser, relay à la Colombia, anchor-only T3).>

## 4. Granularity wins available now (split rows)
<Confirmed split candidates: parent region, granularity, evidence column/field.>

## 5. Ranked top-20 implementation backlog
<Table: rank, candidate, score, type (split/gap), effort S/M/L (S=existing loader
pattern, M=new parser known pattern, L=new upstream/relay/auth), expected_new_regions,
first implementation step. Note: every split PR must walk the 5-file checklist AND
run `check-magnitude-golden --update`.>

## 6. What the survey could not determine
<Honest residue: unverifiable claims, lanes that came back thin, geo-block ambiguity.>
```

No section may be empty; section 6 exists so thin results are stated rather than padded.

- [ ] **Step 2: Commit**

```bash
git add docs/research/2026-06-10-granularity-and-gaps.md
git commit -m "docs(research): granularity & gaps survey synthesis + ranked backlog"
```

---

### Task 6: Ship

**Files:**
- Modify: `STATUS.md`

- [ ] **Step 1: Full verification**

```bash
npm run lint:coverage-audit && npm run test:coverage-audit 2>&1 | tail -3
npm run typecheck && npm test 2>&1 | tail -3   # prove no TS surface was touched
```

- [ ] **Step 2: Update STATUS.md** — under `## What's shipped on main`, add at the top of the dated entries:

```markdown
**Granularity & gaps survey — coverage-audit v2 (PR #TBD, 2026-06-10):**
- Schema v2 (`coverage_audit_schema.py`): +parent_region_id/granularity_available/expected_new_regions, split-row scoring branch (no already-modelled penalty); v1 world CSV migrated, scores byte-stable (regression-tested).
- `data/coverage-audit/2026-06-10-granularity-and-gaps.csv` — <N> candidates across 10 research lanes, top-15 cold-verified (<X>/<Y>).
- Synthesis + ranked top-20 split/gap backlog: `docs/research/2026-06-10-granularity-and-gaps.md`. Implementation PRs to follow, top-ranked first; each walks the 5-file checklist + magnitude `--update`.
```

Update the `What's NOT shipped / open PRs` line to list this PR as open. Fill `#TBD` after `gh pr create` returns the number (commit STATUS after PR creation, same branch).

- [ ] **Step 3: Push and open PR**

```bash
git push -u origin feat/granularity-gaps-survey
gh pr create --title "feat: granularity & gaps survey (coverage-audit v2)" --body "$(cat <<'EOF'
## Summary
- Coverage-audit schema v2: three granularity columns, split-row scoring branch; v1 CSV migrated with byte-stable scores (regression-tested)
- 10-lane agent research sweep → data/coverage-audit/2026-06-10-granularity-and-gaps.csv (<N> rows, lint-clean)
- Top-15 candidates cold-verified (<X> confirmed / <Y> downgraded, audit trail in notes)
- Synthesis + ranked top-20 implementation backlog: docs/research/2026-06-10-granularity-and-gaps.md

## Verification
(paste lint:coverage-audit + test:coverage-audit + npm test tails)

Spec: docs/superpowers/specs/2026-06-10-granularity-and-gaps-survey-design.md
Plan: docs/superpowers/plans/2026-06-10-granularity-gaps-survey.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Then fill STATUS.md's `#TBD`, commit (`docs(status): record granularity-gaps-survey PR #<n>`), push.

- [ ] **Step 4: After merge** — move plan + spec to their `archive/` directories with `STATUS: SHIPPED` banners, per CLAUDE.md plan lifecycle.

---

## Self-review notes

- Spec coverage: schema v2 ✓ (Task 1), migration + byte-stability ✓ (Task 2), ten lanes with contracts ✓ (Task 3), verification pass ✓ (Task 4), synthesis with taxonomy + top-20 ✓ (Task 5), acceptance criteria checked mechanically ✓ (Task 3 Step 3), gates impact ✓ (Task 6 verification proves TS untouched).
- The plan deliberately leaves `loader_pattern_hint` as `not-applicable` for all new rows — pattern assignment happens at implementation time (YAGNI; the original Pattern-A–D definitions live with the v1 audit spec and aren't needed to rank).
- Research tasks cannot be TDD; their rigor substitutes are the lint gate, the acceptance-check script, and the mandatory verification pass.
