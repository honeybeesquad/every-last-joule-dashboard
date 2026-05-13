import { computeBounds } from "./uncertainty.js";
import { sourceProvenanceForRegion } from "./source-provenance.js";
import type { RegionData } from "./types.js";

/**
 * Scale a single RegionData into a named sub-region by a fixed ratio.
 * Profiles, totals, peak, and latestProfile all scale linearly.
 */
export function splitRegion(
  source: RegionData,
  newId: string,
  ratio: number,
  note?: string,
): RegionData {
  const scaleArr = (arr: number[]) => arr.map((v) => v * ratio);
  const scaleNullableArr = (arr: number[] | null) => (Array.isArray(arr) ? scaleArr(arr) : arr);
  const sourcePeakGW = source.peakGW ?? 0;
  const newPeakGW = sourcePeakGW * ratio;
  const tier = source.confidenceTier;
  const observedStdGW = Number.isFinite(source.observedStdGW)
    ? source.observedStdGW! * (sourcePeakGW > 0 ? newPeakGW / sourcePeakGW : ratio)
    : undefined;
  const bounds = tier
    ? computeBounds(newPeakGW, tier, observedStdGW)
    : { uncertaintyLowGW: undefined, uncertaintyHighGW: undefined };

  return {
    ...source,
    regionId: newId,
    sourceProvenance: sourceProvenanceForRegion(newId) ?? source.sourceProvenance,
    profile: scaleArr(source.profile),
    latestProfile: scaleNullableArr(source.latestProfile),
    totalTWh: (source.totalTWh ?? 0) * ratio,
    peakGW: newPeakGW,
    ...(observedStdGW !== undefined ? { observedStdGW } : {}),
    uncertaintyLowGW: bounds.uncertaintyLowGW,
    uncertaintyHighGW: bounds.uncertaintyHighGW,
    sourceNote: note
      ? `${source.sourceNote ?? ""} | ${note}`
      : source.sourceNote,
  };
}
