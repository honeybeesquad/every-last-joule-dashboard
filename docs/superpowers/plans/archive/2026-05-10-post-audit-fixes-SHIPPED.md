# Post-Audit Fixes — Delegation Plan

> **STATUS: SHIPPED — archived 2026-06-16.**
> The 2026-05-10 architect-audit findings landed across PRs #84–#92 (loader-wiring blockers, integrity gate, Japan loaders, dead-code purge, pillar-coord fixes, island-polygon overrides, manual-block markers). Committed late (the plan file was never tracked); kept here for historical reference — do not treat as live work.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Tasks below are scoped per-worker; checkbox steps inside each task are the execution log.

**Goal:** Resolve the 2026-05-10 architect-audit findings without burning Opus context on procedural bulk. Ship blockers first, harden the integrity gate so the loader-wiring bug class can never recur, then sweep dead code and add the missing invariant tests.

**Architecture:** Five phases, each producing one shippable PR. Phase 1 lands a strengthened integrity test FIRST (TDD-style — it should fail loudly on `main`), then ships the four loader-wiring fixes that make it pass. Subsequent phases run independently and can be parallelised. Structural refactors (loaders.ts registry, globe.js split) are explicitly deferred — they need a separate brainstorming pass.

**Worker matrix:**
- **MMX (MiniMax)** — procedural bulk: large file sweeps, mechanical wirings, brief-driven parser work. Dispatch via standard `*-minimax-brief.md` flow.
- **DeepSeek-V4-Pro** — alternate bulk worker; same role as MMX. Dispatch via `/tmp/dsk/call.py` wrapper (NOT raw `deepseek-cli` — streaming bug).
- **Sonnet 4.6** — test writing, mid-complexity refactors, anything where taste and code-shape judgment matter. Dispatch via subagent or new session.
- **Opus 4.7** — review checkpoints, brainstorming for the deferred structural items, final QA before merge.
- **Direct edit** — for 1-line surgical fixes, no worker needed.

**Out of scope (this plan):** loaders.ts registry refactor, globe.js split, tier taxonomy rename decision (pending user call). All flagged in the audit as SHOULD-FIX or BLOCKER, but each warrants its own brainstorming.

---

## Phase 1 — Loader-wiring blockers + integrity gate

**PR title:** `fix: loader-wiring blockers (Belgium/Peru/SA/WA-SWIS) + shape-aware integrity check`

**Branch:** `fix/loader-wiring-blockers`

**Owner:** Sonnet (test) → Direct edit (fixes) → Opus (review)

**Why first:** The four wiring bugs hide ~1 GW of curtailment from the headline. The shape-blind integrity test is the reason CI didn't catch them. Land the strengthened test first so the regressions show up red, then fix.

### Task 1.1 — Strengthen `region-data-integrity.ts` (Sonnet)

**Files:**
- Modify: `src/lib/region-data-integrity.ts:8-24`
- Modify: `tests/region-data-integrity.test.ts` — add fixtures that mimic Belgium-shape bug

**Worker brief (Sonnet):**

> The current check only verifies key presence. It must also verify each entry's `profile` is a 24-element array (the smallest contract that proves the value is `RegionData`, not a stray sub-record). Add a unit test that constructs a mis-wired record (key exists, value is a Record-of-RegionData) and asserts the strengthened check rejects it. Do not change the function signature; existing callers must keep working. Keep the test deterministic — no fixtures from `data/snapshots/`.

- [ ] Step 1: Write failing test for shape-blind regression (mis-wired Belgium-shape input)
- [ ] Step 2: Strengthen the check (one-line addition: `Array.isArray(value.profile) && value.profile.length === 24`)
- [ ] Step 3: Run `npm test -- region-data-integrity` — expect PASS
- [ ] Step 4: Run full `npm test` — expect failures from Phase 1.2 fixes (Belgium/Peru/SA/WA-SWIS) IF the integrity check is hit at runtime; if check is build-time only, run `npm run dev` and confirm warning surfaces

### Task 1.2 — Apply four wiring fixes (Direct edit)

No worker dispatch — these are 1-line each.

- [ ] `src/index.md:333-334`: replace explicit `belgium-wind: belgium` / `belgium-solar: belgium` with `...belgium`
- [ ] `src/index.md:417`: replace `peru,` with `...peru,`
- [ ] `src/index.md:418`: replace `"south-africa": southAfrica,` with `...southAfrica,`
- [ ] `src/index.md:441`: replace `"wa-swis": waSwis,` with `...waSwis,`
- [ ] Run `npm run dev` and visually confirm Belgium / Peru / South Africa / WA-SWIS pillars render with non-zero GW
- [ ] Run `npm test` — expect green
- [ ] Commit: `fix: spread sub-region loaders for Belgium/Peru/SA/WA-SWIS`

### Task 1.3 — Remove dead `ercot-native` fetch (Direct edit)

- [ ] `src/index.md:38`: remove `FileAttachment("data/ercot-native.json")` line
- [ ] `src/index.md:71`: remove the corresponding `trackFile(...)` entry
- [ ] `src/index.md:293-307`: remove the `ERCOT_NATIVE_ENABLED ? ... : ...` branch; keep the standard `ercot` wiring
- [ ] Run `npm run dev` — confirm no console errors, ERCOT pillar still renders
- [ ] Commit: `chore: remove dead ercot-native fetch behind hard-coded flag`

### Phase 1 verification gate (Opus)

- [ ] All 4 wirings render non-zero GW in `npm run dev`
- [ ] `npm run ci:gates` green
- [ ] `npm test` green with strengthened integrity check
- [ ] STATUS.md updated: branch hash + new region-count tally
- [ ] Squash-merge as one PR; tag the integrity-test commit so it's findable

---

## Phase 2 — Japan ghost regions

**PR title:** `feat: wire 9 Japan regional loaders into dashboard`

**Branch:** `feat/japan-regional-wiring`

**Owner:** MMX (brief) → Sonnet (review)

**Why:** 9 of 10 Japan regions in `regions.ts` have `tier: "live"` and working loaders, but `index.md` only fetches `japan-kyushu.json`. The other 9 silently render as no-data. Methodology and paper claim live coverage we don't deliver.

### Task 2.1 — Draft MMX brief

**Owner:** Opus

Brief lives at `docs/prompts/japan-wiring-mmx-brief.md` (new file, follows the established `*-minimax-brief.md` format from the parent dir). Brief must include:
- The 9 region IDs to wire: japan-chubu, chugoku, hokkaido, hokuriku, kansai, okinawa, shikoku, tepco, tohoku
- The exact `index.md` insertion points (after line 102 for FileAttachment block, after line 428 for wiring block)
- The shape contract each loader emits (single `RegionData`, not a Record — confirmed via spot-check of `japan-kyushu.json.ts`)
- The labels for `trackFile` calls (e.g. "Japan Chubu", "Japan TEPCO")
- Verification commands MMX must run before declaring done: `npm run build` then `npm test`
- Strict instruction: do NOT modify `regions.ts` or any loader file; only `index.md` is touched

### Task 2.2 — Dispatch MMX, review output (Sonnet)

- [ ] Dispatch MMX with brief
- [ ] Sonnet reviews the diff: 9 FileAttachment lines added, 9 wiring lines added, no other changes
- [ ] `npm run dev` — visually confirm 9 new Japan pillars render with non-zero GW
- [ ] `npm test` — green
- [ ] Commit + PR

### Phase 2 verification gate (Opus)

- [ ] Tally golden updated to reflect 9 newly-live regions
- [ ] All 10 Japan regional pillars render at non-zero GW
- [ ] STATUS.md updated

---

## Phase 3 — Dead code purge

**PR title:** `chore: remove orphan loaders, unit-toggle, USD data layer`

**Branch:** `chore/dead-code-purge`

**Owner:** DeepSeek (brief) → Sonnet (review) → Opus (price/fx decision)

**Why:** Orphan loaders, the orphaned unit-toggle component, and the unused price/fx data layer are all costing per-build time and reader confusion. `unit-toggle.js`, `japan.json.ts`, `india-{north,south,west}.json.ts` are pure dead code. The price/fx layer needs a user decision (keep dormant vs. delete).

### Task 3.1 — User decision on price/fx layer (Opus)

Block: ask user. Options:
- (a) Delete entire layer (`src/lib/price.ts`, `src/lib/fx.ts`, `data/prices.json`, all imports + threading in `index.md` and `globe.js`); resurrect from git when needed
- (b) Keep as-is with explicit `// dormant — see STATUS.md` comments at all import sites
- (c) Keep but stop fetching `prices.json` per page-load; load on-demand when a future toggle re-enables

Recommendation: (a). YAGNI. Git is the archive.

### Task 3.2 — DeepSeek brief

**Owner:** Opus

Brief at `docs/prompts/dead-code-purge-deepseek-brief.md`. Dispatched via `/tmp/dsk/call.py` wrapper. Brief contents:
- Files to DELETE outright:
  - `src/components/unit-toggle.js`
  - `src/data/japan.json.ts`
  - `src/data/india-north.json.ts`, `india-south.json.ts`, `india-west.json.ts`
  - `tests/data/japan.test.ts`, `india-north.test.ts`, `india-south.test.ts`, `india-west.test.ts` (if present)
  - `tests/fixtures/caiso-oasis-curtailment.csv` (orphan fixture)
  - `verify-b1.mjs` (one-off Phase B Playwright probe)
- Files to MODIFY (only if user chose 3.1.a):
  - `src/lib/price.ts`, `src/lib/fx.ts` — delete
  - `src/index.md` — remove imports at line 36, FileAttachment at line 67, threading at lines 172/642/663/703
  - `src/globe.js:197` — remove `priceData` from globe state, all `globe.update(prices)` callers
  - `data/prices.json` — delete
  - Any test referencing the above
- Verification: `npm run build && npm test && npm run typecheck` all green; no orphan imports
- Commit message convention: one commit per logical removal, not one giant blob

### Task 3.3 — Sonnet review

- [ ] Confirm no orphan imports
- [ ] Confirm `npm run build` produces a smaller `data/` payload
- [ ] Spot-check `git status` for unintended deletions

### Task 3.4 — Cosmetic sweep (DeepSeek, same brief)

Bundled into 3.2 to save a round-trip:
- `README.md`: "264 regions" → current count
- `observablehq.config.ts:16,27`: same fix
- `tests/regions.test.ts:5`: description "198 canonical regions" → "384 canonical regions"
- `STATUS.md:5`: update branch hash to current HEAD
- `src/lib/regions.ts:189`: rewrite the "Tier 2 - static fallback regions" section comment to match the kind/tier separation

---

## Phase 4 — Missing invariant tests

**PR title:** `test: add pillar-base-inside-country sweep + end-to-end loader integrity`

**Branch:** `test/loader-integrity-and-pillar-invariants`

**Owner:** Sonnet (both tests)

**Why:** Two structural invariants the codebase already relies on are not tested. Pillar-base-inside-country prevents the "pillar floats over the wrong country" class of bug (memory: never use screen-px offsets to fix). End-to-end loader integrity prevents the Belgium/Peru class.

### Task 4.1 — Pillar-base sweep test (Sonnet)

**Files:**
- Create: `tests/pillar-country-containment.test.ts`

**Worker brief (Sonnet):**

> Walk all 384 entries in `src/lib/regions.ts`. For each, load the polygon for `country` from `src/data/countries-110m.json` (TopoJSON; convert to GeoJSON via `topojson-client.feature`). Use `d3-geo.geoContains` to assert that `(lon, lat)` lies inside the polygon (note: d3-geo expects [lon, lat] not [lat, lon]). For multi-region countries (US states, Chinese provinces, Indian states, Japanese regions, Australian NEM zones), the country polygon is the right level of granularity — sub-national containment isn't required, only that we're in the declared `country`. Allow a small tolerance (e.g. 0.5°) for coastal points; document the tolerance choice in a comment.
>
> Output format: one `it.each` per region, so failures name the offending region clearly. The test must pass on `main` AFTER any required regions.ts coordinate corrections — but if any current region fails, REPORT the failure list rather than fixing coordinates blindly. Coordinate fixes are a separate decision.

- [ ] Step 1: Write the sweep
- [ ] Step 2: Run; capture any current failures and report to user before "fixing"
- [ ] Step 3: With user approval, fix coordinates region-by-region (or relax tolerance with justification)
- [ ] Step 4: Commit

### Task 4.2 — End-to-end loader-output integrity test (Sonnet)

**Files:**
- Create: `tests/loader-output-integrity.test.ts`

**Worker brief (Sonnet):**

> Load the snapshot file `data/snapshots/last-good/<latest>.json` (find latest via fs read of dir). For every region ID in `src/lib/regions.ts`, assert the snapshot has a corresponding entry with a 24-element `profile`. This closes the loader-wiring loop: regions.ts is the source of truth, the snapshot proves loaders deliver, and any new region added without a wired loader fails this test.
>
> Edge case: regions whose loaders deliberately return no data (e.g. flare regions sometimes have empty profiles) — list these in a small allowlist constant inside the test, with a comment explaining why each is exempt.

- [ ] Step 1: Write test
- [ ] Step 2: Run against current snapshot; expect failures for the 9 unwired Japan regions and any others — but Phase 2 should have fixed Japan, so failures should be allowlist-only
- [ ] Step 3: Reconcile allowlist with user
- [ ] Step 4: Commit

### Phase 4 verification gate (Opus)

- [ ] Both tests run in `npm test`
- [ ] CI gate `ci:gates` extended to include them (or they run via `npm test` which CI already runs — confirm)

---

## Phase 5 — Deferred structural items (NOT in this plan)

These need their own brainstorming session before any implementation plan. Listed here so they're not lost:

- **Audit finding #14 — `loaders.ts` registry.** Replace the 124-line hand-edited Promise.all in `index.md` with a programmatic `[id, loader, label]` table. Architectural; touches every region; needs design discussion (split-region helper integration, lazy loading?, error bubbling).
- **Audit finding #15 — `mountGlobe` split.** 862-line function. Worth splitting once the price/fx layer decision (Task 3.1) lands so we don't refactor around dead code.
- **Memory drift — tier-rename decision.** Memory file says `static→estimated, flare→anchored` shipped 2026-05-09 but the code still uses old vocabulary and the claimed commit doesn't exist. User must decide: re-land the rename, or update memory + paper drafts to match current vocabulary. Out of scope here; flagging as a hard prerequisite for any external citation of v1.2.1.

---

## Self-review notes

**Coverage:** All BLOCKERS (1-7) covered in Phase 1+2. SHOULD-FIX 8/9 covered in Phase 4. SHOULD-FIX 10/11/12/13 covered in Phase 3. SHOULD-FIX 14/15 deferred with reason. Cosmetic 16-25 covered in Phase 3.4 except #21 (Karnataka KSLDC TODO — not in scope; tracked separately) and #25 (uncommitted plan file — left to user).

**Placeholder scan:** No "TBD" / "implement later" / "similar to Task N". Every brief sketch names exact files and verification commands.

**Type consistency:** No new types introduced. All references match audit findings.

**Cost discipline:** Phase 1's surgical fixes stay on Opus (review only) + Sonnet (one test). Phases 2-3 push bulk to MMX/DeepSeek. Phase 4 uses Sonnet because polygon math and snapshot reconciliation need taste, not raw bulk. Total Opus burn: review checkpoints + brief drafting only.
