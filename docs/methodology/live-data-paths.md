# Live-data path patterns — measured-DD vs live-shape × rate proxy

Last updated: 2026-04-26 · Owner: Claude (BRRRRR mode reconciliation finding) · Paper sections: §2.2 Live-data path; §2.4 Calibration anchors; §4.2 Validation against publisher anchors.

## Why this exists

Phase 2.6 (commit `82b5496`, merged at `7b995b1` on 2026-04-26) promoted Ireland (`ireland-republic`, `northern-ireland`), Peru (`peru`), and South Africa (`south-africa`) from T3 probe-only-static back to T1a-live-tso. All four regions now emit live, measured snapshots from real upstream feeds — but they get there via **two methodologically distinct paths**, and a Scientific Data reviewer is going to ask which one a given region uses and why both count as T1a.

This doc names the two paths, lists every currently-live region under each, and documents the rule for when the second path is and is not acceptable as T1a. It also tags the resolution of an inline-comment contradiction in `scripts/lib/tier-resolution.ts` that survived the Phase 2.6 promotion: the table comments still described those regions as "demoted to static, probe-only" until this commit cleaned them up.

## The two paths

### Path A — measured dispatch-down (gold standard)

The TSO publishes its own dispatch-down register, and the loader consumes that register directly. The hourly profile is what the TSO told the public it actually curtailed. No external rate, no anchor multiplication, no inferred shape.

Loader pattern:

1. `probe()` — verify the publisher endpoint is reachable.
2. Fetch the published dispatch-down series (CSV, XML, JSON, or downloadable workbook) for the trailing 30 days, half-hourly or hourly.
3. Parse to `CurtailmentPoint[]` with no scaling.
4. Compose the `RegionData` via `timeOfDayAverageGW`, `totalTWh30d`, `peakGW`, `latestCompleteUtcDayProfileGW`.
5. Wrap in `withFallback({ regionTier: "live", … })` so the snapshot carries `confidenceTier: "T1a-live-tso"`.

The validation question — "is the dataset's monthly rollup close to the publisher's annual figure?" — reduces to "did we sum the publisher's own data correctly?" The Δ% in Figure 2 of the paper is bounded by aggregation/timezone arithmetic, not by methodology.

Reference loaders: `src/data/germany.json.ts` (ENTSO-E A75), `src/data/ontario.json.ts` (IESO XML), `src/data/north-sea.json.ts` (Elexon BMRS), `src/data/ireland.json.ts` (EirGrid/SONI DD-HH workbook).

### Path B — live renewable-generation shape × external calibration rate

The TSO does not publish a dispatch-down series in any unauthenticated, machine-readable form. The loader instead fetches the live renewable-generation shape (wind + solar half-hourly MW) and multiplies it by a fixed calibration rate derived from a separate published annual curtailment anchor. The shape is real and live; the magnitude is rate-anchored.

Loader pattern:

1. `probe()` — verify the publisher endpoint is reachable.
2. Fetch live renewable generation MW (per-fuel half-hourly or hourly).
3. Multiply by a hard-coded calibration rate `r ∈ (0, 1)` chosen so that the 30-day rollup × 12 ≈ the published annual curtailment anchor for the region.
4. Compose `RegionData` from the resulting series.
5. Wrap in `withFallback({ regionTier: "live", … })` — same `T1a-live-tso` tier as Path A.

The calibration rate is a per-loader constant. It is documented in the loader's `sourceNote` and traces to a specific published number in `scripts/validation/external-anchors.json`.

Reference loaders:
- `src/data/peru.json.ts` — COES SINAC `GraficoTipoCombustible` POST endpoint. Live HÍDRICO + SOLAR + EÓLICA half-hourly generation × **2%** rate. The 2% is anchored to the ~0.8 TWh/yr published vertimiento (water-spill) figure for the Peruvian grid.
- `src/data/south-africa.json.ts` — Eskom Data Portal `Total_Hourly_Generation.csv`. Live wind + PV + CSP + other-RE × **12%** rate. The 12% is anchored to the SAREM 2025 / Eskom MTSAO October 2025 4,363 GWh renewable-curtailment figure.

## When is Path B acceptable as T1a?

A reviewer's first instinct is "Path B is just a live-shape × number; how is that not modelled? Why is it T1a?" The answer turns on three tests.

**Test 1 — the shape is real.** The hourly shape comes from a live, measured generation series, not from a typical-shape Gaussian or a calibrated wind-shape archetype. Curtailment in real grids is approximately proportional to renewable generation (more wind → more wind to curtail), so a generation-shape × constant is the correct first-order model. T3 modelled regions, by contrast, derive the shape from a typical-day archetype with no live element — that's the difference.

**Test 2 — the rate has a TSO-published numerator.** If the rate is back-derived from a number the TSO itself signed (like Eskom's MTSAO renewable-curtailment quantity), the rate is a TSO-provenance proxy. If the rate is back-derived from a third-party Ember/IRENA estimate, that's T2/T3 territory.

**Test 3 — Δ% vs anchor is bounded.** Because the rate was *chosen* to match the annual anchor, the validation Δ% is bounded by the noise in the live generation shape × any year-over-year drift in the underlying curtailment rate. Empirically, this bound has been < 15% for Peru and South Africa over the trailing 30-day window — within the T1a uncertainty band declared by `applyUncertainty(base, { regionTier: "live" })` (±15% / 2σ).

If all three tests pass, Path B counts as T1a. If any one fails, the loader belongs in T2 (calibrated annual) or T3 (modelled).

## When is Path B NOT acceptable as T1a?

Three failure modes turn Path B into something weaker than T1a:

1. **Shape is synthetic, not live.** If the loader falls back to `buildTypicalSolarRegion` or similar because the live endpoint is down, the result is no longer Path B — it's T3-modelled with a sourceNote claiming it was T1a. The `withFallback` cache must be honest about whether the snapshot was live-fetched or replayed from disk; this is enforced by `sourceStatus: "live" | "cached" | "fallback"` in the snapshot envelope.
2. **Rate has no TSO numerator.** If the only published curtailment number for a region is from Ember or IRENA — both of which derive curtailment econometrically from observed generation vs expected — then a Path-B loader is a **double-counted estimate**: the rate already encodes a generation-shape inference, and we then multiply it by another generation shape. That collapses to T2-calibrated, not T1a.
3. **Rate drifts year-over-year by > 30%.** If the TSO's published anchor for 2024 is materially different from 2023 (e.g. Eskom load-shedding regimes change the renewable-curtailment fraction), then the rate is not a stable constant and Path B becomes a 12-month-stale model. In that case the loader should publish a `rate_year` field and the validation script should check rate × 12 against the *correct year's* anchor.

The current Path-B loaders (Peru, South Africa) pass all three tests as of 2026-04-26. They are flagged for re-validation each time the upstream anchor is refreshed.

## Catalogue — currently-live T1a regions by path

The 66 regions resolving to `T1a-live-tso` (golden tally from `scripts/ci/golden/tier-counts.json`, after Phase 2.6) split as follows:

| Path | Count | Examples | Anchor type |
|---|---|---|---|
| **Path A — measured DD** | ~63 | Germany, France, Spain, UK North Sea, Ontario, AESO Alberta, AEMO sub-states, Brazil clusters, Ireland-republic, Northern-Ireland | TSO dispatch-down register, ENTSO-E A75, Elexon BMRS, etc. |
| **Path B — live-shape × rate proxy** | ~3 | Peru, South Africa, (any future loaders that fail to find a measured-DD endpoint and use a TSO-provenance annual anchor) | TSO-published annual curtailment quantity |

(The ~3 vs ~63 split is approximate because some loaders are hybrid — e.g. an A75 zone that occasionally falls back to a generation-shape × rate during transparency-platform outages. The full enumeration lives in each loader's `sourceNote`.)

## Implications for backfill validation

Path B regions need **two** validation checks per anchor refresh, not one:

1. **Anchor consistency** — the 12-month rolling sum of the loader's emitted profile, divided by the calibration rate, equals the underlying published renewable generation. (Sanity check on the multiplication.)
2. **Rate-vs-anchor consistency** — the loader's calibration rate × the underlying generation rolls up to the published annual curtailment anchor within ±15%. (Sanity check on the rate.)

Path A regions need only check 1: the rollup against the publisher's own annual.

The `scripts/validation/build_region_docs.py` runner is the right place to encode this — the per-region MD for a Path-B loader should surface the rate, the anchor, and both validation Δ%'s. Path-A docs surface the rollup Δ% only.

## Inline-comment cleanup (this commit)

The Phase 2.6 promotion (`82b5496`) wired the live loaders for Ireland, Peru, and South Africa, but it did not update the inline comments in `scripts/lib/tier-resolution.ts` that described those regions as "demoted live → static, probe-only." Those comments were dead code (the entries are only consulted when `Region.tier === "static"`, which it isn't), but they contradicted the on-disk snapshot tier and would mislead a future maintainer. This commit replaces them with current-state notes that explain why the entries are kept as fallback configuration in case the live upstream becomes inaccessible.

The cleanup was discovered while drafting the Phase 2.6 wave-2 dispatch brief (`docs/proposals/2026-04-26-phase-2-6-static-promotions-dispatch.md`) and surveying which of the still-T3 regions were good candidates for further Path-A loader work. The wave-2 brief targets regions where a measured-DD path exists; this doc clarifies that wave-2 is Path-A-first by intent, with Path-B reserved for cases where Path A is genuinely unavailable.

## Reviewer Q&A pre-emption

> **Q: Why is South Africa T1a if Eskom doesn't publish a dispatch-down series?**
> A: The loader fetches Eskom's own live renewable-generation hourly CSV and multiplies by a 12% calibration rate derived from Eskom's own MTSAO October 2025 publication. Both the shape source and the rate's numerator are TSO-provenance. See Path B / Test 2.

> **Q: How is Path B different from a T2 calibrated region?**
> A: T2 (`live-domestic-anchored`, `live-neighbour-anchored`) regions either (a) anchor against a domestic non-TSO publication, or (b) anchor against a neighbouring jurisdiction's TSO. Path B-T1a regions anchor against the same TSO that publishes the live shape. The provenance chain is shorter and the validation is tighter.

> **Q: Could the rate drift silently?**
> A: Yes — and the per-anchor refresh runbook (Q1 2027 for SAREM/MTSAO; quarterly for COES) is the mitigation. The CI gate `check-tally-golden` does not detect rate drift; the per-region MD's anchor-Δ% line does. A future CI gate will assert anchor-Δ% < 15% for every Path-B region; not yet implemented.

> **Q: Why didn't the original Phase 2.6 patch document this?**
> A: The patch was implementation-first; the methodology framing was tagged for later (the "later" is now). The brainstorming review of Phase 2.6 wave-2 surfaced the gap.

## Sources

- `src/data/ireland.json.ts`, `src/data/peru.json.ts`, `src/data/south-africa.json.ts` — current-tip loaders implementing Path A (Ireland) and Path B (Peru, South Africa).
- `data/snapshots/last-good/{ireland,peru,south-africa}.json` — 2026-04-26 01:56–01:57 UTC live snapshots; all carry `confidenceTier: "T1-live-TSO"` (legacy alias for `T1a-live-tso`; will migrate on next `npm run snapshot`).
- `scripts/lib/tier-resolution.ts` — STATIC_PROFILE_KIND now annotated to reflect current live status; entries retained as fallback profileKind.
- `docs/methodology/anchors.md` — anchor source taxonomy (TSO direct / agency synthesis / satellite / ad-hoc).
- `docs/methodology/uncertainty.md` — how `applyUncertainty` derives the ±15% / 2σ band for live-tso regions.
- Commit `82b5496` (`feat(phase-2.6): wire live loaders for Ireland, Peru, South Africa`) — the promotion that made this distinction relevant.
