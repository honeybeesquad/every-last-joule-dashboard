# Granularity & Gaps Survey (coverage-audit v2) — Design

**Date:** 2026-06-10 · **Status:** DRAFT (pending user review) · **Approach:** agent fan-out (Option A, user-selected)

## Goal

Produce a ranked, evidence-backed backlog of opportunities to densify the globe, science-led: split existing regions into sub-national × fuel entries **only where the upstream genuinely measures finer** (the Brazil ONS pattern — per-plant rows with state codes, separate wind/solar feeds), and map the dark spots (Africa, LATAM, South/SE Asia) — where are real grids with renewable penetration, why are they dark on our globe, and what would light them up.

This is a survey, not an implementation effort. Implementation of top candidates happens in follow-up PRs, each walking the established 5-file checklist plus a magnitude-baseline `--update` (PR #149 gate).

## Background

- The Brazil pattern (`src/data/brazil-ne.json.ts`): one upstream, two per-fuel CSV feeds, explicit `id_estado` state codes → 14 states × 2 fuels. The survey hunts for upstreams with this property.
- 167 of 385 regions already carry fuel-suffixed ids; the rest are national or `kind: "mixed"` aggregates.
- The repo already has coverage-audit machinery from the original world sweep: `data/coverage-audit/2026-04-26-world.csv` (345 rows), `scripts/validation/coverage_audit_schema.py` (17-column schema, enums, priority formula), lint/merge tools, pytest suite (`npm run lint:coverage-audit`, `npm run test:coverage-audit`). This survey is v2 of that audit, reusing all of it.

## Deliverables

1. **`data/coverage-audit/2026-06-10-granularity-and-gaps.csv`** — one row per candidate (split or gap-fill), schema v2 (below), passing lint. (Dated like the v1 `2026-04-26-world.csv`.)
2. **`docs/research/2026-06-10-granularity-and-gaps.md`** — synthesis: world grid inventory → which are dark → why (taxonomy: no-portal / PDF-only / geo-blocked / auth-walled / genuinely-negligible-curtailment) → what fills each → **ranked top-20 implementation backlog** with effort estimates.
3. **Schema v2** — `coverage_audit_schema.py` + tests updated; 2026-04-26 CSV migrated (three empty columns appended) so one schema lints both vintages.

## Schema v2 changes

Three columns appended to `COLUMN_ORDER` (positions 18–20, after `notes` — appending keeps v1 column positions stable):

| Column | Type | Values |
|---|---|---|
| `parent_region_id` | string | existing region id this candidate splits from; empty for new-coverage rows |
| `granularity_available` | enum | `plant`, `state`, `bidding-zone`, `fuel-split`, `none` |
| `expected_new_regions` | int ≥ 0 | how many globe entries this candidate would add (net) |

New enum `GRANULARITY_ENUM` with the five values. `validate_row` gains: `parent_region_id`, when non-empty, must match `^[a-z0-9][a-z0-9-]*$`; `granularity_available` must be in enum; `expected_new_regions` must parse as non-negative int.

**Scoring branch.** The v1 `priority_score` penalizes already-modelled rows (`tier_uplift_weight 0.6`, `0.5 × anchor` penalty) — correct for coverage gaps, wrong for splits (it would zero-out every granularity candidate). v2:

- `parent_region_id` empty (gap row): v1 formula unchanged.
- `parent_region_id` set (split row): `score = anchor_TWh × granularity_weight × format_weight`, no penalty, where granularity_weight = plant 1.0 / state 0.9 / bidding-zone 0.8 / fuel-split 0.7 / none 0.0. `anchor_TWh` is the parent's affected annual TWh.

Both vintages of CSV must lint under v2 (v1 rows have empty new columns → treated as gap rows, formula unchanged, scores stable).

## The ten research lanes

Each lane = one research agent (WebSearch/WebFetch capable) with the output contract below.

| # | Lane | Hunts |
|---|---|---|
| 1 | Already-in-hand (desk lane) | Granularity fetched but discarded: AEMO per-DUID rows (sub-state clusters/REZ), ENTSO-E zone×tech not yet split, EIA per-BA×fuel beyond current ISOs, Japan area-CSV separate solar/wind columns (currently summed), Colombia XM per-Recurso (data-spine lake), Chile CEN per-plant reductions |
| 2 | North America beyond current | Additional EIA BAs (Southeast, WAPA, etc.), Canada (IESO zones, AESO detail) |
| 3 | ENTSO-E granularity | Unsplit bidding zones (Italy N/S/Sicily/Sardinia, Sweden SE1–4), mixed→per-fuel where A75/B16 supports it |
| 4 | East Asia | Korea KPX, Taiwan Taipower regional |
| 5 | China finer | Sub-NEA-provincial sources (grid-company disclosures, provincial NDRC); flag measured vs capacity-ratio (cosmetic) fuel splits explicitly |
| 6 | India + South Asia | SLDC re-probe (3/6 were open per PR #74), POSOCO regional reports, Bangladesh/Pakistan/Sri Lanka |
| 7 | Africa | Eskom/SAPP, Morocco ONEE, Egypt EETC, Kenya, Ethiopia, Nigeria, Ghana, Senegal — RE penetration vs publication reality; gap taxonomy per country |
| 8 | LATAM | Mexico CENACE nodal, Argentina CAMMESA regions, Peru COES, Ecuador, Central America EOR/SIEPAC, Caribbean |
| 9 | Middle East + flare | Gulf grids; GGFR per-field flare sites (potential split of the 8 flare basins into named fields) |
| 10 | SE Asia + Pacific | Philippines WESM, Vietnam NSMO, Indonesia, Thailand, Malaysia |

## Agent output contract

Every emitted row MUST:
- cite an `operator_url` the agent actually probed this session; `probe_result` is free text ≤80 chars recording what happened (v1 style: `known-public-API`, `homepage-200`, an HTTP status, `timeout`), while `data_format` carries the controlled `DATA_FORMAT_ENUM` value;
- carry `available_anchor` naming a citable magnitude source (or empty + `coverage_status: unknown`);
- keep `notes` ≤ 200 chars (schema limit);
- for split rows: name the parent region and the *evidence that the upstream publishes the finer breakdown* (not an inference from capacity statistics).

Rows without probe evidence are rejected at merge. Agents return rows as CSV lines matching `COLUMN_ORDER` v2; the controller merges via `merge_coverage_audit.py`, lints, and hand-reviews.

## Verification pass

Before the backlog is finalized, the top ~15 candidates by score get a fresh verification agent each: re-probe the cited URL cold, confirm the claimed granularity exists (e.g., actually fetch one CSV and confirm the state/plant/fuel column), record a one-line confirmation or refutation. Refuted rows are downgraded (`coverage_status: unknown`) not deleted — the audit trail is the point. Fabrication risk is the #1 failure mode of agent research; this pass is mandatory.

## Ranking & synthesis

The synthesis doc ranks verified candidates by v2 `priority_score`, annotated with effort class (S: reuse existing loader pattern / M: new parser, known pattern / L: new upstream + relay or auth complexity). The dark-spots section is organized by the gap taxonomy, answering per major grid: why dark, what's needed (portal exists but PDF-only → parser; geo-blocked → relay like Colombia; nothing published → document as structural gap, anchor via IRENA/Ember).

## Gates impact

The survey itself touches: the new CSV, the migrated v1 CSV, `coverage_audit_schema.py` + tests. `npm run lint:coverage-audit` (extended to lint both files) and `npm run test:coverage-audit` must pass. No region/tier/snapshot changes — tally golden, docs-drift, magnitude golden are untouched until implementation PRs.

## Out of scope

- Implementing any split or new region (follow-up PRs, top-ranked first).
- T3 profile seasonality / weather modelling (separate representativeness effort).
- Historical backfill extension.
- Procuring India-PoP VPN or new relay hosts (documented as "what's needed" only).

## Acceptance criteria

1. Schema v2 lints both CSV vintages; pytest suite green.
2. ≥1 row for every current live-tier upstream family (lanes 1–4) and ≥8 African + ≥8 LATAM grids assessed (lanes 7–8), each with probe evidence.
3. Top-15 candidates independently verified (confirm/refute recorded).
4. Synthesis doc answers where/why/what-fills for every documented gap and ends in the ranked top-20 backlog.
5. Zero rows without probe evidence survive the merge.

## Risks

- **Agent fabrication** → probe-evidence contract + mandatory verification pass (top-15) + spot checks.
- **Stale URLs / geo-blocks skewing results** → record from where the probe ran; geo-blocked ≠ nonexistent (Colombia precedent).
- **Scoring distortion** → v1 rows' scores must be byte-stable after migration (regression-tested in the schema pytest suite).
