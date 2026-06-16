# Design — region↔wiring CI gate (catch blank-globe deploys before they ship)

**Date:** 2026-06-08
**Status:** APPROVED (brainstorm) — pending spec review → implementation plan
**Author:** AI session (Opus design; Sonnet to execute)
**Scope decision:** CI gate only (graceful runtime degradation and the loader-hang fix were considered and explicitly deferred — see Out of Scope).

## Context — the bug this prevents

The globe mount is gated by an all-or-nothing assertion in `src/index.md`:

```js
assertCanonicalRegionData(regionData, REGIONS);   // throws if ANY region lacks valid data
```

It runs **before** `mountGlobe`, so if a single region in `regions.ts` has no entry in the
assembled `regionData`, the assertion throws, the page-init code after it never runs, the
loading terminal never clears, and **every pillar disappears** — a fully blank/stuck globe.

This happened in production: `new-zealand-hydro` was added to `regions.ts` in **#119** but its
data loader + wiring only landed in **#128**. In the `#119 → #128` window the deployed site was
blank. #128 fixed it; production is healthy now (verified 2026-06-08: mounts in ~0.5 s, 385/385
integrity pass).

**Root-cause class:** the only check that every `regions.ts` region is wired to data is
`assertCanonicalRegionData`, which runs **at runtime in the browser** — i.e. *after* the blank
build is already deployed. There is no build-time/CI guard, so a region added without wiring
passes every existing gate and ships blank. CI deliberately does **not** run `observable build`
(ci.yml:36-39 — avoids flaky live-data pulls), so the runtime assertion is the first time the
mismatch is ever evaluated.

## Goal

Move that check **left**, to CI, so a `regions.ts`↔wiring mismatch fails the PR/build instead of
silently deploying a blank globe. No network, consistent with CI's no-live-data rule.

## Approach (chosen: A)

**A — Extract the assembly into a shared pure function + snapshot-based CI gate.**
Move the `regionData` assembly literal out of `index.md` into one pure function that both the
page and the gate import. The gate reconstructs `regionData` offline and runs the existing
`findRegionDataIntegrityIssues`. Single source of truth; the gate tests the *real* wiring.

Prototype already validated: a throwaway script reconstructed live-production `regionData` from the
exact `index.md` literal and `findRegionDataIntegrityIssues` returned 385/385, 0 issues. So the
extraction is mechanical and the gate logic is proven.

**Rejected:**
- **B — gate as a vitest test instead of a `ci:` script.** Lighter, but not in the named
  `ci:gates` family (`tier-coherence`/`docs-drift`/`tally-golden`) and less reviewer-visible.
  (A small vitest for the extracted function is still welcome — see Testing — but the *gate*
  is a `ci:` script.)
- **C — standalone gate that re-derives expected keys without touching `index.md`.** Lowest risk
  to the page but duplicates the assembly, which then drifts from `index.md` — defeats the purpose.

## Components

### 1. `src/lib/assemble-region-data.ts` (new) — single source of truth

A pure function holding the exact object literal currently inlined at `index.md:310–538`:

```ts
import { splitRegion } from "./split-region.js";
import type { RegionData } from "./types.js";

export interface LoadedRegionSources { [loaderVar: string]: unknown }

export function assembleRegionData(loaded: LoadedRegionSources): Record<string, RegionData> {
  const {
    ercot, caiso, miso, pjm, spp, nyiso, isoNe, bpa, aemo, belgium, entsoe, france, denmark,
    turkey, northSea, brazilNE, norway, ontario, alberta, ireland, peru, southAfrica,
    newZealand, newZealandHydro, atacama, chileWind, /* …all loader vars the literal uses… */
    statics, philippines, florida,
  } = loaded as any;

  return {
    /* EXACT literal moved from index.md:310–538, unchanged */
  };
}
```

- Pure, no I/O — fully testable, holdable in one context.
- Imports `splitRegion` (already used by the literal). The Denmark `fuelShare` IIFE, the spreads
  (`...statics`, `...philippines`, `...aemo`, …) and key precedence/order are preserved **byte-for-byte**.
- It only destructures the loader vars the literal actually references; `cbeci`, `anchor`,
  `zenodoVersion`, `countries-110m` are **not** inputs (the literal never uses them).

### 2. `src/index.md` — call the shared function

Replace the 230-line inline literal (lines 310–538) with:

```js
const regionData = assembleRegionData({
  ercot, caiso, miso, pjm, spp, nyiso, isoNe, bpa, aemo, belgium, entsoe, france, denmark,
  turkey, northSea, brazilNE, norway, ontario, alberta, ireland, peru, southAfrica,
  newZealand, newZealandHydro, atacama, chileWind, /* …all loader vars… */
  statics, philippines, florida,
});
```

(object shorthand of the already-destructured `Promise.all` vars). Add the import. Behaviour is
identical; `assertCanonicalRegionData(regionData, REGIONS)` stays immediately after as the runtime
backstop. The `maskSolarNight` and `applyUncertainty` post-processing loops are untouched.

### 3. `scripts/ci/check-region-wiring.ts` (new) — the gate

Offline reconstruction → integrity diff → exit code. Productionizes the validated prototype.

Two data sources for the `loaded` object (CI has no network):

| Source | Loaders | How |
| --- | --- | --- |
| Committed snapshot | the 106 live/fallback loaders | `JSON.parse(readFileSync("data/snapshots/last-good/<file>.json"))` |
| Deterministic builder | `statics`, `florida`, `philippines` (no live fetch → never snapshotted) | import + call `buildAllStatics()`, `buildFloridaData()`, `buildPhilippinesData()` |

The 3 builders are called with **no args**, matching each loader's `isMain` path exactly
(`statics.json.ts:403`, `florida.json.ts:23`, `philippines.json.ts:71`).

Algorithm:
1. **Pre-flight:** for every loader in `LOADER_SNAPSHOT_MAP`, assert the snapshot file exists.
   A missing snapshot → exit 1 with a clear message (`no snapshot for <loader>; gate cannot verify`)
   rather than a downstream `TypeError`. Fail loud, never silent.
2. Build `loaded` from snapshots + the 3 builders.
3. `const regionData = assembleRegionData(loaded)`.
4. `const issues = findRegionDataIntegrityIssues(regionData, REGIONS)`.
5. Print a reviewer-friendly report; **exit 1** if any of `missing` / `extra` / `malformed` is
   non-empty, else exit 0 with a one-line pass summary (`region-wiring OK: 385/385`).

`LOADER_SNAPSHOT_MAP` (camelCase loader var → snapshot filename) is the same proven mapping from
the prototype. It is fail-safe: any drift (loader in the assembly but missing from the map) makes
its keys absent → reported as `missing` → gate fails. Drift can never produce a false pass.

### 4. Wiring

- `package.json`: add `"ci:region-wiring": "tsx scripts/ci/check-region-wiring.ts"` and chain it
  into the existing `ci:gates` script.
- `.github/workflows/ci.yml`: add a step `Region wiring (regions.ts ↔ assembled regionData)`
  alongside tier-coherence / docs-drift. No `observable build`.

## Data flow

```
regions.ts (canonical REGIONS)
        │
        ▼
check-region-wiring.ts ── loaded ←── 106 committed snapshots
        │                         └── buildAllStatics() / buildFloridaData() / buildPhilippinesData()
        ▼
assembleRegionData(loaded)         ← the SAME function index.md uses at runtime
        ▼
findRegionDataIntegrityIssues(regionData, REGIONS)
        ▼
   missing / extra / malformed → exit 1 (fail PR)   |   none → exit 0
```

## Error handling / failure modes

- **Region in `regions.ts`, not wired** (the #119 bug) → `missing` non-empty → exit 1, names the region.
- **Wired key not in `regions.ts`** → `extra` non-empty → exit 1.
- **A loader's snapshot present but lacking a valid 24-element profile for a region** → `malformed` → exit 1.
- **Required snapshot file absent** → pre-flight exit 1 with explicit message (not a TypeError).
- **Builder throws** → uncaught → non-zero exit (loud), surfaces the broken deterministic loader.

## Testing

1. **Positive (current `main`):** gate exits 0 with `385/385` on the committed tree.
2. **Negative:** temporarily delete one wiring line from `assembleRegionData` (e.g. `philippines`)
   and confirm the gate exits 1 naming the now-missing region(s). Revert.
3. **Refactor safety — behaviour unchanged:** after extraction, run `npm run dev`, confirm the
   globe still mounts and renders pillars (headline %, hotspots populated) — proves the literal
   move didn't change the assembly. (Prototype already showed the literal reconstructs 385/385.)
4. **Optional unit test** `tests/assemble-region-data.test.ts`: feed a small fixture `loaded` and
   assert representative keys (`germany-wind`, `brazil-bahia-wind`, `new-zealand-hydro`,
   `philippines-solar`) are produced — locks the extraction.
5. `npm run typecheck` and the full `npm test` stay green.

## Risks & mitigations

- **Extracting the live assembly from `index.md`** is the one sensitive change. Mitigation: it is a
  mechanical move (literal → function body; shorthand pass-through of the same vars), verified three
  ways — local globe still renders, the new gate passes 385/385, and the prototype already proved
  the exact literal reconstructs the full region set. Keep the move byte-identical; do not "tidy"
  the literal in the same change.
- **`LOADER_SNAPSHOT_MAP` drift** → fail-safe (causes a loud `missing` failure, never a silent pass).
- **Builder defaults drifting from loader main path** → low; builders take no args and the gate
  mirrors the `isMain` calls exactly.

## Out of scope (deferred, by decision)

- **Graceful runtime degradation** of `assertCanonicalRegionData` (render valid regions, report the
  bad one) — would change the deliberate fail-loud behaviour; not needed once the gate blocks deploys.
- **Loader-hang resilience** (the all-or-nothing `await Promise.all` over 112 loaders; one slow
  loader like `zenodo-version` blanks the globe for up to ~2 min in dev). Separate fragility, tracked
  as a follow-up, not part of this change.

## File change summary

| File | Change |
| --- | --- |
| `src/lib/assemble-region-data.ts` | **new** — `assembleRegionData(loaded)`, the moved literal |
| `src/index.md` | replace inline literal (310–538) with a call to `assembleRegionData(...)`; add import |
| `scripts/ci/check-region-wiring.ts` | **new** — the gate (snapshots + 3 builders → integrity diff → exit code) |
| `package.json` | add `ci:region-wiring`; chain into `ci:gates` |
| `.github/workflows/ci.yml` | add a `Region wiring` step |
| `tests/assemble-region-data.test.ts` | **new, optional** — unit test for the extracted function |
