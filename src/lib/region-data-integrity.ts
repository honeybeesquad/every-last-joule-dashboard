import type { Region, RegionData } from "./types.js";

export interface RegionDataIntegrityIssues {
  missing: string[];
  extra: string[];
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

  return { missing, extra };
}

export function assertCanonicalRegionData(
  regionData: Record<string, RegionData>,
  regions: readonly Region[],
): void {
  const { missing, extra } = findRegionDataIntegrityIssues(regionData, regions);
  if (missing.length === 0 && extra.length === 0) return;

  const parts = [];
  if (missing.length) parts.push(`missing: ${missing.join(", ")}`);
  if (extra.length) parts.push(`extra: ${extra.join(", ")}`);
  throw new Error(`RegionData does not match canonical REGIONS (${parts.join("; ")})`);
}
