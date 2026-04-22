import type { RegionData, CBECIData, AggregateResult } from "./types";

/** ASIC efficiency assumption for the primary headline readout. */
export const ASIC_JPER_TH = 16;

/**
 * Convert continuous power P (GW) to supportable hashrate (EH/s) at the
 * given ASIC efficiency in J/TH.  Derivation:
 *   P [GW] = 1e9 W = 1e9 J/s
 *   hashrate [TH/s] = (1e9 J/s) / (eff J/TH) = 1e9 / eff TH/s
 *   hashrate [EH/s] = (1e9 / eff) / 1e6 = 1000 / eff
 * Therefore GW * (1000 / eff) = EH/s.
 */
export function ehsFromGW(gw: number, effJperTH: number = ASIC_JPER_TH): number {
  if (gw <= 0) return 0;
  return gw * (1000 / effJperTH);
}

/** Aggregate across all regions at a specific UTC hour. */
export function aggregateAtHour(
  regionData: Record<string, RegionData>,
  cbeci: CBECIData,
  utcHour: number
): AggregateResult {
  const perRegionGW: Record<string, number> = {};
  let totalGW = 0;
  for (const [id, data] of Object.entries(regionData)) {
    const gw = Math.max(0, data.profile[utcHour] ?? 0);
    perRegionGW[id] = gw;
    totalGW += gw;
  }
  const hashrateEHps = ehsFromGW(totalGW);
  const pctOfNetwork = cbeci.hashrateEHps > 0
    ? (hashrateEHps / cbeci.hashrateEHps) * 100
    : 0;
  return { utcHour, totalGW, hashrateEHps, pctOfNetwork, perRegionGW };
}

/** Aggregate across all regions for every UTC hour 0..23. */
export function perHourAggregate(
  regionData: Record<string, RegionData>,
  cbeci: CBECIData
): AggregateResult[] {
  return Array.from({ length: 24 }, (_, h) => aggregateAtHour(regionData, cbeci, h));
}
