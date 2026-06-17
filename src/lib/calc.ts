import type { RegionData, CBECIData, AggregateResult } from "./types";

/** ASIC efficiency assumption for the primary headline readout. */
export const ASIC_JPER_TH = 16;
export type DashboardMode = "avg30d" | "last24h";

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

export function regionGWAtHour(data: RegionData, utcHour: number, mode: DashboardMode = "avg30d"): number {
  // Defensive: a region whose loader data hasn't resolved (cold-load race on the
  // slowest FileAttachments) arrives here undefined via aggregateAtHour's
  // Object.entries(regionData) / the timeline. Reading .latestProfile/.profile
  // on undefined throws and kills the clock tick → blank globe. Contribute 0
  // instead; the region rejoins when Observable re-runs with resolved data.
  if (!data) return 0;
  const profile = mode === "last24h" && Array.isArray(data.latestProfile)
    ? data.latestProfile
    : data.profile;
  if (!profile || profile.length === 0) return 0;
  // Linearly interpolate between floor and ceil hour so pillar heights
  // tween smoothly across the day instead of popping on the hour.
  const wrapped = ((utcHour % 24) + 24) % 24;
  const lo = Math.floor(wrapped) % 24;
  const hi = (lo + 1) % 24;
  const t = wrapped - Math.floor(wrapped);
  const a = profile[lo] ?? 0;
  const b = profile[hi] ?? 0;
  return Math.max(0, a * (1 - t) + b * t);
}

/** Aggregate across all regions at a specific UTC hour. */
export function aggregateAtHour(
  regionData: Record<string, RegionData>,
  cbeci: CBECIData,
  utcHour: number,
  mode: DashboardMode = "avg30d",
): AggregateResult {
  const perRegionGW: Record<string, number> = {};
  let totalGW = 0;
  for (const [id, data] of Object.entries(regionData)) {
    const gw = regionGWAtHour(data, utcHour, mode);
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
  cbeci: CBECIData,
  mode: DashboardMode = "avg30d",
): AggregateResult[] {
  return Array.from({ length: 24 }, (_, h) => aggregateAtHour(regionData, cbeci, h, mode));
}
