import type { Region, RegionData } from "./types.js";
import { assertCanonicalRegionData } from "./region-data-integrity.js";
import { maskSolarNight } from "./solar-mask.js";
import { applyUncertainty } from "./uncertainty.js";

/**
 * Shared region-data finalize pipeline, factored out of the duplicated tails of
 * `src/index.md` and `src/embed/globe.md`. The two copies had already drifted:
 * embed still called the integrity check *fatally* — the exact "stuck loading"
 * crash that #224 made non-fatal for index.md. Centralising here fixes that and
 * keeps the two pages from diverging again.
 *
 * Three passes over the assembled `regionData` (mutated in place, then returned):
 *
 *   1. Canonical-shape integrity check — **non-fatal** (logs, never throws).
 *      Loaders can still be resolving at page init, so a hard throw would halt
 *      the whole dashboard. Surface for monitoring, but always render. (#224.)
 *   2. Solar-night masking — zero out sub-horizon hours for `kind: "solar"`
 *      regions. Several grid feeds (CAISO, PJM, MISO, SPP, NYISO, ERCOT, BPA)
 *      report a non-zero "solar" floor at local night; curtailment outside
 *      daylight is physically impossible.
 *   3. Defensive uncertainty back-fill — for any region a loader left without a
 *      `confidenceTier`.
 *
 * Note: the old inline copies computed `profileKind` via
 * `region.tier === "static" ? … : undefined`, but `"static"` was retired as a
 * tier in PR #88 (so the branch was unreachable) and `applyUncertainty` derives
 * the tier solely from `regionTier` (`profileKind` is unused). The dead branch
 * is dropped here with no behavioural change.
 */
export function finalizeRegionData(
  regionData: Record<string, RegionData>,
  regions: readonly Region[],
): Record<string, RegionData> {
  // 1. Integrity check — non-fatal (see #224).
  try {
    assertCanonicalRegionData(regionData, regions);
  } catch (err) {
    console.error("[region-data-integrity]", (err && (err as Error).message) || err);
  }

  // 2. Solar-physics correction.
  for (const region of regions) {
    if (region.kind !== "solar") continue;
    const data = regionData[region.id];
    if (!data?.profile) continue;
    data.profile = maskSolarNight(data.profile, region.lon);
    if (Array.isArray(data.latestProfile)) {
      data.latestProfile = maskSolarNight(data.latestProfile, region.lon);
    }
    data.peakGW = Math.max(...data.profile);
  }

  // 3. Defensive uncertainty back-fill.
  for (const region of regions) {
    const d = regionData[region.id];
    if (!d) continue;
    if (d.confidenceTier) continue; // preserve tier already set by loader
    console.warn(
      `[uncertainty] late-binding tier for ${region.id} (kind=${region.kind}); loader should set this upstream`,
    );
    regionData[region.id] = applyUncertainty(d, { regionTier: region.tier });
  }

  return regionData;
}
