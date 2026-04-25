# B4 decision record — Option B (T1 subdivision into T1a/T1b/T1c)

Date: 2026-04-25 · Owner: Simon (decision) + Claude (record + spec) · Triggered by: B4 empirical recalibration analysis (commit `8c28e0f`).

## The decision

**Option B is selected.** T1 is subdivided into three confidence sub-tiers
(T1a, T1b, T1c) reflecting the rate-derivation provenance, each with an
empirically-derived envelope.

Options A (keep ±15% with a bias paragraph) and C (collapse to ±25%
globally) are explicitly rejected. They are not maintained as fallbacks;
this document is the single source of truth for how the post-B1 paper
sweep frames T1.

## Why Option B

1. **Methodological honesty.** The empirical analysis surfaced
   heterogeneity in the T1 cohort that a single envelope hides. Option A
   buries that heterogeneity in a §4 paragraph; Option C over-penalises
   the well-calibrated zones. Option B publishes what we measured.
2. **Front-loaded cost beats long-tail risk.** The ~4-hour rewrite is
   one-time; reviewer questions about hidden bias are recurring.
3. **CI coherence machinery makes the sweep cheap to maintain.** The
   tier-coherence + tally-golden + docs-drift checks specified in
   `ci-coherence-design.md` (S4 / CODEX-6) keep the new tier set in sync
   across `regions.ts`, snapshots, and per-region validation MDs without
   manual reconciliation.
4. **The neighbour-anchored zone class is real.** Switzerland anchored to
   the Czech rate and Italian sub-zones anchored to peninsular rates were
   always a different epistemic category from ercot-east/west and
   Poland; the recalibration analysis only confirmed it.

## The three sub-tiers

| Tier | Rate derivation | Predicted envelope | Examples |
|---|---|---|---|
| **T1a-live-tso** | TSO publishes both the hourly dispatch-down series AND its own jurisdictional calibration rate | **±15%** (validated by post-B1 re-run) | ercot-east, ercot-west, poland, germany (own-EEG-share), uk-na (Elexon) |
| **T1b-live-domestic-anchored** | TSO publishes hourly; calibration rate sourced from a domestic statistical agency or regulator filing in the same jurisdiction | **±20–25%** (TBD post-B1 re-run) | iberia (REE 10.6 TWh figure), most ENTSO-E-zone-with-own-anchor cases |
| **T1c-live-neighbour-anchored** | TSO publishes hourly; calibration rate is *extrapolated from a neighbouring zone* because the home jurisdiction publishes none | **±30–40%** (TBD post-B1 re-run; sized to observed residual) | Switzerland (Czech rate), Italy splits (Centre-North, Sicily, Sardinia — peninsular rate), possibly Greece, possibly small ENTSO-E zones |

T1a, T1b, T1c are confidence-tier labels for the paper and validation
docs. In `regions.ts` they map to `tier` enum values:

| `confidenceTier` | `regions.ts.tier` |
|---|---|
| `live-tso` (T1a) | `live` |
| `live-domestic-anchored` (T1b) | `live-domestic-anchored` (NEW) |
| `live-neighbour-anchored` (T1c) | `live-neighbour-anchored` (NEW) |

Today the codebase has only `tier: "live"` — both new values are
additive, no existing entry breaks during migration.

## T1c population — code-grounded findings

A 2026-04-25 verification scan of `src/data/entsoe.json.ts` against
`src/lib/regions.ts` revealed that the earlier-draft "predicted T1c
population" table (Switzerland + Italy zones + Greece + possibly Norway
splits) was based on the B4 worst-offender residuals, not on actual
rate-derivation method. This matters because T1c is a *method*
classification (rate is extrapolated from a neighbour), not a *residual*
classification. Restating with code evidence:

### Confirmed T1c (rate is explicitly neighbour-extrapolated)

| Zone | Code evidence |
|---|---|
| `switzerland` | Comment in `entsoe.json.ts:172-173`: "Conservative rate anchored to Czech/Hungarian neighbours; Tier 1.2 audit to refine." Single solar tech at rate 0.015. **Definitively T1c.** |

### Possibly T1c (regional-proxy or aggregate-derived rate; needs review)

| Zone | Code evidence | Disposition |
|---|---|---|
| `baltics` | sourceNote: "Litgrid wind-only Baltic regional proxy". Single domain (Lithuania) used to represent Estonia + Latvia + Lithuania. | **T1c candidate** — the rate is a regional proxy, not a per-jurisdiction calibration. Confirm post-B1. |

### Confirmed T1a or T1b (own-jurisdiction or own-TSO rate)

The following zones I'd previously flagged as potential T1c are actually
own-jurisdiction-anchored:

| Zone | Actual rate provenance | Likely tier |
|---|---|---|
| `greece` | HAEE/IPTO 2024 official 860 GWh figure | T1a (own-TSO/regulator) |
| `italy-north-zone`, `italy-south`, `italy-sardinia` | Terna 2024 0.31 TWh national anchor distributed by modelled percentage shares (~35% / ~45% / ~20%) | T1b candidate — own anchor with modelled distribution; the *distribution* introduces uncertainty even though the *rate source* is own-jurisdiction |
| `norway-no3`, `norway-no4` | ENTSO-E own-hydro+wind data; large pre-B1 residuals were the PT15M overcount bug | T1a post-B1 (predicted to collapse near 0%) |

### Predicted-but-not-actually-existing zones

The earlier draft referenced `italy-centre-north` and `italy-sicily`.
These zone IDs do not exist in `regions.ts` — Italy is split into
`italy-north-zone`, `italy-south`, `italy-sardinia` only. Earlier text
corrected.

### Implications for the CODEX-7 dispatch

1. **T1c may have only ONE confirmed member** (Switzerland), with one
   candidate (Baltics) pending review. This is much narrower than the
   earlier "~6 zones" estimate.
2. **T1b is the more interesting category post-B1**: zones whose own-rate
   calibration produces residuals in the ±15–25% band due to scope
   mismatch, modelled distribution, or rate-coverage gaps. Italy splits
   are the leading T1b candidates per code evidence.
3. **The post-B1 B4 rerun's job** is now narrower: confirm
   Switzerland's residual, classify Baltics, and identify any T1b zones
   from the residual-vs-rate-source cross-tabulation.
4. **Final T1c set is locked** when Claude reruns
   `empirical_tier_bands.py` AND cross-references each high-residual
   zone's rate provenance against the loader source code (the join is
   manual; not a one-line script).

### Should we still subdivide if T1c is just one zone?

Yes. The methodological case for the subdivision is structural — that
the rate-derivation method *category* matters even if only one current
zone falls into the neighbour-extrapolated bucket. Future zones added
to the dataset (Switzerland's pattern is likely to recur for small
ENTSO-E zones without their own published curtailment statistics) will
land in T1c without re-engineering the tier system. Option B's value is
the framework, not the population count.

## Implementation spec — for the eventual CODEX-7 dispatch (post-B1+rerun)

When CODEX-1 has landed and Claude has the post-fix outlier table, the
following dispatch can go to Codex with the concrete zone list filled
in. The structural spec is locked here so that dispatch is a
fill-in-the-blanks exercise, not a re-design.

### 1. `src/lib/regions.ts`

- Extend the `Tier` type alias to include
  `"live-domestic-anchored" | "live-neighbour-anchored"`.
- For each zone in the post-rerun T1b set, change
  `tier: "live"` → `tier: "live-domestic-anchored"`.
- For each zone in the post-rerun T1c set, change
  `tier: "live"` → `tier: "live-neighbour-anchored"`.
- Add a one-line comment per migrated zone documenting which anchor it
  uses (for future maintainers; CI doesn't enforce).

### 2. `src/lib/uncertainty.ts`

- Extend the `ConfidenceTier` literal union to include
  `"live-domestic-anchored" | "live-neighbour-anchored"`.
- Update `deriveTier(regionTier, profileKind)` so:
  - `regionTier === "live-domestic-anchored"` → `"live-domestic-anchored"`
  - `regionTier === "live-neighbour-anchored"` → `"live-neighbour-anchored"`
- Update `applyUncertainty()` (or whichever function maps
  `confidenceTier` to envelope %) to use the empirically-derived
  envelope numbers from the B4 rerun.
- Update the inline tier-band table comment to reflect 6-row taxonomy.

### 3. `tests/regions.test.ts`

- Update tier-count expectations: drop the T1 count by `|T1b| + |T1c|`,
  introduce explicit assertions for the new counts.
- Add a test asserting the new tier enum values are reachable.

### 4. `tests/uncertainty.test.ts`

- Add cases for `deriveTier("live-domestic-anchored", …)` and
  `deriveTier("live-neighbour-anchored", …)`.
- Add cases for the new envelope values.

### 5. `tests/__golden__/tally-tiers.txt`

- Regenerate via `npm run tally:tiers > tests/__golden__/tally-tiers.txt`
  after the regions.ts changes land.
- The file should now show 6 tier rows in the breakdown section
  (T1a, T1b, T1c, T2, T2-flare, T3) plus the matrix view from N2.

### 6. Per-region validation MDs

- Regenerate via `python3 scripts/validation/build_region_docs.py` after
  regions.ts changes land. CI's docs-drift `--check` flag (CODEX-6)
  enforces no manual edits remain.

## Paper changes — locked structural form

The post-council rewrite checklist's "edit-after-decision" block is now
specialised to Option B. The full mechanical edit list is in
`docs/paper/post-council-rewrite-checklist.md`; the structural form of
the §2.5 / §5.2 tier table is fixed here:

```
| Tier | Inputs | Envelope | Regions |
|------|--------|----------|---------|
| T1a-live-tso | TSO hourly series + own-jurisdiction calibration rate | ±15% | <count> |
| T1b-live-domestic-anchored | TSO hourly + domestic stat-agency rate | ±20–25% | <count> |
| T1c-live-neighbour-anchored | TSO hourly + neighbour-extrapolated rate | ±<TBD>% | <count> |
| T2-annual-calibrated | Annual anchor + typical shape | ±25% | <count> |
| T2-flare | GGFR annual + flat 24/7 | ±20% | 4 |
| T3-modelled | Synthetic shape + Ember/IRENA anchor | ±40% | <count> |
```

Counts and the T1c envelope number are filled at paper-sweep time from
`npm run tally:tiers` and the post-B1 B4 rerun respectively.

Every "T1 ±15%" mention elsewhere in the paper draft is annotated with
the specific sub-tier (per the rewrite-checklist file/line table). No
single reference to "T1" stays unqualified.

## Sequence

1. ✅ Decision recorded (this doc, 2026-04-25).
2. ⏳ CODEX-1 lands (B1 PT15M overcount fix in `src/lib/profile.ts:68`).
3. ⏳ Claude regenerates `data/historical/per_region_annual.parquet`.
4. ⏳ Claude reruns `scripts/calibration/empirical_tier_bands.py
   --by-tier` → identifies actual T1b and T1c zone sets, derives
   empirical T1c envelope.
5. ⏳ Claude writes CODEX-7 dispatch brief with concrete zone lists +
   envelope number filled in (this spec is the template).
6. ⏳ CODEX-7 lands → tier enum extended, regions migrated, tests
   updated, tally golden regenerated, validation MDs regenerated.
7. ⏳ Gemini (or Claude) paper-rewrite sweep using the
   post-council-rewrite-checklist's edit-after-decision block.
8. ⏳ Final verification (CI clean, grep checks for stale "T1 ±15%"
   mentions, region-count consistency).
9. ⏳ Tag `sci-data-readiness-v1`.

## What this decision does NOT cover

- The B4-rerun itself — it executes when B1 lands and follows the
  recipe in `phase-3-integration-runbook.md` Step 2.
- Whether to subdivide T2 similarly. Not in scope; T2 envelope is
  defensible as one band per `uncertainty-recalibration.md`.
- Whether the `confidenceTier` enum should grow further (e.g. for
  modelled regions). Not in scope.

## Acceptance criteria for the eventual CODEX-7 PR

Pre-listed so the dispatch is one fill-in-the-blanks step:

- `npm run typecheck` passes.
- `npm test` passes (with updated tier-count assertions).
- `npm run validate` passes.
- `npm run validate:tiers` passes (S4 / CODEX-6 prerequisite — must land first).
- `npm run check:tally` passes (golden file regenerated as part of PR).
- `npm run check:docs` passes (validation MDs regenerated as part of PR).
- The 6-tier breakdown appears in `tally-tiers` output.
- No `regions.ts` entry is `tier: "live"` if it uses a neighbour or
  domestic anchor (verified by inspection in PR review).
- The `live-domestic-anchored` and `live-neighbour-anchored` tier values
  appear in `src/lib/regions.ts` AND in `src/lib/uncertainty.ts`'s
  `ConfidenceTier` union (CODEX-6's tier-coherence check enforces).

## Status

| Step | Owner | Status |
|---|---|---|
| Decision recorded | Simon + Claude | ✅ this doc |
| Integration runbook updated to single-path | Claude | bundled with this commit |
| Rewrite checklist specialised to Option B | Claude | bundled with this commit |
| CODEX-7 dispatch brief | Claude | post-B1+rerun |
| Implementation | Codex (CODEX-7) | post-B1+rerun |
| Paper sweep | Gemini or Claude | post-CODEX-7 |
