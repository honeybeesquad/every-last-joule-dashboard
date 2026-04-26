# GEMINI-3 — anchor schema v2 migration: Codex/Gemini dispatch brief

Date: 2026-04-26 · Author: Claude (BRRRRR-mode autonomous brief generation) · Target: Scientific Data submission Nov 2026 · Status: **paste-ready, awaiting Simon's go-signal before dispatch**

> **Read-me-first.** The schema v2 design has been complete since 2026-04-25 at `docs/proposals/anchor-schema-v2.md` (Claude, council finding S1). The original council-remediation brief at `docs/proposals/2026-04-25-council-remediation-dispatch.md` left the GEMINI-3 task as a one-line preview pending the design landing. The design has now landed; this file promotes the preview to a paste-ready dispatch brief. Hand this entire file (or just §3 below) to a Gemini agent and it has everything needed to ship a clean migration PR.

---

## 1. Why this matters

Scientific Data reviewers are explicitly trained to ask, for every numeric anchor in the dataset:

1. *"Can I download the source you cite, today?"* — answered by `source_url` + `retrieved_at` (v2 only).
2. *"Is this the same version you used?"* — answered by `release_id` + `publication_date` (v2 only).
3. *"Who chose to use this anchor instead of an alternative?"* — answered by `retrieved_by` (v2 only).
4. *"Was the URL still live at the time of submission?"* — answered by `retrieved_at` being recent (v2 only).

The current v1 schema records only a free-text `tso_annual_latest` ("BNetzA 2024: ~19.5 TWh onshore wind, ~3.1 TWh offshore wind, ~0.6 TWh solar curtailment") and an optional numeric dict `tso_annual_twh: {"2024": 23.2}`. None of the four reviewer questions can be answered without round-tripping through informal search. **Schema v2 closes the gap by adding a structured `_provenance` block plus per-region structured anchor entries.** The migration is mechanical but must touch 124 region entries + 31 quantitative anchors + ~30–40 unique provenance sources, so it is sized for an autonomous Gemini run rather than a human-curated session.

---

## 2. Scope of file to migrate

`scripts/validation/external-anchors.json` (496 lines, 124 regions, 31 with `tso_annual_twh`, `_schema_version: 1`).

By the numbers (probed 2026-04-26):

| Metric | Count |
|---|---|
| Total top-level region entries | 124 |
| Entries with `tso_annual_latest` (free-text) | 124 |
| Entries with `tso_annual_twh` (numeric) | 31 |
| Entries with `ember_annual_twh` | 2 |
| Entries with `irena_annual_twh` | 1 |
| Entries with `other_anchor` | 22 |
| Entries with `limitations` (free-text caveat) | 24 |
| Entries with `discrepancy_discussion` | 1 |
| Estimated unique sources to mint into `_provenance` | 30–40 |

The full v2 spec — including the JSON schema, the field reference, the provenance-id naming convention, and the migration plan — lives at `docs/proposals/anchor-schema-v2.md`. **Read that file first.** This brief is a thin operational wrapper around it.

---

## 3. Codex/Gemini paste-block

### Repo
`github.com/honeybeesquad/every-last-joule-dashboard` (or local clone via `gh repo clone`).

### Branch
Cut `gemini/gemini-3-anchor-schema-v2` from `v0-build`.

### Goal
Migrate `scripts/validation/external-anchors.json` from `_schema_version: 1` to `_schema_version: 2`, introducing the structured `_provenance` block and per-region `*_anchors` entries as specified in `docs/proposals/anchor-schema-v2.md`. The migration must be **additive** — every existing v1 field is retained verbatim; v2 fields appear alongside them. No region's downstream behaviour changes during the migration window.

### Source spec
**Read in this order, beginning to end, before writing any JSON:**

1. `docs/proposals/anchor-schema-v2.md` (255 lines, the full design — §"v2 schema", §"Field reference", §"Provenance ID naming convention", §"Migration plan" §1–§6).
2. `scripts/validation/external-anchors.json` (current v1 file — read it whole; do not assume structure from the design doc alone).
3. `docs/methodology/anchors.md` (the prose companion explaining which sources are used and why — useful for sanity-checking provenance fields).

### Inputs
- The current `external-anchors.json` v1 file.
- The v2 schema design doc.
- Public web access (for verifying source URLs where you can; if a URL won't resolve from the build environment, set `source_url: null` and add a `_provenance_meta.needs_url: true` marker per the migration plan §Step 1).
- This brief.

### Required transformations

Implement steps §1–§5 of the migration plan in `anchor-schema-v2.md` exactly as specified. In summary:

1. **Bump schema version.** `_schema_version: 1` → `_schema_version: 2`. Update `_description` to mention the v2 fields.
2. **Build the `_provenance` block.** For each unique source cited across all 124 regions, mint one provenance id (slug `<publisher>-<year>-<short-id>`) and one `_provenance` entry with `title`, `publisher`, `publication_date`, `source_url`, `release_id` (optional), `retrieved_at: "2026-04-26"`, `retrieved_by: "gemini"`, `notes` (optional).
3. **Add `tso_annual_anchors` per region.** For every region with `tso_annual_twh`, add a parallel `tso_annual_anchors` block keyed by year, with `value` matching `tso_annual_twh` exactly (CI fails on drift), `unit: "TWh"`, `provenance_id` resolving into `_provenance`, optional `scope` and `method`.
4. **Convert `ember_annual_twh`, `irena_annual_twh`, `other_anchor`.** Parse v1 strings (e.g. `"3.4 (solar only, 2024)"`) into `ember_annual_anchors: {"2024": {value: 3.4, unit: "TWh", provenance_id: "ember-2024-..."}}`. `other_anchor` strings → `other_anchors` array.
5. **Mark migrated regions.** Add `_anchor_meta: {migrated_to_v2: true, migrated_at: "2026-04-26", migration_notes: "<optional>"}` to every region you migrate. **Critical:** if a region cannot be cleanly migrated (e.g. the v1 string is qualitative like "minimal curtailment" with no numeric anchor), leave `_anchor_meta` off, retain v1 verbatim, and document the skip reason in the PR description.

**Do not** touch any v1 field except to leave it in place. **Do not** rewrite, "tidy up", reformat, or normalise existing v1 content. v1 keys are immutable during this migration.

### Acceptance criteria

(Lifted directly from `anchor-schema-v2.md` §"Acceptance criteria for GEMINI-3", with one tightening.)

The PR is mergeable when **all** of the following hold:

1. `_schema_version` bumped to `2`.
2. `_provenance` block contains entries for every distinct source cited.
3. Every region with `_anchor_meta.migrated_to_v2 = true` has either:
   - a `tso_annual_anchors` block resolving cleanly, or
   - documented `migration_notes` explaining why it could not be migrated (e.g. no numeric anchor available).
4. `python3 scripts/validation/check_anchors.py` exits 0. **(NB: this script does not yet exist as of 2026-04-26 — it is part of S4. If it has not landed when GEMINI-3 starts, the equivalent check is `python3 -c "import json; d = json.load(open('scripts/validation/external-anchors.json')); print('OK')"` plus manual schema-shape inspection. GEMINI-3 must not block on `check_anchors.py` landing first.)**
5. `python3 scripts/validation/build_region_docs.py` runs successfully against the new file (no regressions vs the pre-migration baseline; `git diff docs/validation/` should be empty or only contain expected provenance additions).
6. `python3 scripts/calibration/empirical_tier_bands.py` runs successfully and produces identical numeric output to pre-migration baseline (it reads `tso_annual_twh`, which is preserved verbatim).
7. `npm run typecheck && npm test && npm run validate && npm run ci:gates` all pass — the JSON file is consumed by Python validators only, but a JSON-syntax error would surface in `npm run validate` if anchors are loaded by any TS code. Probe before assuming.
8. **Tightening:** `git diff scripts/validation/external-anchors.json` should show **only additions** (+ lines), not modifications (lines starting with `-` other than the `_schema_version` bump and the `_description` field's update). Reviewers should be able to verify additivity by visual diff inspection.

### Constraints

1. **Additive-only.** v1 fields stay verbatim. Reviewers will check this with a diff filter on `^-` lines.
2. **No new external dependencies.** This is a pure JSON edit; no Python or Node packages added.
3. **DRY provenance.** Many regions share a source — *one* `_provenance` entry, many regions reference it by id. No copy-paste duplication of `title`/`publisher`/`source_url`.
4. **Provenance id slug regex.** `^[a-z0-9]+(-[a-z0-9]+)*$`, ≤ 32 chars where possible. Examples: `bnetza-2024-monitoring`, `entsoe-2024-a75-spain`, `ggfr-2024-flaring`.
5. **Date discipline.** All dates ISO-8601 (`YYYY-MM-DD` preferred; `YYYY-MM` acceptable). `retrieved_at: "2026-04-26"` for every entry minted in this migration; `publication_date` is the publisher's date.
6. **URL handling.** Where a stable URL is recoverable, populate `source_url`. Where not, set `source_url: null` and add the `needs_url: true` flag — do not invent URLs.
7. **Numeric integrity.** When both v1 (`tso_annual_twh[year]`) and v2 (`tso_annual_anchors["year"].value`) are present for the same region-year, values MUST match exactly. CI will fail otherwise (when `check_anchors.py` lands; in the interim, verify by hand or with a one-shot jq).
8. **Branch protection.** Do not push to `v0-build` directly. Open a PR against `v0-build` from the feature branch and tag Simon for review.

### Done when

- `_schema_version: 2` and the file diff is purely additive.
- All ~30–40 unique sources have a single canonical `_provenance` entry, and every numeric anchor in any region cites one of them by `provenance_id`.
- The full validation chain (`npm run typecheck && npm test && npm run validate && npm run ci:gates && python3 scripts/validation/build_region_docs.py && python3 scripts/calibration/empirical_tier_bands.py`) is green.
- The PR description enumerates: how many regions were migrated to v2, how many were left v1-only and why, how many provenance entries were minted, and how many `source_url: null` markers were added with `needs_url: true`.

### Commit message

Single commit, conventional-commits format:

```
feat(anchors): migrate external-anchors.json to schema v2 with structured provenance (council finding S1)

Bumps _schema_version 1 -> 2. Adds the _provenance block (~N entries
covering every distinct source cited across the file) and the per-region
*_anchors structured blocks (tso_annual_anchors, ember_annual_anchors,
irena_annual_anchors, other_anchors). All v1 fields retained verbatim
for backward compatibility; the migration is purely additive.

Migration count:
- N regions migrated to v2 (carry _anchor_meta.migrated_to_v2 = true).
- M regions retained v1-only (qualitative anchor strings with no numeric
  value to migrate; reasons in _anchor_meta.migration_notes).
- P unique _provenance entries minted.
- Q source_url: null markers added (publisher URL not recoverable as of
  2026-04-26 retrieval).

Validation:
- npm run typecheck && npm test && npm run validate && npm run ci:gates
  -> green.
- python3 scripts/validation/build_region_docs.py -> green; docs/validation
  diff inspected and confirms no regressions.
- python3 scripts/calibration/empirical_tier_bands.py -> green; output
  matches pre-migration baseline byte-for-byte (numeric fields read are
  unchanged).

Resolves council finding S1. Unblocks the S4 check_anchors.py validator
and the build_region_docs.py v2-rendering enhancement (queued separately).

Co-Authored-By: Gemini <noreply@google.com>
```

---

## 4. Pre-flight check (Simon, 5-minute review)

Before dispatching, confirm:

- [ ] `docs/proposals/anchor-schema-v2.md` is the current design (no in-flight edits to it).
- [ ] No other agent is concurrently touching `scripts/validation/external-anchors.json` (check open PRs).
- [ ] Gemini run-time budget is sized: ~2–3 hours of Gemini-CLI work for 124 regions × the lookup-and-mint loop, possibly more if many `source_url` resolutions require search.
- [ ] If S4's `check_anchors.py` is desired *before* this migration lands, dispatch S4 first. Otherwise GEMINI-3 lands first and S4 is a follow-up that finds an already-clean v2 file.

---

## 5. Out of scope (do not do, even if tempted)

- **Anchor history inside the JSON.** v3+. Git log handles history.
- **Anchor-level confidence weights.** v3+. Sci Data reviewers don't need this at this revision.
- **Inverse provenance lookup** (i.e. "what regions cite this source?"). Derivable via a one-shot `jq` query when needed.
- **Multi-language source titles.** Every `title` stays in the publisher's primary language.
- **Refactoring the JSON file's overall structure.** v2 is *additive* on top of v1.
- **Updating `docs/methodology/anchors.md`.** That post-migration writeup is reserved for Claude per `docs/proposals/2026-04-25-council-remediation-dispatch.md` §"Reserved for Claude".
- **Updating the paper draft (§4, §6).** Same — reserved for Claude after the migration lands.

---

## 6. Status table

| Step | Owner | Status |
|---|---|---|
| Schema v2 design | Claude | ✅ `docs/proposals/anchor-schema-v2.md` |
| GEMINI-3 dispatch brief | Claude | ✅ this file |
| Migration sweep | Gemini (GEMINI-3) | 🟡 ready to dispatch on Simon's go |
| `check_anchors.py` validator | Codex (S4) | queued — can land before or after GEMINI-3 |
| `build_region_docs.py` v2 rendering | Codex (S4) | queued — must land **after** GEMINI-3 |
| `docs/methodology/anchors.md` write-up extension | Claude | post-GEMINI-3 |
| Update paper §4 + §6 | Claude / Gemini | post-implementation |

---

## 7. If something goes wrong

- **Gemini stalls on URL resolution.** Acceptable. `source_url: null` + `needs_url: true` is the documented escape hatch. The PR can land with up to ~10 such markers without blocking; >10 should be raised in the PR description for triage.
- **Numeric integrity check fails.** Means a v1 ↔ v2 value disagreement was introduced. Fix the v2 entry to match v1 — never the other way around — and re-run.
- **`build_region_docs.py` regresses.** Means the migration accidentally touched a v1 field the renderer reads. Roll back the offending region(s) to v1-only with `migration_notes` documenting the cause; Claude takes over the renderer-fix as a separate task.
- **The v1 file changes mid-migration.** Rebase onto latest `v0-build` and re-validate. If the change adds new regions, those new regions enter the migration scope; if it modifies existing regions, those are conflict territory and need merge-by-hand.
- **A `provenance_id` collision is discovered.** Disambiguate via `<short-id>` per the v2 design's §"Provenance ID naming convention". If the collision reflects two genuinely different documents from the same publisher in the same year, both get distinct slugs.

---

## 8. Sources for this brief

- `docs/proposals/anchor-schema-v2.md` (the design).
- `docs/proposals/2026-04-25-council-remediation-dispatch.md` §GEMINI-3 (the original preview).
- `scripts/validation/external-anchors.json` (the file under migration; probed 2026-04-26 for shape + counts).
- `docs/methodology/anchors.md` (provenance taxonomy reference).
- `docs/proposals/2026-04-26-phase-2-6-static-promotions-dispatch.md` (format precedent for paste-ready Codex briefs).
