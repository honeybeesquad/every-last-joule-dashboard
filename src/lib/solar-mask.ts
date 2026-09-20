/**
 * Solar-physics mask: zero out profile hours where the sun is below the
 * horizon for the region's longitude.
 *
 * Why this exists: several grid-operator solar feeds (CAISO, PJM, MISO,
 * SPP, NYISO, ERCOT, BPA) report non-trivial "solar" values at local
 * midnight. The most likely cause is utility-scale battery discharge
 * accounted under SUN in the EIA fuel-type breakdown. Whatever the
 * cause, solar curtailment outside daylight hours is physically zero —
 * a panel cannot be curtailed when it isn't generating.
 *
 * Approach: derive an approximate local hour from the region's longitude
 * (offsetHours = lon / 15, no DST), and clip to a fixed 06:00–19:00
 * local daylight window. This is good enough for the ±45° latitude band
 * where every labeled solar region in the dataset sits; high-latitude
 * winter would need a seasonal sunrise/sunset model.
 *
 * Applied as a post-processing step in src/index.md after regionData
 * is built — does not modify the source data loaders, so live and
 * snapshot fallback paths both inherit the correction automatically.
 */
/** Local hour at a longitude for a given UTC hour. Longitude/15 rather than
 *  a tz database: curtailment profiles are UTC-hour buckets, and a region's
 *  solar window tracks solar time, not civil time. */
export function localSolarHour(utcHour: number, lon: number): number {
  return (((utcHour + lon / 15) % 24) + 24) % 24;
}

/** True when the sun is down at this longitude and UTC hour.
 *
 *  Single source of truth for the daylight window. It is consumed both by
 *  maskSolarNight (which zeroes a solar region's own profile) and by
 *  solarShareAtHour in fuel.ts (which zeroes the solar SLICE of a mixed
 *  region's combined profile). Those two have to agree exactly — if they
 *  drift, a region can be lit by one rule and dark by the other, and the
 *  hotspot list will disagree with the globe about the same hour. */
export function isSolarNight(utcHour: number, lon: number): boolean {
  const localHour = localSolarHour(utcHour, lon);
  return localHour < 6 || localHour >= 19;
}

export function maskSolarNight(profile: readonly number[], lon: number): number[] {
  return profile.map((value, utcHour) => (isSolarNight(utcHour, lon) ? 0 : value));
}
