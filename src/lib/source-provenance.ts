import { REGIONS } from "./regions.js";
import type { RegionData, SourceProvenance } from "./types.js";

const SOURCE_PROVENANCE_BY_ID: ReadonlyMap<string, SourceProvenance> = new Map(
  REGIONS.flatMap((region) =>
    region.sourceProvenance ? [[region.id, region.sourceProvenance]] : [],
  ),
);

function isRegionData(value: unknown): value is RegionData {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { regionId?: unknown }).regionId === "string" &&
    Array.isArray((value as { profile?: unknown }).profile)
  );
}

export function sourceProvenanceForRegion(regionId: string): SourceProvenance | undefined {
  return SOURCE_PROVENANCE_BY_ID.get(regionId);
}

export function stampRegionSourceProvenance<T extends RegionData>(region: T): T {
  if (region.sourceProvenance) return region;
  const sourceProvenance = sourceProvenanceForRegion(region.regionId);
  return sourceProvenance ? { ...region, sourceProvenance } : region;
}

export function stampSourceProvenance<T>(value: T): T {
  if (isRegionData(value)) {
    return stampRegionSourceProvenance(value) as T;
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return value;
  }

  const record = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  let touched = false;
  for (const [key, child] of Object.entries(record)) {
    if (isRegionData(child)) {
      const stamped = stampRegionSourceProvenance(child);
      out[key] = stamped;
      touched ||= stamped !== child;
    } else {
      out[key] = child;
    }
  }
  return (touched ? out : value) as T;
}
