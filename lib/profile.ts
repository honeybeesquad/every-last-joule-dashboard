import type { CurtailmentPoint } from "./types";

/**
 * Bucket points by their UTC hour-of-day and return the average MW per hour,
 * converted to GW. Output length is always 24.
 * Intended to smooth noise in sub-hourly data across a 30-day window.
 */
export function timeOfDayAverageGW(points: CurtailmentPoint[]): number[] {
  const sums = new Array(24).fill(0);
  const counts = new Array(24).fill(0);
  for (const p of points) {
    const hour = new Date(p.utcTimestamp).getUTCHours();
    sums[hour] += p.mw;
    counts[hour] += 1;
  }
  return sums.map((sum, i) => (counts[i] > 0 ? sum / counts[i] / 1000 : 0));
}

/**
 * Total TWh observed across the supplied points, assuming each point
 * represents one hour's worth of MW.  Caller is responsible for providing
 * points at the correct cadence (5-min points should be pre-aggregated
 * to hourly or have their MW scaled accordingly).
 *
 * Simpler model used by v0 loaders: each loader outputs hourly averages
 * from sub-hourly source data before calling here.
 */
export function totalTWh30d(points: CurtailmentPoint[]): number {
  const mwh = points.reduce((sum, p) => sum + p.mw, 0);
  return mwh / 1_000_000; // MWh -> TWh
}

/** Peak GW observed across any hour bucket in the averaged profile. */
export function peakGW(points: CurtailmentPoint[]): number {
  const profile = timeOfDayAverageGW(points);
  return Math.max(0, ...profile);
}
