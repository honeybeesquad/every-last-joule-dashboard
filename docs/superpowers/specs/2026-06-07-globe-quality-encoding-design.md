# Globe data-quality + freshness encoding — design spec

**Status:** DESIGN — awaiting user review
**Date:** 2026-06-07
**Branch:** `feat/globe-quality-encoding`

---

## 1. Problem

The globe renders every region's pillar identically regardless of how trustworthy or fresh the number is. A T3-modelled estimate looks exactly like a T1a live-measured feed, and a region whose live feed has been dead for days (`sourceStatus: "degraded"`) looks as current as one fetched this minute. The data to distinguish them is already on every `regionData` record (`confidenceTier`, `sourceStatus`) — the globe just ignores it. Since the entire credibility proposition of ELJ is the tier system, making it invisible in the primary view is the biggest representational gap, and silently showing stale data as live is the matching auditability gap.

## 2. Goals / non-goals

**Goals**
- Encode data *quality* (measured / anchored / estimated) on every pillar, legibly and at small scale during rotation.
- Flag genuinely *stale* live feeds (`degraded`) with an unmistakable, rare alarm.
- Provide a legend so a first-time visitor can decode both.
- Preserve the existing fuel-hue signal on the pillar body in all states.

**Non-goals (YAGNI / deferred)**
- A "verified-only" interactive filter (separate future feature).
- The broader "what is wasted energy / pillar height = GW" explainer (separate clarity item).
- Distinguishing T1a vs T1b vs T1c, or 25h-stale vs 3-week-stale, on the globe (the tooltip carries exact tier + status; the globe shows buckets).
- Any change to the data pipeline, loaders, or tiers.

## 3. The encoding

### 3.1 Quality buckets

A pure helper maps each region to one of three buckets from its `confidenceTier` (falling back to `region.tier`):

| Bucket | confidenceTier values | region.tier values |
|---|---|---|
| **measured** | `T1a-live-tso`, `T1b-live-domestic-anchored`, `T1c-live-neighbour-anchored`, legacy `T1-live-TSO` | `live`, `live-domestic-anchored`, `live-neighbour-anchored` |
| **anchored** | `T2-annual-calibrated`, `T2-flare` | `anchored` |
| **estimated** | `T3-modelled` | `estimated` |

(`T4-structural-gap` is never emitted in `RegionData`; if encountered, treat as `estimated`.)

### 3.2 Visual mapping

| Bucket | Pillar opacity factor | Base dot |
|---|---|---|
| measured | **1.0** | solid filled dot (current appearance) |
| anchored | **0.8** | filled dot + thin concentric ring |
| estimated | **0.62** | hollow ring (stroke only, no fill) |

- **Opacity** is applied by replacing the vestigial `pillarAlpha = 1` (globe.js:351) with the bucket factor, so it multiplies into the existing `visible` (horizon fade) × `sunDim` (night dimming) terms exactly where USD-mode opacity used to live. The factor applies to the glow, pillar body/segments, tip glow, and dot — the whole unit dims together.
- **Fuel hue is preserved** on the pillar body in every bucket (only brightness changes).
- **Dot** is the categorical readout that stays legible when opacity differences wash out at small scale or in motion. The dot's existing white stroke (`rgba(255,255,255,0.85)`) is retained for the solid and ringed forms; the hollow form is a stroke-only ring in the fuel colour.
- Exact opacity values and dot radii are **tuned on the live preview** during the build (screenshots per bucket); the values above are the starting point.

### 3.3 Degraded freshness alarm

- **Condition:** `data.sourceStatus === "degraded"` (live-tier feed whose last-good snapshot is >24h old).
- **Treatment:** the pillar **keeps its fuel hue** (so the renewable type stays readable), dims to estimated-level opacity (~0.62), and gains an **amber dashed ring** around the base dot — a marker no other state uses. Amber comes from a `--quality-warning` theme token (seeded from the existing `--amber-500`).
- **Static** — no pulsing/animation (respects `prefers-reduced-motion`, avoids clutter).
- `cached` (≤24h) and `live` get **no** freshness marker — only the genuine stale case alarms. The tooltip still shows exact `sourceStatus` text for any clicked region.
- **Precedence:** the degraded amber ring replaces the bucket dot (a degraded region is measured-tier but stale; the stale message wins on the dot). The opacity is estimated-level regardless of the underlying tier.

## 4. Legend

A compact, theme-aware **HTML/CSS** key (not canvas — real text for screen readers and zero render-loop cost), positioned in the bottom-left corner of the globe area:

- Three quality rows: solid dot → "Measured", ringed dot → "Anchored", hollow ring → "Estimated".
- One freshness row: amber dashed ring → "Stale feed".
- One caption line: "brighter = higher confidence".

On mobile (≤900px) it collapses to a tap-to-expand "ⓘ Legend" chip to preserve globe space. The legend re-reads theme tokens on `themechange` (or is pure CSS using the same custom properties, so it follows the theme automatically).

## 5. Implementation surface

| File | Change |
|---|---|
| `src/lib/region-quality.ts` (**new**) | Pure: `qualityBucket(region, data)` → `"measured"\|"anchored"\|"estimated"`; `qualityOpacity(bucket)`; `dotStyleFor(bucket, sourceStatus)` → `"solid"\|"ringed"\|"hollow"\|"degraded"`. No DOM/canvas deps. |
| `tests/region-quality.test.ts` (**new**) | Bucket mapping for every tier value; opacity values; dot-style incl. degraded precedence; T4/unknown → estimated fallback. |
| `src/globe.js` (**modify**) | Replace dead `pillarAlpha` with `qualityOpacity(bucket)`; branch the core-dot draw on `dotStyleFor(...)`; add the degraded amber-ring branch. Per-segment opacity on stacked pillars; the unit's dot reflects its representative region (`group[0]`). |
| `src/lib/theme-tokens.ts` (**modify**) | Read a `--quality-warning` amber token; expose on the tokens object. |
| `src/style.css` (**modify**) | `--quality-warning` for both Sunfire + Deepcurrent themes; legend styles + mobile collapse. |
| `src/index.md` (**modify**) | Legend markup in the globe area. |

The render loop stays the only consumer of the helper; the helper holds the mapping logic so it is unit-testable without a canvas.

## 6. Testing & verification

- **Unit:** `region-quality` helper — exhaustive bucket/opacity/dot-style mapping, degraded precedence, unknown-tier fallback.
- **Visual (preview, during build):** screenshot the globe and confirm — (a) the three buckets are distinguishable at rest and in rotation; (b) estimated pillars (>half the globe) remain visible, not gutted; (c) a seeded degraded region shows the amber ring; (d) the legend renders and is theme-correct in both Sunfire and Deepcurrent; (e) mobile legend collapses. Tune opacity/radii here.
- **Regression:** `npm test`, `npm run typecheck`. No data gates affected (no tier/region/snapshot changes).

## 7. Open questions

None blocking. Decisions locked with the user: degraded keeps fuel hue (amber ring is the alarm, no grey); `cached` gets no globe marker (binary freshness: degraded alarms, live/cached don't); 3 quality buckets, not 5 tiers.
