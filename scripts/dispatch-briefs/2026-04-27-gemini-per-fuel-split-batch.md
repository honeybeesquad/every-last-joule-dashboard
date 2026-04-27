# Brief: per-fuel split for 4 remaining blended loaders (Pattern-PF)

You are extending the **canonical Pattern-PF (per-fuel split)** that was locked in by PR #19. Two reference commits already on the `feat/per-fuel-region-split` branch:

- `ff8eee4` — caiso → caiso-solar + caiso-wind (canonical reference)
- `4fb2a96` — belgium → belgium-solar + belgium-wind (Pattern-PF applied to a loader with separate-URL fetches)

Pattern-PF replaces a single blended `regionId` (e.g. `caiso`) with two distinct RegionData records (`<region>-solar` + `<region>-wind`) at separate geographic centroids, each with its own calibration rate, hard-set `fuelShare`, and dedicated sourceNote.

## Why this matters (read once, internalise)

The v0 dashboard had a bug Simon reported: California's solar curtailment didn't disappear at California night because the loader summed solar+wind generation, multiplied by one rate, and emitted under one regionId. Wind blowing overnight left a non-zero floor under what the dashboard rendered as "solar". Per-fuel split fixes this for every region.

## Repository

Working directory: `/Users/simoncollins/code/worktrees/per-fuel-split`
Branch: `feat/per-fuel-region-split` (PR #19 open against v0-build)
Canonical references:
- `src/data/caiso.json.ts` + `tests/data/caiso.test.ts` (live API loader pattern)
- `src/data/belgium.json.ts` + `tests/data/belgium.test.ts` (separate-URL fetch pattern)
- `scripts/bootstrap-caiso-snapshot.ts` and `scripts/bootstrap-belgium-snapshot.ts` (bootstrap snapshot pattern)

## Target loaders (4 of them — small, focused commits)

NOTE: belgium has already been completed in commit `4fb2a96`. Do NOT re-do belgium. Apply Pattern-PF to the 4 remaining loaders below, in the order shown.

For each loader below, do the work as **its own commit** so PR review is per-loader.

### 1. denmark
- Source file: `src/data/denmark.json.ts`
- Existing data already separates `WIND_COLUMNS` and `SOLAR_COLUMNS` (Energinet)
- New regionIds: `denmark-east-solar`, `denmark-east-wind` (or just `denmark-solar` / `denmark-wind` if the existing record represents the whole country)
- Centroids: solar → roughly Zealand/Copenhagen area (55.7°N, 12.5°E); wind → Jutland west coast (56.3°N, 8.5°E)
- Calibration: keep the existing 4% blended rate for now if no per-fuel evidence exists; document this in sourceNote

### 2. north-sea
- Source file: `src/data/north-sea.json.ts`
- Existing data already separates by `psrType` (Wind Onshore / Wind Offshore / Solar)
- New regionIds: `gb-offshore-wind` (rename existing north-sea), plus `gb-offshore-solar` is irrelevant — UK offshore is wind-dominated. Solar would be UK onshore. Talk to Simon if unsure; **default to solar+wind split with two records, but use sensible UK centroids:**
  - wind centroid: 54.0°N, 1.0°E (North Sea offshore)
  - solar centroid: 51.5°N, -1.0°W (UK central, where solar farms cluster)
- Note the existing `KNOWN_AGGREGATE_IDS` allow-list entry `north-sea` — keep it and leave the legacy snapshot alone for the bootstrap

### 3. france
- Source file: `src/data/france.json.ts`
- RTE eco2mix CSV has `eolien_terrestre`, `eolien_offshore`, `solaire` columns
- New regionIds: `france-solar`, `france-wind`
- Centroids: solar → southern France (43.6°N, 3.8°E, near Montpellier); wind → northern France (50.1°N, 1.7°E, Picardy/Hauts-de-France)
- Calibration: existing 3%; split per-fuel later if evidence available

### 4. alberta
- Source file: `src/data/alberta.json.ts`
- AESO CSD report HTML has separate WIND and SOLAR `<TR>` rows
- New regionIds: `alberta-solar`, `alberta-wind`
- Centroids: solar → southern Alberta (50.0°N, -110.5°W, Medicine Hat); wind → Pincher Creek (49.5°N, -114.0°W) for southwest wind farms
- Calibration: existing 5% blended; document non-per-fuel split in sourceNote

## Pattern-PF requirements (apply to ALL 5)

Read `src/data/caiso.json.ts` (just merged) and copy the structure exactly:

1. **Loader emits Record<string, RegionData>** with both keys, NOT a single RegionData.
2. **Hard-set `fuelShare`** per record:
   - solar record: `{ solar: 1, wind: 0 }`
   - wind record: `{ solar: 0, wind: 1 }`
3. **Distinct centroids** in `src/lib/regions.ts` (use the lat/lon hints above; check Wikipedia for actual wind-farm or solar-farm cluster centroids if unsure)
4. **Distinct sourceNote** per record clearly identifying solar-only or wind-only data lineage
5. **Update `src/index.md`**: change `<region>,` to `...<region>,` to spread the Record into `regionData`
6. **Update test file** `tests/data/<region>.test.ts`: assert per-fuel shape, hard-set fuelShare, solar-near-zero-overnight (if applicable), totalTWh per fuel
7. **Update `tests/regions.test.ts`**: increment T1a count by 1 per region (4 loaders × +1 = +4). Current state after caiso + belgium: T1a=65, total=172. After all 4 land: T1a=69, total=176.
8. **Update `scripts/ci/golden/tier-counts.json`**: T1a += 1 per loader, total += 1 per loader. Current state: T1a=65, total=172.
9. **Update `docs/validation/`**: regenerate via `python3 scripts/validation/build_region_docs.py`, delete stale `<region>.md` files
10. **Bootstrap last-good snapshot**: write a script like `scripts/bootstrap-caiso-snapshot.ts` that uses test fixtures + parseFn to produce `data/snapshots/last-good/<region>.json` with the new shape, sourceNote tagged BOOTSTRAP

## Verification (each loader)

Per-loader before commit:
```bash
cd /Users/simoncollins/code/worktrees/per-fuel-split
npm run typecheck
npm test -- tests/data/<region>.test.ts tests/regions.test.ts
npm run ci:gates
```

All four must pass. Commit message format:
```
feat(<region>): per-fuel split <region> → <region>-solar + <region>-wind

[explanation similar to caiso commit body]

Tier model net change: T1a +1, total +1.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
```

## Order of work

Easiest → hardest:
1. denmark (column-level separation, easy split)
2. france (CSV column separation, easy)
3. north-sea (psrType separation, but UK geography is tricky)
4. alberta (HTML scrape, smallest data, easy)

Push each commit individually to the existing PR #19 — do NOT open new PRs.

## What NOT to do

- Don't change the 4 (d)-class loaders (ercot, ontario, wa-swis, south-africa, peru) on this branch — those are queued for a separate batch.
- Don't touch the methodology rewrite or link audit — those are queued separately.
- Don't synthesize wind/solar data ratios that aren't in the source. Use measured separation.
- Don't merge before tests/CI green.
- Don't break the existing `KNOWN_AGGREGATE_IDS` allow-list entries — those are deliberate for legacy fallback paths.

## Output expectation

Four commits on `feat/per-fuel-region-split`, each one self-contained, each with its own Pattern-PF migration, each with passing tests + CI gates. Push to origin. Don't open new PRs — the existing PR #19 will absorb these commits.

## Critical pitfalls to avoid (from belgium debrief)

1. When you finish editing a `.json.ts` file, **always run `npm run typecheck` before commit** — easy to drop a closing brace at EOF.
2. When importing `BelgiumOutput`-style interfaces in tests/bootstrap scripts, use `import { ..., type FooOutput }` — verbatimModuleSyntax requires the `type` keyword.
3. `buildPerFuelRegion` should be **exported** (not just declared) so the bootstrap script can call it.
4. Tests should call `parseFn` + `buildPerFuelRegion` directly with mock CSV strings — do NOT use `vi.mock` to wrap `fetchText`. Simpler is better.
5. After regenerating validation docs with `python3 scripts/validation/build_region_docs.py`, **manually delete the legacy `<region>.md`** (e.g. `denmark.md`) — the script doesn't know to remove it.
6. Update **both** count assertions in `tests/regions.test.ts` — there's `expect(REGIONS.length).toBe(N)` AND `expect(liveTotal).toBe(M)`. Both need bumping. Also update `expect(REGIONS.find(r => r.id === "denmark")).toBeDefined()` style assertions to test for `denmark-solar`/`denmark-wind` instead.
