# `external-anchors.json` schema v2 — anchor-level provenance

Date: 2026-04-25 · Owner: Claude (council finding S1) · Status: design — implementation queued for Gemini (GEMINI-3) · Paper section: Methods §4 / Code Availability §6.

## Why this exists

The 5-agent council audit (Model QA finding) flagged that the current `external-anchors.json` records numeric anchor values (e.g. `"germany": {"tso_annual_twh": {"2024": 23.2}}`) without any structured provenance. The free-text `tso_annual_latest` string ("BNetzA 2024: ~19.5 TWh onshore wind, ~3.1 TWh offshore wind, ~0.6 TWh solar curtailment") names a publisher but does not carry a stable URL, retrieval date, or release identifier. A Scientific Data reviewer cannot verify any specific anchor without round-tripping through informal search.

Schema v2 closes that gap. Every numeric anchor gains a stable, citable provenance id resolving to a structured `_provenance` block at the top of the file. Existing v1 fields are preserved; v2 is additive, so migration can land incrementally without breaking `build_region_docs.py` or `empirical_tier_bands.py`.

## Design constraints (locked)

1. **Additive, not breaking.** `tso_annual_latest`, `tso_annual_twh`, `ember_annual_twh`, `irena_annual_twh`, `other_anchor`, `limitations`, `discrepancy_discussion` keep their current shape. v2 fields appear alongside, never replacing.
2. **DRY provenance.** Many anchors share a single source (e.g. one Potomac SoM cites ERCOT-West and ERCOT-East). Provenance metadata lives in one top-level `_provenance` block; per-region anchors reference it by id. No copy-paste duplication.
3. **Audit-grade citation.** Every v2 anchor must answer: *who published this, when, and where can I download exactly the file you read?* That is `title` + `publisher` + `publication_date` + `source_url` + `retrieved_at` at minimum.
4. **Numeric integrity.** When both v1 (`tso_annual_twh[year]`) and v2 (`tso_annual_anchors[year].value`) are present for the same region-year, the values MUST match exactly. CI enforces this so accidental drift is impossible.
5. **No history field.** Prior anchor values are recoverable via `git log -p scripts/validation/external-anchors.json`. Embedding history inside the JSON would duplicate VCS responsibility and bloat the file.

## v2 schema

```json
{
  "_schema_version": 2,
  "_description": "...",
  "_fields": { /* updated to describe v2 fields too */ },

  "_provenance": {
    "<provenance_id>": {
      "title": "<short title of the publication>",
      "publisher": "<organisation name>",
      "publication_date": "<ISO-8601 YYYY-MM-DD or YYYY-MM>",
      "source_url": "<stable URL to the file or page>",
      "release_id": "<optional internal release id, e.g. doi, report number>",
      "retrieved_at": "<ISO-8601 YYYY-MM-DD>",
      "retrieved_by": "<short author tag, e.g. 'gemini', 'claude', 'simon'>",
      "notes": "<optional one-line note: section, table, or caveat>"
    },
    ...
  },

  "<region_id>": {
    "tso_annual_latest": "<v1, kept verbatim>",
    "tso_annual_twh": {"2024": 8.0},
    "tso_annual_anchors": {
      "2024": {
        "value": 8.0,
        "unit": "TWh",
        "provenance_id": "<key into _provenance>",
        "scope": "<optional: e.g. 'wind+solar curtailment, all zones'>",
        "method": "<optional: e.g. 'reported', 'inferred', 'estimated'>"
      }
    },
    "ember_annual_anchors": { "2023": { "value": 7.4, "unit": "TWh", "provenance_id": "ember-2023-usa" } },
    "irena_annual_anchors": { ... },
    "other_anchors": [
      { "label": "<short human label>", "value": <number>, "unit": "TWh", "year": <int>, "provenance_id": "<key>" }
    ],
    "limitations": "<v1, kept verbatim>",
    "discrepancy_discussion": "<v1, kept verbatim>",
    "_anchor_meta": {
      "migrated_to_v2": true,
      "migrated_at": "2026-04-26",
      "migration_notes": "<optional: e.g. 'inferred year from string'>"
    }
  }
}
```

### Field reference

#### `_provenance.<id>` (top-level block)

| Field | Required | Format | Example |
|---|---|---|---|
| `title` | yes | free string | "ERCOT 2024 State of the Market Report" |
| `publisher` | yes | free string | "Potomac Economics" |
| `publication_date` | yes | `YYYY-MM-DD` (preferred) or `YYYY-MM` | "2025-05-15" |
| `source_url` | yes | absolute URL | "https://www.potomaceconomics.com/wp-content/uploads/2025/05/2024-ERCOT-SOM-REPORT.pdf" |
| `release_id` | optional | free string | "SOM-2024-Annual"; "doi:10.5067/..."; "EIA Form-923 v2024-Q4" |
| `retrieved_at` | yes | `YYYY-MM-DD` | "2026-04-22" |
| `retrieved_by` | optional | short tag | "gemini" |
| `notes` | optional | one-line | "Section 6.3 'Renewable Curtailment'; Table 6-4" |

#### `<region_id>.tso_annual_anchors.<year>` (per-region per-year structured anchor)

| Field | Required | Format | Example |
|---|---|---|---|
| `value` | yes | number | 8.0 |
| `unit` | yes | enum: `"TWh"`, `"GWh"`, `"Bcm"` | `"TWh"` |
| `provenance_id` | yes | key into `_provenance` | `"potomac-2024-som"` |
| `scope` | optional | free string | `"wind+solar curtailment, all zones"` |
| `method` | optional | enum: `"reported"`, `"inferred"`, `"estimated"`, `"derived"` | `"reported"` |

#### `<region_id>._anchor_meta`

Tracks migration state. Allows partial rollout — regions without `_anchor_meta.migrated_to_v2 = true` are still v1-only and CI tolerates them during the migration window.

## Provenance ID naming convention

Keys in `_provenance` are slugs of the form `<publisher>-<year>-<short-id>`, lowercased and hyphen-separated. Examples:

| Provenance id | Resolves to |
|---|---|
| `potomac-2024-som` | Potomac Economics 2024 ERCOT State of the Market |
| `bnetza-2024-monitoring` | Bundesnetzagentur Monitoringbericht 2024 |
| `ember-2024-china` | Ember 2024 China Electricity Review |
| `ggfr-2024-flaring` | World Bank GGFR 2024 Flaring Tracker |
| `entsoe-2024-a75-spain` | ENTSO-E A75 query result for `10YES-REE------0` 2024 (data product) |
| `ons-2024-restricao` | ONS 2024 `restricao_coff` dataset |
| `aemo-2024-nemweb-q4` | AEMO NEMWeb Dispatch_SCADA Q4 2024 |
| `aeso-2024-csd` | AESO 2024 Current Supply/Demand annual rollup |

When a single publisher releases multiple distinct documents in the same year, the `<short-id>` disambiguates: `bnetza-2024-monitoring` vs `bnetza-2024-redispatch`. Keep slugs ≤ 32 chars where possible.

When the source is a queryable API rather than a static document, the slug describes the query: `entsoe-2024-a75-spain`. The `_provenance` entry's `source_url` should link to the API documentation and the `notes` field should record the exact query (parameters, date range).

## Migration plan (for GEMINI-3)

The migration sweep covers all 124 regions with at least one v1 string anchor and 33 regions with `tso_annual_twh` numeric values.

### Step 1 — Build the `_provenance` block

For each unique source cited across the file, mint one provenance id and one `_provenance` entry. Expected ~30–40 unique sources covering 124 regions (most cite 1–2 of: TSO official report, Ember annual, IRENA, GGFR, EIA, AEMO, ONS, ENTSO-E API).

For each entry, populate from existing knowledge:
- `title` and `publisher` — extract from the v1 `tso_annual_latest` string.
- `publication_date` — usually inferable from the year stated in the string; default to `YYYY-12-31` if only year is known.
- `source_url` — most TSO publications have stable URLs. Where not findable, mark `source_url: null` and add `_provenance_meta.needs_url: true` (CI will surface as a warning, not error).
- `retrieved_at` — `2026-04-26` (the migration date).
- `retrieved_by` — `"gemini"`.
- `notes` — free.

### Step 2 — Add structured anchors per region

For each region with `tso_annual_twh`, add a parallel `tso_annual_anchors` block:

```json
"germany": {
  "tso_annual_latest": "BNetzA 2024: ...",
  "tso_annual_twh": {"2024": 23.2},
  "tso_annual_anchors": {
    "2024": {
      "value": 23.2,
      "unit": "TWh",
      "provenance_id": "bnetza-2024-monitoring",
      "scope": "onshore wind + offshore wind + solar curtailment + redispatch",
      "method": "reported"
    }
  },
  "_anchor_meta": {"migrated_to_v2": true, "migrated_at": "2026-04-26"}
}
```

For regions with **only** `tso_annual_latest` (no numeric anchor), the migration parses the string for a numeric value where possible and creates a `tso_annual_anchors` entry with `method: "inferred"`. Where the string is qualitative ("minimal curtailment"), no numeric anchor is added — the v1 string stands alone.

### Step 3 — Handle `ember_annual_twh`, `irena_annual_twh`, `other_anchor`

- `ember_annual_twh` strings (e.g. `"3.4 (solar only, 2024)"`) → parse and convert to `ember_annual_anchors: { "2024": { value: 3.4, unit: "TWh", provenance_id: "ember-2024-..." } }`.
- `irena_annual_twh` → same pattern.
- `other_anchor` strings → convert to an `other_anchors` array (since regions sometimes cite multiple), each entry referencing a `provenance_id`.

### Step 4 — Edge cases

- **Range anchors** ("low single-digit TWh/yr") → set `value` to the midpoint of the range, `method: "estimated"`, `notes` field on the anchor records the original range.
- **Year-ambiguous anchors** ("treated as 0.05 TWh midpoint for Δ% calc") → keep year as-is, set `method: "inferred"`, surface in `migration_notes`.
- **Missing URLs** — if no stable URL is recoverable, `source_url: null`; CI emits warning, paper draft footnote flags as "URL unavailable as of 2026-04 retrieval; archived copy on request".
- **Contradicting v1↔v2 values** — must NOT happen by design. CI fails the build if `tso_annual_twh[2024] != tso_annual_anchors["2024"].value`.

### Step 5 — Validation

Run `scripts/validation/check_anchors.py` (see "Tooling" below) against the migrated file. Must pass clean.

### Step 6 — Documentation

Update `docs/methodology/anchors.md` (create if absent) with:
- A table of every `_provenance` entry and the regions that cite it.
- The provenance-id naming convention.
- How to add a new anchor (provenance entry first, then per-region reference).
- A snippet showing the v1↔v2 coexistence pattern.

## Tooling (Codex follow-up, S4 implementation)

Three small additions land alongside the migration:

### 1. `scripts/validation/check_anchors.py` (new)

Validation script invoked in CI. Asserts:

1. `_schema_version` field present and ∈ `{1, 2}`.
2. If `_provenance` block present: every entry has required fields (`title`, `publisher`, `publication_date`, `source_url`, `retrieved_at`).
3. For every region with `_anchor_meta.migrated_to_v2 = true`:
   - Every `provenance_id` referenced resolves to a `_provenance` entry.
   - Every `tso_annual_anchors[year].value` matches `tso_annual_twh[year]` exactly (if both exist).
   - `unit` ∈ `{"TWh", "GWh", "Bcm"}`.
   - `retrieved_at` parseable as ISO-8601.
4. No orphan `_provenance` entries (every entry is referenced by ≥1 region) — emits warning, not error.
5. Provenance-id naming convention regex: `^[a-z0-9]+(-[a-z0-9]+)*$`.

Exit 0 on pass, non-zero on any fail. Warnings printed but don't fail.

### 2. `build_region_docs.py` v2 awareness (extension)

When rendering a region MD, if `_anchor_meta.migrated_to_v2 = true`:
- Prefer `tso_annual_anchors` over the free-text `tso_annual_latest` for the "Published anchors" section.
- Render each anchor as `**TSO annual curtailment (YYYY):** <value> <unit> [<title>](<source_url>) (retrieved <retrieved_at>)`.
- Emit a footnote-style citation with the full `_provenance` entry.

If not migrated, behaviour is unchanged (current v1 rendering).

### 3. `empirical_tier_bands.py` — no immediate change

The script currently reads `tso_annual_twh[year]`. Since v2 is additive and the v1 dict is retained, the script keeps working unchanged through migration. A future enhancement could read `tso_annual_anchors` and surface the `provenance_id` in the per-pair output for direct citability.

## CI integration (overlaps with S4 design)

Add to the existing GitHub Actions workflow:

```yaml
- name: Validate external anchors
  run: python3 scripts/validation/check_anchors.py
```

Step fails the build on any v2 violation. v1-only regions pass cleanly during migration.

## Acceptance criteria for GEMINI-3

GEMINI-3's PR is mergeable when:
1. `_schema_version` bumped to `2`.
2. `_provenance` block contains entries for every distinct source cited.
3. Every region with `_anchor_meta.migrated_to_v2 = true` has either:
   - a `tso_annual_anchors` block resolving cleanly, or
   - documented `migration_notes` explaining why it could not be migrated (e.g. no numeric anchor available).
4. `python3 scripts/validation/check_anchors.py` exits 0.
5. `build_region_docs.py` runs successfully against the new file (no regressions).
6. `empirical_tier_bands.py` runs successfully and produces identical output to pre-migration baseline.
7. The PR's commit message follows the format: `feat(anchors): migrate external-anchors.json to schema v2 with structured provenance (council finding S1)`.

## Out of scope (v3+)

- **Anchor history inside JSON** — git log handles this. v2 deliberately does not include a `_history` field.
- **Anchor-level confidence scoring** — Scientific Data reviewers don't need probabilistic weights on individual anchors at this revision. v3 if/when triangulation across anchors becomes its own analysis.
- **Inverse provenance lookup** — i.e. "what regions cite Ember-2024-China?" — this can be derived from a one-shot SQL-on-JSON query (e.g. `jq` script); does not need to live inside the schema.
- **Multi-language source titles** — every `title` is in the publisher's primary language; we do not maintain translations.

## Status table

| Step | Owner | Status |
|---|---|---|
| Schema v2 design | Claude | ✅ this doc |
| Migration sweep | Gemini (GEMINI-3) | dispatched |
| `check_anchors.py` validator | Codex (S4 implementation) | queued |
| `build_region_docs.py` v2 rendering | Codex (S4 implementation) | queued |
| CI integration | Codex (S4 implementation) | queued |
| `docs/methodology/anchors.md` write-up | Claude | post-Gemini |
| Update paper §4 + §6 | Claude / Gemini | post-implementation |
