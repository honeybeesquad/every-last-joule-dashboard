# Globe data-quality + freshness encoding — Implementation Plan

> **STATUS: SHIPPED** — merged to main as PR #128, 2026-06-07.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Encode each region's data-quality bucket (measured / anchored / estimated) and a stale-feed alarm onto the globe's pillars, with a decodable legend — using data already present on `regionData` (`confidenceTier`, `sourceStatus`).

**Architecture:** A new pure helper (`src/lib/region-quality.ts`) maps a region to a quality bucket, an opacity factor, and a base-dot style. `globe.js` consumes it in the pillar render loop — opacity replaces the vestigial `pillarAlpha`, and the core-dot draw branches on dot-style (solid / ringed / hollow / degraded-amber-ring). Fuel hue is preserved on the pillar body in all states. A theme-aware HTML legend in `index.md` decodes it.

**Tech Stack:** TypeScript, Canvas 2D (d3-geo projection), vitest, Observable Framework, CSS custom properties (theming).

**Spec:** `docs/superpowers/specs/2026-06-07-globe-quality-encoding-design.md`

---

## File structure

| File | Responsibility |
|---|---|
| `src/lib/region-quality.ts` (**new**) | Pure mapping: `qualityBucket()`, `qualityOpacity()`, `dotStyleFor()`. No DOM/canvas. |
| `tests/region-quality.test.ts` (**new**) | Exhaustive unit tests for the helper. |
| `src/lib/theme-tokens.ts` (**modify**) | Add `qualityWarning` to `GlobeTokens` + read `--quality-warning`. |
| `src/style.css` (**modify**) | `--quality-warning` token (base `:root`); legend styles + mobile rules. |
| `src/globe.js` (**modify**) | Apply quality opacity; branch core-dot rendering; degraded amber ring; per-segment opacity. |
| `src/index.md` (**modify**) | Legend markup in the globe area + open-on-desktop init. |

---

## Task 1: `region-quality.ts` helper

**Files:**
- Create: `src/lib/region-quality.ts`
- Test: `tests/region-quality.test.ts`

- [ ] **Step 1: Write the failing test** — `tests/region-quality.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { qualityBucket, qualityOpacity, dotStyleFor } from "../src/lib/region-quality.js";
import type { Region, RegionData } from "../src/lib/types.js";

const region = (tier: Region["tier"]): Region => ({
  id: "x", name: "X", country: "XXX", lat: 0, lon: 0, tier, kind: "solar",
  source: "", sourceUrl: "",
});
const data = (confidenceTier?: RegionData["confidenceTier"], sourceStatus?: RegionData["sourceStatus"]): RegionData => ({
  regionId: "x", profile: [], latestProfile: null, totalTWh: 0, peakGW: 0,
  lastUpdated: "", lastSuccessAt: "", confidenceTier, sourceStatus,
});

describe("qualityBucket", () => {
  it("maps live confidenceTiers to measured", () => {
    for (const ct of ["T1a-live-tso", "T1b-live-domestic-anchored", "T1c-live-neighbour-anchored", "T1-live-TSO"] as const) {
      expect(qualityBucket(region("estimated"), data(ct))).toBe("measured");
    }
  });
  it("maps T2 tiers to anchored", () => {
    expect(qualityBucket(region("estimated"), data("T2-annual-calibrated"))).toBe("anchored");
    expect(qualityBucket(region("estimated"), data("T2-flare"))).toBe("anchored");
  });
  it("maps T3 / unknown / T4 to estimated", () => {
    expect(qualityBucket(region("live"), data("T3-modelled"))).toBe("estimated");
    expect(qualityBucket(region("live"), data("T4-structural-gap"))).toBe("estimated");
  });
  it("falls back to region.tier when confidenceTier is absent", () => {
    expect(qualityBucket(region("live"), data(undefined))).toBe("measured");
    expect(qualityBucket(region("live-domestic-anchored"), null)).toBe("measured");
    expect(qualityBucket(region("anchored"), undefined)).toBe("anchored");
    expect(qualityBucket(region("estimated"), data(undefined))).toBe("estimated");
  });
});

describe("qualityOpacity", () => {
  it("returns the documented factors", () => {
    expect(qualityOpacity("measured")).toBe(1.0);
    expect(qualityOpacity("anchored")).toBe(0.8);
    expect(qualityOpacity("estimated")).toBe(0.62);
  });
});

describe("dotStyleFor", () => {
  it("maps buckets to dot styles", () => {
    expect(dotStyleFor("measured")).toBe("solid");
    expect(dotStyleFor("anchored")).toBe("ringed");
    expect(dotStyleFor("estimated")).toBe("hollow");
  });
  it("degraded sourceStatus overrides the bucket dot", () => {
    expect(dotStyleFor("measured", "degraded")).toBe("degraded");
    expect(dotStyleFor("estimated", "degraded")).toBe("degraded");
  });
  it("live and cached do not override", () => {
    expect(dotStyleFor("measured", "live")).toBe("solid");
    expect(dotStyleFor("measured", "cached")).toBe("solid");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/region-quality.test.ts`
Expected: FAIL — cannot resolve `../src/lib/region-quality.js`.

- [ ] **Step 3: Implement `src/lib/region-quality.ts`**

```ts
import type { Region, RegionData } from "./types.js";

export type QualityBucket = "measured" | "anchored" | "estimated";
export type DotStyle = "solid" | "ringed" | "hollow" | "degraded";

/** confidenceTier values that count as live-measured. */
const MEASURED_TIERS = new Set([
  "T1a-live-tso",
  "T1b-live-domestic-anchored",
  "T1c-live-neighbour-anchored",
  "T1-live-TSO", // pre-2026-04-25 alias
]);
/** confidenceTier values that count as published-annual anchored. */
const ANCHORED_TIERS = new Set(["T2-annual-calibrated", "T2-flare"]);

/** region.tier values that count as live-measured (fallback path). */
const MEASURED_REGION_TIERS = new Set([
  "live",
  "live-domestic-anchored",
  "live-neighbour-anchored",
]);

/**
 * Coarse data-quality bucket for globe encoding. Prefers the per-snapshot
 * `confidenceTier`; falls back to the canonical `region.tier` when a loader
 * has not stamped one. Anything not measured/anchored (incl. T3-modelled,
 * T4-structural-gap, or unknown) is "estimated".
 */
export function qualityBucket(region: Region, data?: RegionData | null): QualityBucket {
  const ct = data?.confidenceTier;
  if (ct) {
    if (MEASURED_TIERS.has(ct)) return "measured";
    if (ANCHORED_TIERS.has(ct)) return "anchored";
    return "estimated";
  }
  if (MEASURED_REGION_TIERS.has(region.tier)) return "measured";
  if (region.tier === "anchored") return "anchored";
  return "estimated";
}

/** Pillar opacity factor per bucket. Multiplies into globe.js visible×sunDim. */
export function qualityOpacity(bucket: QualityBucket): number {
  switch (bucket) {
    case "measured":
      return 1.0;
    case "anchored":
      return 0.8;
    case "estimated":
      return 0.62;
  }
}

/**
 * Base-dot style. A `degraded` sourceStatus (live feed >24h stale) overrides
 * the bucket dot with the amber-ring alarm; live/cached use the bucket dot.
 */
export function dotStyleFor(bucket: QualityBucket, sourceStatus?: string | null): DotStyle {
  if (sourceStatus === "degraded") return "degraded";
  switch (bucket) {
    case "measured":
      return "solid";
    case "anchored":
      return "ringed";
    case "estimated":
      return "hollow";
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/region-quality.test.ts`
Expected: PASS (all describe blocks).

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck
git add src/lib/region-quality.ts tests/region-quality.test.ts
git commit -m "feat(globe): region-quality helper (bucket/opacity/dot-style)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: `--quality-warning` theme token

**Files:**
- Modify: `src/style.css` (base `:root`, near `--amber-500` at line ~76)
- Modify: `src/lib/theme-tokens.ts`

- [ ] **Step 1: Add the CSS token** in `src/style.css`, immediately after the `--amber-500: #f7931a;` line:

```css
  --amber-500: #f7931a;
  /* Stale-feed (degraded) alarm ring on globe pillars + the legend swatch.
     Amber reads as "caution" against both dark themes; inherits to both
     since it lives in the base :root. */
  --quality-warning: var(--amber-500);
```

- [ ] **Step 2: Add `qualityWarning` to the `GlobeTokens` interface** in `src/lib/theme-tokens.ts` (after the `pillarBaseAlpha` field):

```ts
  pillarBaseAlpha: string;
  /** Hex/colour for the degraded-feed amber warning ring (--quality-warning). */
  qualityWarning: string;
```

- [ ] **Step 3: Read it in `readGlobeTokens`** in `src/lib/theme-tokens.ts` (after the `pillarBaseAlpha` line):

```ts
    pillarBaseAlpha: sanitisePillarAlpha(get("--pillar-base-alpha"), "99"),
    qualityWarning: get("--quality-warning") || "#f7931a",
```

- [ ] **Step 4: Typecheck + run theme-token tests**

Run: `npm run typecheck && npx vitest run tests/theme-tokens.test.ts`
Expected: typecheck clean; theme-token tests pass (no assertion references the new field, so they remain green).

- [ ] **Step 5: Commit**

```bash
git add src/style.css src/lib/theme-tokens.ts
git commit -m "feat(globe): --quality-warning amber token + token reader

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Apply quality encoding in `globe.js`

**Files:**
- Modify: `src/globe.js` (import; pillar render loop ~lines 345–450)

- [ ] **Step 1: Add the import** at the top of `src/globe.js`, after the existing `buildPillarUnits` import (line 6):

```js
import { buildPillarUnits } from "./lib/pillar-layout.js";
import { qualityBucket, qualityOpacity, dotStyleFor } from "./lib/region-quality.js";
```

- [ ] **Step 2: Replace the dead `pillarAlpha` block.** Find (lines ~349–351):

```js
      // USD mode removed: all regions rendered at full opacity.
      const isPriceless = false;
      const pillarAlpha = 1;
```

Replace with:

```js
      // Data-quality opacity: measured brightest → estimated dimmest.
      // A degraded (stale >24h) live feed dims to estimated level; the amber
      // dot-ring (drawn below) is the actual freshness alarm. Fuel hue on the
      // pillar body is preserved in every state.
      const repBucket = qualityBucket(rep, repData);
      const repDegraded = repData?.sourceStatus === "degraded";
      const repDotStyle = dotStyleFor(repBucket, repData?.sourceStatus);
      const pillarAlpha = qualityOpacity(repDegraded ? "estimated" : repBucket);
```

- [ ] **Step 3: Per-segment opacity for stacked pillars.** In the stacked-composite branch, find the segment loop body (lines ~406–427). Replace the segment block from `const segData =` through the `ctx.stroke();` that draws the segment with:

```js
            const segData = state.regionData[seg.region.id];
            const segColor = getRegionFuelColor(seg.region, segData);
            const segBucket = qualityBucket(seg.region, segData);
            const segDegraded = segData?.sourceStatus === "degraded";
            const segAlpha = qualityOpacity(segDegraded ? "estimated" : segBucket);
            const isBase = segStart === 0;
            const isTip = segStart + segLen >= pillarH - 0.5;
            const grad = ctx.createLinearGradient(segStartX, segStartY, segEndX, segEndY);
            grad.addColorStop(0, isBase ? `${segColor}${tokens.pillarBaseAlpha}` : segColor);
            grad.addColorStop(1, segColor);
            ctx.strokeStyle = grad;
            ctx.lineWidth = pillarW;
            ctx.lineCap = isTip ? "round" : "butt";
            ctx.globalAlpha = segAlpha * visible * sunDim;
            ctx.beginPath();
            ctx.moveTo(segStartX, segStartY);
            ctx.lineTo(segEndX, segEndY);
            ctx.stroke();
```

And in the tip-glow inside that same loop (the `if (isTip) { ... }` block), change its `ctx.globalAlpha` line from `pillarAlpha` to `segAlpha`:

```js
            if (isTip) {
              ctx.save();
              ctx.filter = "blur(3px)";
              ctx.globalAlpha = segAlpha * 0.5 * visible * sunDim;
              ctx.fillStyle = segColor;
              ctx.beginPath();
              ctx.arc(segEndX, segEndY, pillarW * 1.6, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }
```

- [ ] **Step 4: Branch the core-dot draw on dot-style.** Find the core-dot block (lines ~443–450):

```js
      ctx.globalAlpha = pillarAlpha * visible;
      ctx.fillStyle = domColor;
      ctx.beginPath();
      ctx.arc(anchorX, anchorY, coreR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
      ctx.lineWidth = 0.6;
      ctx.stroke();
```

Replace with:

```js
      ctx.globalAlpha = pillarAlpha * visible;
      if (repDotStyle === "hollow") {
        // Estimated: outline ring only, no fill — reads as "not measured".
        ctx.strokeStyle = domColor;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.arc(anchorX, anchorY, coreR, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Measured / anchored / degraded: filled core in fuel hue.
        ctx.fillStyle = domColor;
        ctx.beginPath();
        ctx.arc(anchorX, anchorY, coreR, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
        ctx.lineWidth = 0.6;
        ctx.stroke();
        if (repDotStyle === "ringed") {
          // Anchored: thin concentric ring around the filled core.
          ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.arc(anchorX, anchorY, coreR + 2, 0, Math.PI * 2);
          ctx.stroke();
        } else if (repDotStyle === "degraded") {
          // Stale live feed: amber dashed warning ring (the freshness alarm).
          ctx.save();
          ctx.strokeStyle = tokens.qualityWarning;
          ctx.lineWidth = 1.2;
          ctx.setLineDash([2, 2]);
          ctx.beginPath();
          ctx.arc(anchorX, anchorY, coreR + 2.5, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }
```

- [ ] **Step 5: Typecheck + run existing globe-adjacent tests**

Run: `npm run typecheck && npx vitest run`
Expected: typecheck clean; all tests pass (no test asserts globe pixels; this confirms no import/type breakage).

- [ ] **Step 6: Commit**

```bash
git add src/globe.js
git commit -m "feat(globe): render pillars by data-quality bucket + degraded alarm

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Legend

**Files:**
- Modify: `src/index.md` (globe area markup + init script)
- Modify: `src/style.css` (legend styles)

- [ ] **Step 1: Add legend markup** in `src/index.md`, inside `.globe-canvas-area`, immediately after the `</canvas>` (line ~241) and before the closing `</div>`:

```html
          <canvas id="globe-canvas" role="img" aria-label="Rotating globe showing active waste-energy hotspots"></canvas>
          <details class="globe-legend" id="globe-legend" aria-label="Legend: data quality and freshness">
            <summary class="globe-legend-summary">ⓘ Legend</summary>
            <div class="globe-legend-body">
              <div class="globe-legend-row"><span class="ql-dot ql-measured" aria-hidden="true"></span>Measured (live feed)</div>
              <div class="globe-legend-row"><span class="ql-dot ql-anchored" aria-hidden="true"></span>Anchored (published annual)</div>
              <div class="globe-legend-row"><span class="ql-dot ql-estimated" aria-hidden="true"></span>Estimated (modelled)</div>
              <div class="globe-legend-row"><span class="ql-dot ql-degraded" aria-hidden="true"></span>Stale feed (&gt;24h)</div>
              <div class="globe-legend-caption">Brighter pillar = higher confidence</div>
            </div>
          </details>
```

- [ ] **Step 2: Default the legend open on desktop.** In `src/index.md`, find the zoom-controls wiring (`const zoomControls = document.getElementById("globe-zoom-controls");`, line ~710) and add immediately before it:

```js
// Legend: open by default on desktop, collapsed (tap-to-expand) on mobile.
const globeLegend = document.getElementById("globe-legend");
if (globeLegend) globeLegend.open = !window.matchMedia("(max-width: 900px)").matches;
```

- [ ] **Step 3: Add legend styles** at the end of `src/style.css`:

```css
/* ============ GLOBE QUALITY LEGEND ============ */
.globe-legend {
  position: absolute;
  left: 12px;
  bottom: 12px;
  z-index: 3;
  font-size: 12px;
  color: var(--ink);
  background: color-mix(in srgb, var(--surface-bg-2) 82%, transparent);
  border: 1px solid var(--globe-border);
  border-radius: 8px;
  padding: 6px 10px;
  max-width: 220px;
  backdrop-filter: blur(3px);
}
.globe-legend-summary {
  cursor: pointer;
  list-style: none;
  font-weight: 600;
  color: var(--ink-muted);
}
.globe-legend-summary::-webkit-details-marker { display: none; }
.globe-legend-body { margin-top: 6px; display: grid; gap: 4px; }
.globe-legend-row { display: flex; align-items: center; gap: 7px; }
.globe-legend-caption { margin-top: 4px; color: var(--ink-soft); font-size: 11px; }
.ql-dot {
  display: inline-block; width: 12px; height: 12px; border-radius: 50%;
  flex: 0 0 auto; box-sizing: border-box;
}
.ql-measured { background: var(--ink); }
.ql-anchored { background: var(--ink); box-shadow: 0 0 0 2px var(--surface-bg-2), 0 0 0 3px var(--ink); }
.ql-estimated { background: transparent; border: 1.5px solid var(--ink); }
.ql-degraded { background: transparent; border: 1.5px dashed var(--quality-warning); }

@media (max-width: 900px) {
  .globe-legend { left: 8px; bottom: 8px; font-size: 11px; max-width: 60vw; }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/index.md src/style.css
git commit -m "feat(globe): data-quality legend (HTML, theme-aware, mobile-collapsible)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Preview verification + tuning + PR

- [ ] **Step 1: Start the preview**

Use `preview_start` (Observable Framework dev server). Confirm the dashboard loads with no console errors (`preview_console_logs`).

- [ ] **Step 2: Verify the encoding visually**

Screenshot the globe (`preview_screenshot`). Confirm:
1. The three buckets are distinguishable — measured pillars brightest, estimated dimmest, anchored between.
2. Estimated pillars (>half the globe) remain clearly visible, not gutted. If they vanish, raise the estimated factor (e.g. 0.62 → 0.68) in `region-quality.ts` and re-screenshot.
3. The base-dot styles read at rest: solid / ring / hollow.
4. The legend renders bottom-left and is legible.

- [ ] **Step 3: Verify the degraded alarm**

Temporarily set `sourceStatus: "degraded"` on one snapshot to exercise the path (e.g. `data/snapshots/last-good/japan-tepco.json` — edit the value, reload, screenshot, confirm the amber dashed ring renders), then revert the edit (`git checkout -- data/snapshots/last-good/japan-tepco.json`). Do NOT commit a fake degraded status.

- [ ] **Step 4: Verify theming + mobile**

Toggle to Deepcurrent (`preview_click` the theme toggle) and re-screenshot — legend + amber ring must still read. Resize to 390px (`preview_resize`) and confirm the legend collapses to the "ⓘ Legend" summary and expands on tap.

- [ ] **Step 5: Final gates**

```bash
npm run typecheck && npx vitest run
```
Expected: clean. (No data gates affected — no tier/region/snapshot changes.)

- [ ] **Step 6: Push + PR**

```bash
git push -u origin feat/globe-quality-encoding
gh pr create --base main --title "feat(globe): data-quality + freshness encoding on pillars" --body "$(cat <<'EOF'
## Summary
Encodes each region's data-quality bucket (measured / anchored / estimated) and a stale-feed alarm onto the globe, using data already on regionData (confidenceTier / sourceStatus).

- Pillar opacity: measured 1.0 / anchored 0.8 / estimated 0.62 (fuel hue preserved).
- Base dot: solid (measured) / ringed (anchored) / hollow (estimated).
- Degraded (>24h stale live feed): fuel hue kept, amber dashed warning ring.
- Theme-aware HTML legend, collapsible on mobile.

Spec: docs/superpowers/specs/2026-06-07-globe-quality-encoding-design.md

## Test plan
- [x] region-quality helper unit tests (bucket/opacity/dot-style/degraded precedence)
- [x] npm run typecheck + npx vitest run green
- [x] Preview screenshots: 3 buckets distinguishable; estimated still visible; degraded amber ring; both themes; mobile legend collapse

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Notes for the executor

- **Commit trailer:** end each commit message with `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>` (already in the commands above).
- **No data-integrity gates** apply — this change touches no tiers, regions, or snapshots. `typecheck` + `vitest` + visual preview are the verification.
- **Tuning lives in Task 5:** the opacity factors and dot radii in `region-quality.ts` / `globe.js` are starting values; adjust against real screenshots before opening the PR. Keep the measured/anchored/estimated ordering monotonic.
- **Do not** commit the temporary `degraded` snapshot edit from Task 5 Step 3.
