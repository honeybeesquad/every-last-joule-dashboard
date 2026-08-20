## Summary

Two defects found during a code review, both fixed with tests. An independent Claude Code review then caught a deeper root-cause in fix #2 (see below).

**1. T3-modelled regions were stamped `sourceStatus: "live"`** (src/lib/resilient.ts)
`stampLive` stamped every successful fetch as `live`, including T3-modelled regions whose payload is a typical-shape profile scaled to an anchor — not a live fetch. This also caught the ~75 loaders that swallow a live-fetch error and return a modelled fallback; `withFallback` would otherwise stamp that fallback `live`, lighting the "live" dot on the globe for data never fetched live. Violates the repo's honesty contract (CLAUDE.md rule 3 / AGENTS.md data-contract boundaries).
Fix: T3-modelled regions are now stamped `"cached"` (modelled proxy computed this build).

**2. Mexico's profile / totalTWh did not integrate to its anchor** (src/data/mexico.json.ts)
`RegionData.totalTWh` is the trailing-30-day cumulative (tooltip "30d total"), and the rendered `profile` should integrate to the same energy. Original code emitted the full *annual* anchor into `totalTWh` (~12x too large) **and** spread it across the 24h shape without normalizing by `shapeSum` (unlike `typical-profiles.ts:scaleProfileToAnnualTWh`), so the curve integrated to `annual × mean(shape)` (~40% of the anchor). The first pass fixed only the `totalTWh` line — leaving the curve reading ~2.5x what the tooltip number claimed (CLAUDE.md rule 4: keep your own numbers consistent).
Fix: `buildPoints` now normalizes by `shapeSum` (profile integrates to exactly the annual anchor), and `totalTWh` is derived from the points (`totalTWh30d(points) × 30`) so the number can never drift from the curve. Numerically verified: solar/wind `totalTWh` == `annual × 30/365` and the curve's 30-day integral matches to 1e-9 TWh.

## Changes
- src/lib/resilient.ts — stampLive keeps T3-modelled as `"cached"`.
- src/data/mexico.json.ts — `buildPoints` normalizes by `shapeSum`; `totalTWh` derived from points (`*30`); drop the now-unused `shape` param / dead `totalTWh30d` local.
- tests/resilient.test.ts — T3-modelled stamped cached; plus: live T1a stays live (negative), T3-already-degraded stays degraded (ordering), mixed multi-region payload downgrades only the T3 sub-region.
- tests/data/mexico.test.ts — totalTWh both equals `annual × 30/365` AND matches the rendered profile's 30-day integral (the consistency assertion that catches an un-normalized shape).

## Verification (all green before push)
- tsc --noEmit — pass
- vitest run — 1082 passed (1079 existing + 3 new)
- ci:check-tier-coherence — pass
- ci:check-tally-golden — pass
- ci:loader-stdout-safety — pass
- ci:check-source-provenance-coherence — pass

## Note on snapshots
The committed data/snapshots/last-good/*.json T3 files still carry a stale `"live"` stamp from the old code. They self-correct on the next scheduled data-refresh build (the loader re-emits them with the corrected status), so they are intentionally NOT hand-edited here — editing 249 generated files directly is the "blindly keep generated snapshot diffs" trap the repo's AGENTS.md warns against.

## Follow-ups (not in this PR)
- Consider rethrowing (or explicitly setting `sourceStatus`) in the ~75 loaders that swallow live-fetch errors and return modelled fallbacks, so a dead feed is visible in `sourceStatus` rather than relying solely on the confidenceTier/provenance checks here.
- A shared EIA/ENTSO-E/XML loader base would shrink the per-region copy-paste surface (likely preventing bug #2's class).
