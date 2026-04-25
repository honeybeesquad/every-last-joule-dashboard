# Council remediation — Codex / Gemini / Claude dispatch briefs

Date: 2026-04-25 · Source: 5-agent council audit (Model QA, Reality Checker, Code Reviewer, Software Architect, Data Engineer) · Target: Scientific Data submission Nov 2026.

Each section below is **self-contained** — paste directly into a Codex or Gemini session. Do not re-summarise; the recipient agent has no context from this conversation.

---

## Phase 1 — fully parallel, dispatch all four immediately

### CODEX-1 / B1 — PT15M over-count fix in `totalTWh30d`

**Repo:** `/Users/simoncollins/code/every-last-joule-dashboard/`
**Branch:** create `fix/pt15m-totaltwh-overcount` from `v0-build`.

**Bug.** `src/lib/profile.ts` line 68 (`totalTWh30d` function) sums `mw` across all data points and divides by `1_000_000`. This treats each data point as a 1-hour MWh contribution. ENTSO-E A75 endpoints commonly return `PT15M` (15-minute) resolution — confirmed in `src/lib/entsoe.ts:41`. Summing 4 PT15M points (each ~MW for 15 minutes) as if they were 1-hour points overstates TWh by 4×. This affects every European zone in the dataset (most of `regions.ts` `tier:"live"` regions with `source` containing "ENTSO-E"). Discovered by Code Reviewer in council audit.

**Required fix.**
1. Inspect callers of `totalTWh30d`. Determine how each data point's interval is known (probably encoded in the upstream loader or implicit from `entsoe.ts` resolution parsing).
2. Modify `totalTWh30d` to accept (or derive) an interval-fraction-of-hour per point. PT15M points contribute `mw × 0.25` MWh; PT1H points contribute `mw × 1.0`.
3. Default to 1.0 for callers that don't pass resolution (preserves EIA/AEMO PT1H behaviour).
4. Update every ENTSO-E loader path to pass resolution through.

**Tests.**
- Add `tests/profile.test.ts` (or extend existing) with:
  - Same average MW for 4 PT15M points vs 1 PT1H point → equal TWh.
  - Regression test: a synthetic 30-day PT15M series at constant 1000 MW should integrate to 0.72 TWh, not 2.88 TWh.
- Re-run snapshot validator. Verify Germany / France / Spain TWh values decrease by ~75% (this IS the fix, not a regression).

**Constraint.**
- Do NOT touch `peakGW` or `timeOfDayAverageGW` — they're hourly-bucketed and unaffected by this bug.
- Do NOT modify EIA loaders (`src/data/ercot.json.ts`, `caiso.json.ts`, etc.) — they're PT1H native and would regress if forced through interval scaling without verifying their data contract.

**Done when.**
- `npm test` passes.
- `npm run build && npm run validate` passes.
- A diff of `data/snapshots/last-good/germany.json` (and a couple other ENTSO-E zones) shows `totalTWh` decreased ~75%.
- Commit message: `fix(profile): correct PT15M over-count in totalTWh30d (4× overstatement on ENTSO-E zones)`.

---

### CODEX-2 / S5 — `splitRegion` observedStdGW propagation

**Repo:** same.
**Branch:** create `fix/split-region-observed-std` from `v0-build`.

**Bug.** `src/index.md` lines 222–242 contain `splitRegion(parent, ...)` which preserves parent `confidenceTier` via spread but recomputes `uncertaintyLowGW`/`uncertaintyHighGW` via `computeBounds(newPeakGW, tier)` *without forwarding* `observedStdGW`. Today this is harmless because no caller passes `observedStdGW` (backfill σ not yet wired through). When historical-backfill σ activates, T1-parent split children (e.g. `north-sea` → `gb-scotland` + `gb-england-wales`, `denmark` → DK1+DK2) will silently fall back to ±15% defaults instead of inheriting the parent's empirical 2σ envelope. Discovered by Code Reviewer.

**Required fix.**
1. Modify `splitRegion` to forward `observedStdGW` (if present on parent) to `computeBounds`.
2. Scale proportionally: child gets `observedStdGW = parent.observedStdGW × (childPeakGW / parentPeakGW)` (preserves coefficient of variation).
3. Verify `computeBounds` actually accepts `observedStdGW` — if not, extend it.

**Tests.**
- Add a unit test where parent has `observedStdGW: 1.5`, peak 10 GW, two children at 6+4 GW. Assert child 1 has `observedStdGW: 0.9`, child 2 has `observedStdGW: 0.6`.
- Assert `uncertaintyHighGW` for each child reflects the empirical envelope (parent fraction), not the ±15% default.

**Done when.**
- Test passes.
- Commit message: `fix(splitRegion): propagate observedStdGW to children to preserve empirical envelope post-backfill`.

---

### CODEX-3 / N3 — misleading sourceNote on probe-success loaders

**Repo:** same.
**Branch:** `fix/probe-only-source-note` from `v0-build`.

**Bug.** `src/data/iran.json.ts` line ~14, `src/data/uae.json.ts` line ~14, `src/data/saudi-solar.json.ts` line ~14 each emit a `sourceNote` claiming "live feed unavailable" or equivalent — but each loader actually probes the upstream URL successfully and then `throw`s to flow into the typical-profile fallback regardless. The note misreads provenance for Scientific Data reviewers. Discovered by Code Reviewer.

**Required fix.** Replace the misleading note with honest phrasing in all three files. Suggested replacement text: `"No public hourly curtailment feed; calibration-anchor × typical-profile shape (T3-modelled, ±40% envelope)."` — adjust per region's actual anchor and shape.

**Constraint.** Do NOT change behaviour. Loader still routes to typical profile. Just fix the human-readable note.

**Done when.**
- All three loaders' `sourceNote` strings updated.
- `npm test` passes.
- Snapshot regen shows new note text in `data/snapshots/last-good/{iran,uae,saudi-solar}.json`.
- Commit message: `fix(loaders): correct misleading "live feed unavailable" note on probe-only T3 regions`.

---

### CODEX-4 / S2 — `sourceStatus: "degraded"` enum + `lastSuccessAt`

**Repo:** same.
**Branch:** `feat/source-status-degraded` from `v0-build`.

**Goal.** Today `sourceStatus` is binary `"live" | "cached"` per `src/lib/types.ts:41,80`. There's no `lastSuccessAt` field. `withFallback` (`src/lib/resilient.ts:78-119`) returns last-good silently on upstream failure — a stale cached payload renders as "cached" indefinitely with no staleness indicator. Discovered by Data Engineer + Software Architect.

**Required.**
1. Extend `SourceStatus` type in `src/lib/types.ts` from `"live" | "cached"` to `"live" | "cached" | "degraded"`.
2. Add `lastSuccessAt: string` (ISO-8601) field to `RegionData` (or wherever sourceStatus lives).
3. In `src/lib/resilient.ts::withFallback`, when serving a cached payload:
   - Always populate `lastSuccessAt` from the cache's own timestamp.
   - If `(now - lastSuccessAt) > STALENESS_THRESHOLD_HOURS` (default 24, configurable per loader), stamp `sourceStatus: "degraded"`. Otherwise `"cached"`.
4. Update `scripts/validate-snapshots.ts` (line ~111 area) to accept the new enum value and require `lastSuccessAt`.
5. Update tooltip / UI consumers if any read `sourceStatus` directly (search `grep -r 'sourceStatus' src/`).

**Tests.**
- `tests/resilient.test.ts`: simulated failure with a fresh cache → `"cached"`. Same with cache age > 24h → `"degraded"`.
- Snapshot validator regression: existing snapshots without `lastSuccessAt` should fail validation; populate them via a one-shot script if needed.

**Constraint.** Default staleness threshold should be permissive (24h) so existing cached snapshots don't all flip to degraded immediately. Document threshold choice in `docs/methodology/uncertainty.md` or `docs/data-source-log.md`.

**Done when.**
- All loaders compile under stricter type.
- `npm test` + `npm run validate` pass.
- Commit message: `feat(resilient): add "degraded" sourceStatus + lastSuccessAt for staleness disclosure`.

---

### GEMINI-1 / B2 + B3 + N1 (bundled doc sweep)

**Repo:** `/Users/simoncollins/code/every-last-joule-dashboard/`
**Branch:** create `docs/council-numeric-corrections` from `v0-build`.

You are correcting three numeric-framing errors across the documentation. **Doc-only changes — do NOT modify `src/`, `tests/`, `data/`, `dataset/`, or `scripts/`.** Source-of-truth values to substitute INTO the docs:

**B2 — Region count.** Authoritative count = **128** entries in `src/lib/regions.ts`. With backfill aggregates (NYISO + ISO-NE whole-ISO rows from `scripts/validation/build_region_docs.py:67-90`) total = **130**. Replace any claim of "~140 sub-regions", "140 regions", "approximately 140", "around 140", "140 sub-regions" with the appropriate accurate number.
- If context is the live dashboard → "128 regions"
- If context includes backfill ISO-aggregates → "130 regions (128 live + 2 backfill aggregates)"
- If context refers to the broader project scope → "128 sub-regions across ~50 countries"

**B3 — ENTSO-E zone count.** Authoritative count = **23** ENTSO-E zones. Verify by running `grep -c 'ENTSO-E' src/lib/regions.ts` (or read the file and count entries with `tier: "live"` and `source` containing "ENTSO-E"). Replace any claim of "ENTSO-E (12 zones)", "12 European zones", "12 ENTSO-E bidding zones", "12-zone ENTSO-E", or similar with "23 ENTSO-E zones".

**N1 — False ±20% T4 band.** Per `src/lib/uncertainty.ts:39-44` actual `TIER_DEFAULT_FRACTION` is `{T1:0.15, T2:0.20, T3:0.40, T4:0.0}`. T4 is **0%**, not ±20%, because T4-structural-gap regions are not emitted to the dashboard. Find any text claiming a "±20% T4-structural-gap band" or implying T4 has a non-zero envelope. Either:
- Replace with the corrected table (T1 ±15%, T2 ±20%, T3 ±40%, flare ±20%, T4 not emitted), or
- Strike T4 from the band table entirely if context permits.

**Files in scope (search these for matches; touch only what needs editing):**
- `README.md`
- `docs/paper/*.md` (all paper drafts)
- `docs/methodology/*.md`
- `docs/background/*.md`
- `docs/known-limitations.md`
- `docs/proposals/*.md` (existing ones, not this brief)
- `docs/data-source-log.md`
- `docs/validation/README.md` (the index, not per-region MDs)
- `dataset/SCHEMA.md`, `dataset/CHANGELOG.md` if they have such claims

**Constraints.**
- Do NOT touch per-region validation MDs (`docs/validation/<region>.md`) — those have hand-curated content.
- Do NOT change schema files in `dataset/schema/`.
- Group as **3 atomic commits**: one for B2 region-count, one for B3 ENTSO-E count, one for N1 T4-band correction. Each commit message should cite the council finding as the rationale (e.g. `docs: reconcile region count to 128 (council finding B2)`).
- If a passage mixes claims (e.g. talks about region count AND zone count in same paragraph) you may combine into one commit.

**Done when.**
- 3 commits land.
- `git grep -E '(140 (sub-)?regions|approximately 140|~140|12 ENTSO-E|12 European bidding zones)'` returns empty.
- `git grep -E 'T4.*±20|±20.*T4|T4.*structural-gap.*20'` returns empty.
- All other content unchanged (verify with `git diff --stat`).

---

### GEMINI-2 / S6 — Document T2 constant-rate assumption

**Repo:** same.
**Branch:** `docs/t2-constant-rate-disclosure` from `v0-build`.

**Goal.** Add explicit disclosure to `docs/methodology/uncertainty.md` (or whichever methodology doc covers T2) that T2-tier calibration applies a single static rate per region/PSR-type.

**Background.** Per `src/lib/entsoe.ts:167`, the application is `Math.max(0, point.mw * technology.rate)` — a uniform multiplier across the 30-day rolling window with no monthly weighting and no within-window time variation. Rate provenance is in-line with each rate in `src/data/entsoe.json.ts` (BNetzA 2024, REE 2024, IEEFA 2025, URE 2025, HAEE/IPTO 2025, Terna 2024, etc.). Council finding: methodology doc does not currently disclose that the rate is time-invariant; reviewers will want this stated.

**Required addition.** In the appropriate section of `docs/methodology/uncertainty.md` (under "T2 calibration" if such a heading exists, otherwise create one), add a paragraph along these lines (you may rephrase for tone):

> T2-tier calibration applies a single, time-invariant rate per region and per PSR-type, sourced from the regulator publications cited in `src/data/entsoe.json.ts` line-comments and summarised in `docs/methodology/entsoe-rates.md`. The rate is constant across the 30-day rolling window the dashboard surfaces — no monthly weighting, no seasonal adjustment, no within-window time variation. This is a known approximation: intra-year curtailment-rate concentration (for example, URE's 2024 Polish PV redispatch was heavily concentrated May–August) is not captured by the static rate. The ±20% T2 envelope is intended to absorb this drift; the rate itself is reviewed against TSO-published annuals in the per-region validation MDs (`docs/validation/<region>.md`).

**Constraint.** Single doc edit, one commit. Don't touch other files. Commit message: `docs(methodology): disclose T2 constant-rate assumption (council finding S6)`.

**Done when.** Paragraph lands in `docs/methodology/uncertainty.md`, no other file changes.

---

## Phase 2 — dispatch after Phase 1 lands

### CODEX-5 / S3 — End-to-end reproducer for one region

(Hold this brief until Phase 1 has landed; cross-references some of the cleaned-up plumbing.)

**Goal.** A `make reproduce-2024-ercot-west` Make target (or npm script) that, given `EIA_API_KEY` in env, regenerates `data/historical/backfill/eia_ercot-west_2024.parquet` from raw EIA hourly fuel-type API and confirms it matches the committed parquet within float tolerance.

**Why.** Scientific Data reviewers need to verify that a 2027 academic with API keys can rebuild any one parquet from raw inputs. Without this, the reproducibility claim is unverifiable.

**Required.**
1. Identify the existing backfill script (likely `scripts/backfill/eia/backfill_iso.py` per Data Engineer audit).
2. Wrap it in a Make target or `npm run reproduce:ercot-west` script that:
   - Calls the script for region=`ercot-west`, year=2024.
   - Compares output parquet to committed parquet using `pyarrow` (row-count + sum of `curtailment_gw` within 0.1% tolerance).
   - Exits 0 on match, non-zero on drift.
3. Document in a new section of `docs/paper/06-code-availability.md` (or create that file if absent).

**Done when.** Fresh clone + `EIA_API_KEY` env var + `make reproduce-2024-ercot-west` returns exit 0. Commit message: `feat(reproducer): add end-to-end ERCOT-West 2024 backfill reproducer (council finding S3)`.

---

### CODEX-6 / S4 implementation — CI tier-coherence + docs-drift

(Hold until Claude lands the design doc at `docs/proposals/ci-coherence-design.md`.)

**Goal (preview, design TBD).** Three CI checks:
1. **Tier-coherence:** parse `regions.ts`, run loaders against last-good cache, assert `regions.ts.tier` matches snapshot `confidenceTier` derivation.
2. **Tally golden:** commit `scripts/tally-tiers.ts` output as `tests/__golden__/tally-tiers.txt`; CI fails on diff.
3. **Docs-drift:** add `--check` mode to `scripts/validation/build_region_docs.py` that exits non-zero if regenerated content differs from committed `docs/validation/*.md` (excluding the `Last updated:` date line).

Implement against Claude's design (will land at `docs/proposals/ci-coherence-design.md` before this brief is ready).

---

### GEMINI-3 / S1 implementation — Anchor versioning repopulation

(Hold until Claude lands the v2 schema design at `docs/proposals/anchor-schema-v2.md`.)

**Goal (preview, design TBD).** Migrate `scripts/validation/external-anchors.json` from `_schema_version: 1` to v2 with per-anchor `release_id`, `release_url`, `retrieved_at`, `notes` fields. Across ~123 regions × ~1–4 anchors each.

Implement against Claude's design (will land at `docs/proposals/anchor-schema-v2.md` before this brief is ready).

---

## Phase 3 — Claude integrates + ships

After Phase 1 + 2 land:
1. Run full test + build + validate suite.
2. Regenerate figures (Figures 1, 2, 4 are sensitive to TWh values which change after B1).
3. Update paper draft figure captions if numbers shifted.
4. Final commit + push to `v0-build`.
5. Tag a Scientific-Data-readiness milestone.

---

## Reserved for Claude (do not dispatch)

| ID | Task | Output |
|---|---|---|
| B4 | Empirical T1 recalibration on 23 anchor pairs | `scripts/calibration/empirical_tier_bands.py` + `docs/methodology/uncertainty-recalibration.md` |
| B5 | ENTSO-E neighbour-anchored zone tier review | Decision doc + per-zone tier flips in `regions.ts` |
| S1 design | Anchor schema v2 | `docs/proposals/anchor-schema-v2.md` |
| S4 design | CI coherence architecture | `docs/proposals/ci-coherence-design.md` |
| N2 | Three-pillar taxonomy decision | `docs/methodology/taxonomy.md` |

These items require methodology judgment and shouldn't be delegated to Codex/Gemini.
