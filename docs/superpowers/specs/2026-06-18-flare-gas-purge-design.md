# Spec: Purge flare gas from site + dataset

**Date:** 2026-06-18
**Status:** Design — awaiting plan
**Owner decision:** Simon (repo owner)

## Decision & context

Flare gas is removed from the canonical dataset and the live site. The owner has
decided flare is a holdover from an earlier concept that does not fit the
dashboard narrative; the product is renewables-only going forward.

This **reverses** the previously-parked decision (recorded in `STATUS.md` and the
`project-renewables-only-variant` memory) that flare must stay on `main` and a
renewables-only build be a *separate* product. That decision is now superseded:
flare is purged from `main` itself. The parked PRs #153 (`codex/remove-flare-gas`)
and #237 (`remove-flare`) are reference-only; this work is done clean on a fresh
branch, not built on either (both carry unrelated regen churn).

## Scope

**In scope (this PR):**
- Region database: delete the 37 `kind: "flare"` records.
- Type system + colour logic: `types.ts`, `fuel.ts`, `pillar-layout.ts`, `uncertainty.ts`.
- Dashboard UI: `index.md` (toggle, footnote, readout, GW calc), `globe.js`, `region-tooltip.js`, `timeline.js`, `style.css`, `embed/globe.md`.
- Static anchors: `statics.json.ts` (flare anchors only).
- CI gates + golden + tests: `tier-counts.json`, the 4 `scripts/ci/check-*` gates, `tier-resolution.ts`, and the affected vitest suites.
- Validation docs: delete the ~37 flare region docs; flare snapshots under `data/snapshots/last-good/`.
- Dataset: `schema/region-snapshot.schema.json`, `SCHEMA.md`, `README.md`, `FAIR.md` (remove flare from enums/counts/prose); regenerate exports.
- Minimal prose consistency: trim flare from `about.md` and `methodology.md` where they describe the live data taxonomy (a `kind` that will no longer exist).
- `STATUS.md`: record the reversal + new counts (per the STATUS update protocol).
- `dataset/CHANGELOG.md`: note flare removed going forward.

**Deferred (separate follow-ups, explicitly NOT this PR):**
- Academic paper reframe: `docs/paper/`, `docs/dari/` drafts, and `src/paper.md`'s
  full narrative. The paper leads with the flare-dominant headline and needs an
  editorial reframe, owner-steered.
- Cutting a new flare-free **Zenodo dataset version** (v1.4.0). The published
  v1.3.2 DOI contains flare and is immutable; the next release ships flare-free.

## Consequence (owner-accepted)

- **Site headline is unaffected.** The "% of Bitcoin" headline is already
  renewables-only; flare was shown as an *excluded* footnote ("excluded from the
  headline ratio") with its own toggle. Removing flare removes the footnote + toggle,
  not the headline number.
- **Paper framing breaks (deferred).** The paper's flagship "verified total
  293.7 TWh = 149% of Bitcoin, 53% flare / 47% renewables" no longer holds;
  renewables-only ≈ 138 TWh ≈ 70% of Bitcoin. Until the deferred paper reframe,
  `docs/paper/` + `src/paper.md` are knowingly inconsistent with the live site.

## Key technical notes

- **`iraq-mainland.json.ts` is KEPT** — it is a *solar* loader (Karbala/Dhi Qar PV),
  explicitly "separate from flare region". Only its sourceNote's flare reference is trimmed.
- **`"flat"` ProfileKind is KEPT** in `statics.json.ts` — hydro/geo regions also use it.
  Remove only the flare anchor entries and update the comments.
- **`fuel.ts` is the load-bearing change:** remove the `--data-flare` token, the
  `Fuel | "flare"` signature widening, and the three `kind === "flare"` short-circuits
  (`getRegionFuelColor`, `isRenewable`, the bucket function). `RegionKind` loses `"flare"`,
  so `tsc` will surface every remaining consumer — use that as the completeness check.
- **Counts:** 37 flare regions removed → total **467 → 430**. The golden `T2-flare`
  bucket is deleted; regenerate `tier-counts.json` via `npm run tally:tiers` and update
  `tests/regions.test.ts` golden assertions in the same commit.

## Verification (all green before PR)

1. `npx tsc --noEmit` — the `RegionKind` narrowing flushes out missed consumers.
2. `npm test` — full vitest suite (update flare-touching suites: `regions`, `fuel-color`,
   `statics`, `africa-pattern-d`, `latam-pattern-d`).
3. `npm run ci:gates` — validate, tier-coherence, tally-golden, docs-drift,
   magnitude, provenance.
4. Preview build renders; globe shows no flare pillars, no toggle, no console errors.
5. **Completeness grep:** `git grep -i flare -- src/ scripts/ tests/ dataset/` returns
   only intentional residue (preserved `version-history.csv` rows + the CHANGELOG note);
   no live code/UI/gate references remain.

## Out of scope / follow-ups (tracked, not done here)

- Paper reframe (`docs/paper/`, `docs/dari/`, `src/paper.md`) — owner-steered.
- Zenodo v1.4.0 flare-free release.
- `version-history.csv` historical rows are **preserved** (they accurately record
  what each published version shipped); only a CHANGELOG note is added.
