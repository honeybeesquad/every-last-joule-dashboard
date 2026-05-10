import type { Region, RegionData } from "./types.js";

export interface RegionDataIntegrityIssues {
  missing: string[];
  extra: string[];
  /** Keys whose values lack a valid 24-element `profile` array (Belgium-shape bug). */
  malformed: string[];
}

function hasValidProfile(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === "object" &&
    Array.isArray((value as Record<string, unknown>).profile) &&
    ((value as Record<string, unknown>).profile as unknown[]).length === 24
  );
}

export function findRegionDataIntegrityIssues(
  regionData: Record<string, RegionData>,
  regions: readonly Region[],
): RegionDataIntegrityIssues {
  const canonicalIds = new Set(regions.map((region) => region.id));
  const dataIds = new Set(Object.keys(regionData));

  const missing = regions
    .map((region) => region.id)
    .filter((id) => !dataIds.has(id));

  const extra = [...dataIds]
    .filter((id) => !canonicalIds.has(id))
    .sort();

  // Only check shape for keys that are in both canonical and data sets.
  // Missing keys are already reported; extra keys are not canonical so skip them.
  const malformed = regions
    .map((region) => region.id)
    .filter((id) => dataIds.has(id) && !hasValidProfile(regionData[id]))
    .sort();

  return { missing, extra, malformed };
}

export function assertCanonicalRegionData(
  regionData: Record<string, RegionData>,
  regions: readonly Region[],
): void {
  const { missing, extra, malformed } = findRegionDataIntegrityIssues(regionData, regions);
  if (missing.length === 0 && extra.length === 0 && malformed.length === 0) return;

  const parts = [];
  if (missing.length) parts.push(`missing: ${missing.join(", ")}`);
  if (extra.length) parts.push(`extra: ${extra.join(", ")}`);
  if (malformed.length) parts.push(`malformed: ${malformed.join(", ")}`);
  throw new Error(`RegionData does not match canonical REGIONS (${parts.join("; ")})`);
}
