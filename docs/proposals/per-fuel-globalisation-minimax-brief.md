# Per-fuel Globalisation — Minimax Implementation Brief

**Goal:** make per-fuel (wind/solar) representation consistent across the entire dataset and the globe pillar rendering.

Two pieces:
1. **Data layer.** Split the three remaining material single-fuel T1a regions (`finland`, `ireland-republic`, `northern-ireland`) into wind+solar pairs. Net delta: +3 region IDs (each split = +1 net since the original is replaced by `<id>-wind` + `<id>-solar`).
2. **Render layer.** Refactor the globe pillar grouping in `src/globe.js` so that wind+solar pairs at the same centroid render as **adjacent, individually tappable pillars** rather than a single stacked composite.

Region count: 380 → 383. Country count unchanged at 195.

**Branch:** `feat/per-fuel-globalisation` off current `main`.

---

## CRITICAL RULES — read before touching any file

**RULE 1 — No index.md changes for the data-layer split.**
`src/index.md` spreads the entire statics map via `...statics` at line 483. New statics keys are auto-included. Do NOT touch `src/index.md` for the new region IDs. Index.md MAY need a small loader-wiring change for Finland/Ireland if those regions use a non-statics loader (see Step 2). If `src/index.md` is touched, every line of the diff must be justified in the PR body.

**RULE 2 — statics key must exactly match region id.**
`finland-wind`, `finland-solar`, `ireland-republic-wind`, `ireland-republic-solar`, `northern-ireland-wind`, `northern-ireland-solar`. Any drift = dashboard hangs on "LOADING DATA…".

**RULE 3 — No allowlist additions.**
If `check-tier-coherence.ts` or `check-docs-drift.ts` fails, fix the data. Do not edit allowlist arrays.

**RULE 4 — Run every CI gate independently and report actual output.**
Do not assume a gate passes. Run each command, paste the output into the PR body.

**RULE 5 — Do not break existing splits.**
The 22+ already-split countries (Spain, Germany, France, Poland, Czech, etc.) must continue to work. Render-layer changes must be a generalisation, not a rewrite.

**RULE 6 — No region centroid changes for already-split pairs.**
The render-layer fix is in `src/globe.js`, not in `src/lib/regions.ts`. Do not edit lat/lon for any existing region. The offset is computed at render time.

---

## Pre-flight checks (run first, before touching any file)

```bash
git clone https://github.com/honeybeesquad/every-last-joule-dashboard.git /tmp/elj-pfg
cd /tmp/elj-pfg
git log --oneline -3
npm run tally:tiers | head -10
grep -oE 'country: "[A-Z]{3}"' src/lib/regions.ts | sort -u | wc -l
```

Expected:
- `git log`: most recent commits include Phase 4-C (PR #59) merge plus paper-counts sweep
- `tally:tiers`: `Total: 380`, `T1a: 152`
- country count: `195`

Stop and report if any value differs.

---

## PART A — Data layer (Finland + Ireland per-fuel split)

### Step A1: Read the existing regions.ts entries

```bash
grep -n "^.*id: \"\(finland\|ireland-republic\|northern-ireland\)\"" src/lib/regions.ts
```

Expected three matches at approximately lines 50, 178, 179. Each is a `tier: "live"`, `kind: "wind"` row using the ENTSO-E or EirGrid/SONI loader.

### Step A2: Decide the split rate sources

| Region | Wind source | Solar source |
|---|---|---|
| `finland` | ENTSO-E A75 (FI bidding zone, B19 wind) | ENTSO-E A75 (FI bidding zone, B16 solar) |
| `ireland-republic` | EirGrid DD workbook, ROI 58% allocation, wind portion | EirGrid DD workbook, ROI 58% allocation, solar portion (PV is small but growing — confirm B16 in A75 or fall back to IRENA solar share if SONI workbook does not separate) |
| `northern-ireland` | EirGrid DD workbook, NI 42% allocation, wind portion | EirGrid DD workbook, NI 42% allocation, solar portion (same caveat) |

**Note for Minimax:** if the SONI workbook does not expose per-fuel DD separately, fall back to a domestic-share split at the loader level (T1b-style anchor) and document the choice in the per-region validation MD. Do NOT invent solar curtailment numbers.

### Step A3: Add 6 statics entries OR update existing loaders

Two paths depending on what the existing loaders return. Inspect:

```bash
cat src/data/ireland.json.ts | head -80
grep -n "finland\|ireland\|northern-ireland" src/lib/entsoe.ts | head
```

If the existing loaders emit a single composite, refactor them to emit per-fuel keys:
- `finland-wind`, `finland-solar` from `src/lib/entsoe.ts`
- `ireland-republic-wind`, `ireland-republic-solar`, `northern-ireland-wind`, `northern-ireland-solar` from `src/data/ireland.json.ts`

**Wiring rule (CRITICAL — past bug):** never add `<id>: entsoe.<id>` to `src/index.md` without verifying the loader's snapshot already has that exact `<id>` key. Confirmed pattern from prior Baltics + Malta crashes (see [memory: ELJ wiring rule]).

### Step A4: Update `src/lib/regions.ts`

Replace the 3 single-fuel rows with 6 per-fuel rows. Use the same lat/lon for each pair (the render layer handles the offset). Set `kind: "wind"` or `kind: "solar"` appropriately.

### Step A5: Per-region tests

Add or update under `tests/data/`:
- `finland-wind.test.ts`, `finland-solar.test.ts`
- `ireland-republic-wind.test.ts`, `ireland-republic-solar.test.ts`
- `northern-ireland-wind.test.ts`, `northern-ireland-solar.test.ts`

Pattern: copy from `tests/data/spain-wind.test.ts` and `spain-solar.test.ts`.

### Step A6: Validation MDs

Add or update `docs/validation/finland.md`, `docs/validation/ireland-republic.md`, `docs/validation/northern-ireland.md` to document the per-fuel split provenance.

### Step A7: Update golden tier counts

```bash
npm run tally:tiers
# Expected: T1a: 155, Total: 383
```

Update `tests/golden/tier-counts.json` (or wherever the tally golden lives) to the new numbers.

---

## PART B — Render layer (adjacent tappable pillars)

### Step B1: Understand the current grouping

`src/globe.js` line 85–137 groups regions by rounded lat/lon (4-decimal key) and renders each group as a single stacked composite pillar with one segment per member. This is why Spain appears as one bar and Bahia as two: Bahia state centroids differ; Spain's wind+solar share Madrid's centroid.

```bash
sed -n '80,145p' src/globe.js
```

### Step B2: Replace stack-by-centroid with offset-by-fuel-kind

**Spec:**

For each lat/lon group containing 2+ regions where the regions differ by `kind` (wind vs solar vs hydro vs geo etc.), instead of stacking into one composite, render N adjacent pillars with a small horizontal screen-pixel offset.

**Offset rule:**
- Compute the projected (x, y) for the centroid as today.
- For each member of the group, assign a deterministic offset along the screen-tangent direction at that centroid.
- Offsets: `[-Δ, +Δ]` for 2-member groups, `[-Δ, 0, +Δ]` for 3-member, `[-1.5Δ, -0.5Δ, +0.5Δ, +1.5Δ]` for 4-member.
- **`Δ` value: 22 pixels.** This gives a 44-pixel centre-to-centre separation, meeting the WCAG 2.5.5 minimum touch-target size for finger-tappable controls. Document this constant inline.
- Sort group members deterministically by `kind` so wind is always to the left of solar in any pair (deterministic = stable visual + reproducible figures).

**Existing single-region rendering must be unchanged.** Groups of size 1 retain current behaviour.

**Hit-detection / tooltip routing:** the existing tooltip code (`src/components/region-tooltip.js`) currently maps a click to the composite's underlying member by inspecting the stack. With separate pillars, each pillar IS one region — simpler. Confirm the click-to-region routing is correct after refactor by checking 3 cases in browser:
- Click Spain wind pillar → tooltip shows `spain-wind`
- Click Spain solar pillar → tooltip shows `spain-solar`
- Click Bahia wind pillar (already separate) → tooltip shows `brazil-bahia-wind`

### Step B3: Visual regression check

After the render change, run the dev server and screenshot the globe at a few zoom levels. Compare against `main` for any unexpected pillar drift in already-separate regions (Bahia, US ISOs, Norway zones — these have distinct centroids and should NOT shift).

```bash
npm run build
npx http-server dist/ -p 8080
# then Playwright or manual inspection against main
```

---

## CI gates — run each independently, paste actual output into PR body

```bash
npx vitest run
npx tsx scripts/ci/check-tier-coherence.ts
npx tsx scripts/ci/check-tally-golden.ts
npx tsx scripts/ci/check-docs-drift.ts
npm run validate
npm run tally:tiers
npm run build
```

Plus a render smoke check:

```bash
npm run build && npx http-server dist/ -p 8080 &
sleep 3
# Playwright assertion: pillar centres for spain-wind and spain-solar are ≥ 40 pixels apart on screen
```

---

## Self-check before opening PR

```bash
# All 6 new region ids present in regions.ts
grep -E 'id: "(finland|ireland-republic|northern-ireland)-(wind|solar)"' src/lib/regions.ts | wc -l
# must output 6

# Old single-fuel ids removed
grep -E 'id: "(finland|ireland-republic|northern-ireland)"' src/lib/regions.ts | wc -l
# must output 0

# tally
npm run tally:tiers | grep "Total:"
# must show Total: 383

# index.md unchanged unless loader-wiring justified in PR body
git diff src/index.md
```

---

## Required PR body

```markdown
## Summary

Per-fuel globalisation: split Finland + Ireland-Republic + Northern-Ireland into wind+solar (data layer); refactor globe pillar grouping to render co-located wind+solar as adjacent tappable pillars (render layer). Region count 380 → 383, country count unchanged at 195. WCAG 2.5.5-compliant 44px touch separation.

## CI gate results (paste actual output)

[paste]

## New statics / loader entries added (6)

- finland-wind, finland-solar
- ireland-republic-wind, ireland-republic-solar
- northern-ireland-wind, northern-ireland-solar

## Render-layer change

`src/globe.js` lines [N–M]: replaced stack-by-centroid composite with offset-by-kind adjacent pillars (Δ=22px). Single-region groups unchanged. Click routing verified for Spain wind/solar and Bahia wind/solar.

## index.md changes

[either "none" OR justified line-by-line]

## Visual regression

[3 screenshots: Europe zoom, Brazil zoom, US zoom — compared to main]
```

---

## Out of scope (do not attempt)

- Splitting any T1a region the parent brief identifies as not-worth-splitting (Japan utilities, Atacama, Uruguay, Norway-NO5, Malta, Baltics, Bosnia, Montenegro). These are documented loader limitations or single-fuel grids.
- Touching T1b/T1c/T2/T3 regions.
- Changing pillar colour, height scaling, or sun-angle logic.
- Re-baselining figures in the paper draft. Paper updates are a separate PR.
