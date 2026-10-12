import type { RegionData } from "./types.js";

/**
 * Does this build carry a reading for the region? Yes when it has a record
 * that is not `degraded`.
 *
 * `degraded` means the region's loader failed and is serving a record past
 * its freshness window, or (an ENTSO-E fallback marker) nothing at all. A
 * region missing from the build reports nothing either. `cached` still
 * counts: it is a recent last-good record, or a modelled region recomputed
 * this build.
 *
 * Nothing about waste: an `unpublished` generation-only grid reports when
 * its generation arrives. Waste is counted by countPublishedWasteRegions.
 */
export function isReporting(data?: RegionData | null): boolean {
  return !!data && data.sourceStatus !== "degraded";
}

/**
 * How many roster regions report in this build: the dashboard's
 * "N reporting" figure, next to the roster's size (`REGIONS.length`).
 *
 * From 29 Sep to 12 Oct 2026 six builds lost the ENTSO-E loader to its
 * deadline: 18 zones vanished from the build and 54 more served June's
 * data as `degraded`, while the page still said 536. Recomputed from
 * curtailment_history.parquet, this figure would have read 429 to 454 on
 * those builds, against about 500 to 526 on the healthy builds around them.
 */
export function countReportingRegions(
  regionData: Record<string, RegionData | null | undefined>,
  regionIds: readonly { id: string }[],
): number {
  return regionIds.reduce((n, r) => n + (isReporting(regionData[r.id]) ? 1 : 0), 0);
}
