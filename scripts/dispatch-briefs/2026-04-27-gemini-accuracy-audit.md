# Brief: codebase accuracy cross-check audit

You are auditing a curtailment dashboard for **factual accuracy** — not code quality, not architecture, not style. Your job is to identify places where what the code/docs CLAIM doesn't match what the code/docs DO, or where cited numbers don't match published reference values, or where calibration rates are stale.

## Repository

Working directory: `/Users/simoncollins/code/worktrees/per-fuel-split`
Branch: `feat/per-fuel-region-split` (just forked from v0-build, no changes yet)

## What the project is

`every-last-joule-dashboard` — a Scientific Data journal submission (Nov 2026) that quantifies global renewable curtailment hourly across ~170 regions. The book companion is "Every Last Joule" by Simon Collins. Each region emits a `RegionData` object with a 24-value time-of-day GW profile, totalTWh (30-day rolling), sourceNote, and metadata.

## Audit scope — focus on these accuracy concerns

### 1. Calibration rates

Every loader applies a percentage rate to convert generation → curtailment (e.g., `× 4.25%`). Walk every `*.json.ts` file in `src/data/`. For each rate:

- Does the rate value have a documented source (CAISO daily reports, IRENA, Ember, GGFR, ENTSO-E)?
- Is the rate value current as of 2024-2025 publication years?
- Does the rate value match what's claimed in nearby code comments, sourceNote strings, and `docs/data-source-log.md`?

Examples of the pattern:
```typescript
const CURTAILMENT_RATE = 0.0425;  // CAISO 2024 ratio
```
vs the sourceNote saying "× 4.25% calibrated curtailment". Those two should agree, and the rate should match what's documented. Flag any drift.

### 2. fuelShare accuracy

Every region has a `fuelShare` field, either dynamically calculated (live loaders that observe the split) or statically asserted (static-region driver, typical-profile fallbacks). Walk these:

- `src/data/statics.json.ts` — every STATIC_REGIONS entry has a `kind` (solar/wind/hydro/mixed/flat/hydro-seasonal). Is the kind correct for that grid? E.g., does Iceland actually use `hydro-seasonal` (it does — geothermal+hydro), is Sichuan correctly tagged?
- `src/data/jordan.json.ts`, `src/data/morocco.json.ts`, etc. — assert static fuelShare ratios like "70% wind / 30% solar". Do these match each country's actual 2024 published mix?
- Static regions in `STATIC_REGIONS` array: each has a `twhAnnual` value. Do these match the source documents in their `sourceNote`?

### 3. sourceNote drift

For every region's sourceNote (live loaders + statics), check:

- Does the sourceNote describe what the code currently does, or has the code drifted? E.g., if a loader was changed from "× 4% rate" to "× 5% rate" but the sourceNote still says 4%.
- Does the sourceNote cite a source (e.g., "Ember Yearbook 2024" or "GGFR Tracker 2025")? If yes, is the citation real and current?
- Are there sourceNotes that are placeholders, TODOs, or vague ("estimated" without basis)?

### 4. known-limitations.md and numerical claims

Read `docs/known-limitations.md`. For every cited number, TWh value, percentage, or region count:

- Cross-reference against current code/data. E.g., if §16 says "16 LatAm regions added totaling 2.9 TWh", does the code actually have 16 LatAm regions and do they sum to 2.9 TWh?
- Does the document have stale references to old phases (Phase-2.5, Phase-2.6) that no longer match current state (Phase-2.7)?

### 5. Region tier assignments

Read `src/lib/regions.ts`. Each region has a `tier` field (`live`, `static`, `t1c-live`, etc.). For each region:

- Does its tier match the loader's actual capability? E.g., is something tagged `live` but actually emits a static or typical profile?
- Are tier-counts.json (`scripts/ci/golden/tier-counts.json`) golden values consistent with actual region tiers?

### 6. Lat/lon accuracy

Spot-check the more recently added regions (Africa Pattern-D 26 regions, LatAm Pattern-D 16 regions) — coordinates in `src/lib/regions.ts`:

- Do the lat/lon values place the region in its actual country?
- For per-fuel splits we'll be adding (caiso-solar at Mojave, caiso-wind at Tehachapi, etc.), what would correct centroids look like? Don't fix this; just flag any current mis-placements.

### 7. Test coverage

Walk `tests/data/*.test.ts`. For each loader:

- Does the test exist? Is it a real test (asserts behavior) or a stub?
- Are there loaders in `src/data/` with NO matching test in `tests/data/`?

### 8. CI gates

Read `scripts/ci/` directory. The gates are:
- `tier-coherence` — checks tier vs source consistency
- `tally-golden` — checks region count matches golden file
- `docs-drift` — checks docs match code

For each gate, is the underlying check meaningful (compares real things) or has it been weakened over time (e.g., loosened threshold, skipped checks)?

## Output format

Write a single markdown audit report. Structure it as:

```
# Accuracy audit — 2026-04-27

## Summary
- N issues found total
- Severity: P0=N (factually wrong), P1=N (drift/stale), P2=N (cosmetic)
- Files touched: M

## P0 — factually wrong claims
[one bullet per finding, with file:line, what the claim is, what the truth is, suggested fix]

## P1 — drift / stale
[same format]

## P2 — cosmetic / nit
[same format]

## Recommended priority order to fix
1. ...
2. ...
```

Save the report to `docs/audits/2026-04-27-accuracy-cross-check.md` in the working directory. Commit it on branch `feat/per-fuel-region-split` with message:

```
audit(accuracy): Gemini cross-check of calibration rates, fuelShares, sourceNotes, and tier assignments

Co-Authored-By: Gemini 2.5 Pro <noreply@google.com>
```

DO NOT modify any code. DO NOT modify the data files. DO NOT modify the loaders. ONLY produce the audit report.

## Hard constraints

- Cite file paths with line numbers. Vague findings ("the rates seem off") are not useful.
- For every claimed inaccuracy, name the source you'd use to verify (Ember 2024, IRENA stats, IEA, the loader's own cited reference). If you can't name a source, mark P2 cosmetic.
- Never speculate. If you don't have access to a published value to compare against, mark the finding as "needs human verification" and explain what would be needed.
- Don't audit for code style, tests-as-spec, or architectural decisions. Just factual accuracy.

When done, print the report path and commit SHA to stdout.
