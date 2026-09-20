import type { RegionData, WasteStatus } from "./types.js";

export const WASTE_STATUS_VALUES = ["measured", "measured-zero", "unpublished"] as const;

export function isWasteStatus(value: unknown): value is WasteStatus {
  return value === "measured" || value === "measured-zero" || value === "unpublished";
}

/** Legacy snapshots omit the field; treat them as waste-displayable. */
export function wasteStatusOf(data?: RegionData | null): WasteStatus | undefined {
  return data?.wasteStatus;
}

/**
 * Waste pillars render for measured waste (including measured zeros) and for
 * legacy snapshots. Unpublished waste is generation-only: never a pillar.
 */
export function showsWastePillar(data?: RegionData | null): boolean {
  if (!data) return false;
  return data.wasteStatus !== "unpublished";
}

/** TSO-collected claim: generation is a first-class 24-hour profile. */
export function isTsoCollected(data?: RegionData | null): boolean {
  return Array.isArray(data?.generationProfile) && data.generationProfile.length === 24;
}

/**
 * How many regions actually publish waste — the number the dashboard's lead
 * copy is entitled to claim curtailment "across".
 *
 * NOT `REGIONS.length`. Since the TSO-grid completeness work, the roster also
 * carries grids we track for generation while their operator publishes no
 * waste at all (`wasteStatus: "unpublished"`). Counting those in a sentence
 * about wasted energy would assert curtailment this project has explicitly
 * declined to invent — the same failure as calling a modelled figure measured.
 *
 * Legacy snapshots omit `wasteStatus` and count, matching `showsWastePillar`:
 * a region absent from the payload entirely does not.
 */
export function countPublishedWasteRegions(
  regionData: Record<string, RegionData | null | undefined>,
  regionIds: readonly { id: string }[],
): number {
  return regionIds.reduce((n, r) => n + (showsWastePillar(regionData[r.id]) ? 1 : 0), 0);
}

export function unpublishedEmptyRegion(
  regionId: string,
  sourceNote: string,
  lastUpdated = new Date().toISOString(),
): RegionData {
  return {
    regionId,
    profile: Array(24).fill(0),
    latestProfile: null,
    totalTWh: 0,
    peakGW: 0,
    lastUpdated,
    lastSuccessAt: lastUpdated,
    sourceNote,
    wasteStatus: "unpublished",
    generationProfile: Array(24).fill(0),
    generationTotalTWh: 0,
  };
}
