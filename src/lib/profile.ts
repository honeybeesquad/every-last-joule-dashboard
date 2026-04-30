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
 * Return the most recent complete UTC-day profile as 24 GW values.
 * Points are bucketed to UTC hours first, so sub-hourly source cadence becomes
 * an hourly average. Missing any hour for a day makes that day ineligible.
 */
export function latestCompleteUtcDayProfileGW(points: CurtailmentPoint[]): number[] | null {
  const hourly = new Map<string, { sum: number; count: number }>();
  for (const p of points) {
    const d = new Date(p.utcTimestamp);
    if (Number.isNaN(d.getTime())) continue;
    d.setUTCMinutes(0, 0, 0);
    const key = d.toISOString();
    const bucket = hourly.get(key) ?? { sum: 0, count: 0 };
    bucket.sum += Math.max(0, p.mw);
    bucket.count += 1;
    hourly.set(key, bucket);
  }

  const dayKeys = Array.from(new Set(Array.from(hourly.keys()).map((key) => key.slice(0, 10))))
    .sort()
    .reverse();

  for (const day of dayKeys) {
    const profile: number[] = [];
    let complete = true;
    for (let hour = 0; hour < 24; hour++) {
      const key = `${day}T${String(hour).padStart(2, "0")}:00:00.000Z`;
      const bucket = hourly.get(key);
      if (!bucket || bucket.count === 0) {
        complete = false;
        break;
      }
      profile.push(bucket.sum / bucket.count / 1000);
    }
    if (complete) return profile;
  }

  return null;
}

/**
 * Total TWh observed across the supplied points. Each point contributes MW
 * times its represented duration in hours; hourly loaders can omit the
 * interval and retain the historical 1h default.
 */
export function totalTWh30d(points: CurtailmentPoint[], defaultIntervalHours = 1): number {
  const mwh = points.reduce((sum, p) => sum + p.mw * (p.intervalHours ?? defaultIntervalHours), 0);
  return mwh / 1_000_000; // MWh -> TWh
}

/** Peak GW observed across any hour bucket in the averaged profile. */
export function peakGW(points: CurtailmentPoint[]): number {
  const profile = timeOfDayAverageGW(points);
  return Math.max(0, ...profile);
}
