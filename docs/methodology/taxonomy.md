# Region taxonomy — two orthogonal axes, not three pillars

Last updated: 2026-04-25 · Owner: Claude (council finding N2) · Paper sections: §1 Background and Summary, §2 Methods.

## Why this exists

Council finding (Reality Checker, Software Architect): the paper draft and the dashboard methodology rhetoric occasionally use "three pillars" shorthand for the dataset's structure — *renewable curtailment, flared gas, structural gap*. The shorthand is informal jargon that conflates two orthogonal questions:

1. **What kind of wasted energy is this?** (Renewable curtailment? Associated-gas flare? Hydro spill?)
2. **Did we publish a series for it, or did we explicitly not publish?** (Emitted in the dataset, or documented gap?)

Treating these as a single three-way enum forces edge cases. *Iran's flaring* would be both flare-kind AND structural-gap (no GGFR-equivalent quality), which doesn't fit "three pillars" cleanly. *Brazil NE solar curtailment* is renewable-kind AND emitted, which is the same pillar as Germany — yet Germany's data path is fundamentally different (TSO-published vs ONS plant-cluster aggregation).

This document replaces "three pillars" with a 2-axis taxonomy that is:
- Orthogonal (the two axes don't bleed into each other)
- Comprehensive (every current region fits one cell)
- Future-extensible (new combinations are nameable, not surprises)
- Aligned with the existing codebase (uses `regionTier`, `kind`, and a new `coverage_status`)

## The two axes

### Axis 1 — `source_kind`

What the wasted energy *physically is*. Already encoded in `regions.ts` as `kind`, with three current values plus a proposed extension:

| Value | Definition | Current regions |
|---|---|---|
| `curtailment-renewable` | Wind, solar, or run-of-river hydro dispatched-down by the TSO. The energy was generable but the grid refused it. Hourly shape follows the underlying resource. | All wind/solar/mixed regions: 124 of 128 (most of `regions.ts`). |
| `flare-associated-gas` | Methane burned at oil wellheads, with no power-generation infrastructure attached. Hourly shape is flat 24/7 because flaring is a continuous disposal mode tied to crude production. | 4 regions: `permian` (USA), `w-siberia` (RUS), `s-iraq` (IRQ), `e-saudi` (SAU). |
| `spill-hydro-reservoir` | Reservoir water released over a spillway because the head storage filled. Treated as 0% in the current dataset (these events are rare and short-lived) but the kind exists for taxonomic completeness. Use case: Norway 2020 flood-spill, BC Hydro spring freshet. | 0 regions today; reserved for future use. |
| `mixed` | Two or more of the above lumped because the upstream feed does not separate them. The dataset uses this for ENTSO-E zones where dispatch-down is reported as one number. | The vast majority of `kind: "mixed"` entries in `regions.ts`. |

In `regions.ts` today, `kind` takes values `wind`, `solar`, `mixed`, `flare`, `hydro-seasonal`. The first three are sub-types of `curtailment-renewable`; `flare` is exactly `flare-associated-gas`; `hydro-seasonal` is also `curtailment-renewable` (run-of-river or seasonal-hydro modulation, not reservoir spill). No code change is required to align with this axis — the existing `kind` field already encodes it; this doc just labels the categories formally.

### Axis 2 — `coverage_status`

Whether the dataset emits a series for a region, or explicitly documents the absence. New field; low-cost to add.

| Value | Definition | Current regions |
|---|---|---|
| `published` | The dataset emits an hourly series + an annual rollup for this region. Every T1, T2, T3, and flare region is here. | 128 of 128 emitted regions. |
| `documented-gap` | A region that *would* be in scope but for which we have no defensible upstream. We document the gap (`docs/known-limitations.md`) and the annual anchor where one exists, but emit no hourly series. The dataset's claim about that region is "we know this matters; here's why we did not publish; here's what to ask for if you can find a source." | Documented in `docs/known-limitations.md` but not in the parquet — Mexico CENACE, Egypt EETC pre-2024, plus the 8 Chinese provinces only when their typical-shape inference is rejected. |
| `out-of-scope` | A region we don't claim to cover at all (e.g. Antarctica, small island nations < 50 MW total renewable capacity). Dataset is silent. | Not enumerated; assumed. |

The existing `regionTier` enum (`live`, `static`, `flare`) and the derived `confidenceTier` (`live-tso`, `annual-calibrated`, `modelled`, `flare-flat`) describe *how confidently we know the value within a published region*. They are downstream of `coverage_status` and orthogonal to `source_kind`. A `published` region can be live-tso or modelled; a `documented-gap` region has neither, by definition.

## The matrix

The full grid (axes × axes) makes the structure visible:

| | `published` | `documented-gap` | `out-of-scope` |
|---|---|---|---|
| **`curtailment-renewable`** | 124 regions: every live ENTSO-E/EIA/AEMO/Elexon zone, every T2 calibrated, every T3 modelled (China provinces, sub-Saharan, Mid East non-flare, etc.) | Mexico CENACE, Egypt 2024+, parts of SE Asia, parts of Africa not yet modelled | Antarctica, Vatican, Greenland (~all baseload thermal/diesel) |
| **`flare-associated-gas`** | 4 regions: `permian`, `w-siberia`, `s-iraq`, `e-saudi` | Iran flaring (~17 Bcm/yr per IEA, > Russia by some accounts but no public hourly disaggregation), parts of Algeria/Libya | Small flares < 1 Bcm/yr |
| **`spill-hydro-reservoir`** | 0 today | Norway 2020 spring spill (event-level, not series); Three Gorges spill events | Most regions; reservoir spill is rare |

The matrix is the right level of detail for the paper's §1 Background/Summary. Three rows × three columns = 9 cells; each is a sentence to describe. Every region resolves to one cell. The "three pillars" rhetoric, by contrast, leaves Iran and Norway-spill un-categorised.

## Mapping to existing fields

Today, the codebase already encodes a partial form of these axes:

| Concept | Current field(s) | Gap |
|---|---|---|
| `source_kind` | `regions.ts.kind` ∈ `{wind, solar, mixed, flare, hydro-seasonal}` | Subtypes of curtailment-renewable are conflated with the renewable/flare distinction. Acceptable for now; v3 could promote `kind` to a 2-tuple `(family, subkind)`. |
| `coverage_status: published` | Implicit — regions in `regions.ts` are published by definition. | Need explicit field for paper Figure 4 and Usage Notes. |
| `coverage_status: documented-gap` | Listed in `docs/known-limitations.md` numbered items. | Not machine-readable. Proposed: `docs/known-limitations.md` gains a YAML front-matter block listing each documented gap with structured fields (`region_id`, `kind`, `reason`, `anchor`). |
| `coverage_status: out-of-scope` | Not encoded. Implicit by absence. | Acceptable — by definition, every region a paper mentions is in scope. |
| `confidenceTier` | `confidenceTier` in snapshots, derived from `regionTier` + `profileKind` | Orthogonal — already correct. |

Concrete proposed deltas in this PR class:

1. **Add `coverage_status` to `regions.ts`.** Default `"published"` for all current entries; the field exists so future entries can be `"documented-gap"` if we add metadata-only stubs to support paper figures.
2. **Promote `docs/known-limitations.md` items 11–14 (the gap items) to structured form.** A small YAML block at the top of each item, parseable by `scripts/validation/build_region_docs.py`, listing affected regions and why.
3. **Update paper §1 to use the matrix vocabulary explicitly.** Drop the "three pillars" phrasing in `01-background-and-summary.md` and `02-methods.md`. Replace with: "By source kind: 124 renewable-curtailment regions and 4 associated-gas-flare regions. By coverage status: all 128 published; an additional N regions are listed as documented gaps (`docs/known-limitations.md`)."

## Naming choice — why "axes" not "pillars"

"Pillars" implies parallel, independent supports — but the current rhetoric pairs *unrelated* facts (curtailment vs flare is a kind question; "structural gap" is a coverage question). They aren't parallel; they aren't even on the same axis.

"Axes" is the right metaphor because:
- The two questions ARE orthogonal.
- A region's place in the dataset is a coordinate, not a category.
- Future extension (e.g. `spill-hydro-reservoir`) plugs in cleanly as another value along axis 1, not a new "pillar."
- Reviewers from physics/data-science backgrounds parse "axes" without ambiguity; "pillars" reads as marketing rhetoric.

## What stays as "pillar"

The dashboard's *visual* pillars (the rendered globe element) keep the name "pillar" — it's a literal description of the 3D shape of a hotspot. The methodology-level rhetoric is what gets cleaned up.

Specifically:
- Keep: "pillar" in `mockups/pillar-concept.html`, `src/globe.js` rendering code, the visual.
- Drop: "three pillars" framing in paper §1 and §2.
- Replace: methodology paragraphs use "two-axis taxonomy: source kind × coverage status".

## Implementation diff (for follow-up)

This is a Phase-3 nice-to-have, not a blocker. When picked up:

1. **`src/lib/regions.ts`** — extend `Region` type with `coverage_status: "published"` (literal default for all current entries). One-line addition per region.
2. **`docs/known-limitations.md`** — add YAML front-matter block to each documented-gap item with `affected_regions: [...]`, `reason`, `anchor`.
3. **`docs/paper/01-background-and-summary.md`** — rewrite "Three aspects set this work apart" para to cite the two-axis taxonomy explicitly. Use the matrix view in a one-row caption.
4. **`docs/paper/02-methods.md`** — replace "structural gap (T4)" framing (which tangles a coverage question with a tier question) with "documented-gap regions (T4 was a misnomer; T-prefix is reserved for confidence tiers within published regions)."
5. **`scripts/tally-tiers.ts`** — extend output to print the matrix counts: `published × curtailment-renewable: 124`, `published × flare-associated-gas: 4`, etc.
6. **`docs/methodology/uncertainty.md`** — clarify that confidence tiers are downstream of `coverage_status: published`. T1/T2/T3/flare-flat all sit inside the `published` row of the matrix.

## Open question — handling `T4`

Council finding (N1, separately): the current "T4 ±20% structural-gap envelope" rhetoric in the README and figure captions is wrong because T4 regions emit no series, so there is nothing to assign an envelope to. This taxonomy makes the resolution clear:

- **`T4` is not a confidence tier.** It was a paper-draft shorthand for "documented-gap." The taxonomy renames it: regions previously called T4 are now `coverage_status: documented-gap`, and they have no `confidenceTier` because they have no emitted values to tier.
- **Drop `T4 ±20%`** from all rhetoric. (Handled by GEMINI-1 / N1.)
- **Confidence tier enum** is `{live-tso, annual-calibrated, modelled, flare-flat}`. No T4 entry.

This fully resolves N1 alongside N2.

## Acceptance criteria

This is a methodology-decision doc; "implementation" is editorial across the listed files. Considered done when:

1. `docs/paper/01-background-and-summary.md` and `docs/paper/02-methods.md` no longer contain the phrase "three pillars" (or its variants).
2. The matrix view appears once in §1 and is referenced from §2.
3. `regions.ts` has `coverage_status: "published"` on every entry.
4. `docs/known-limitations.md` items 11–14 each carry the YAML structured block.
5. `tally-tiers.ts` output includes a "Matrix view" footer.
6. `docs/methodology/uncertainty.md` references `taxonomy.md` for the kind × coverage axes.

These edits are small (≤ 1 hour total). Suitable for Gemini once N1 and B2/B3 land (avoids merge conflicts in `docs/paper/*`).

## Status

| Step | Owner | Status |
|---|---|---|
| Taxonomy decision | Claude | ✅ this doc |
| `regions.ts.coverage_status` field | Codex | not dispatched (small) |
| Paper §1 + §2 rewrite | Gemini | post-N1 (avoids merge conflict) |
| `known-limitations.md` YAML | Gemini | bundled with paper rewrite |
| `tally-tiers.ts` matrix footer | Codex | bundled with S4 implementation |
