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
export function maskSolarNight(profile: readonly number[], lon: number): number[] {
  const offsetHours = lon / 15;
  return profile.map((value, utcHour) => {
    const localHour = (((utcHour + offsetHours) % 24) + 24) % 24;
    if (localHour < 6 || localHour >= 19) return 0;
    return value;
  });
}
