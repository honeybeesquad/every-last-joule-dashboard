// Buckets co-located regions into render units anchored at the shared
// centroid (offsetPx always 0). Co-location is rare and undesirable now
// that per-fuel regions carry resource-appropriate centroids inside their
// country (see regions.ts). If two regions happen to share a centroid,
// they stack into one composite pillar — visually less ideal than adjacent
// pillars but unconditionally inside-country, which is the invariant.
//
// The earlier 44px screen-x offset approach (PR #62) was reverted because
// at low zoom 44px maps to several degrees of longitude, putting bar bases
// across country borders (e.g., spain-wind in Portugal). No screen-px or
// fixed-degree offset works for all country sizes; the data layer is the
// right place to differentiate fuels.

export const PILLAR_SEPARATION_PX = 0;

const KIND_ORDER: Record<string, number> = {
  wind: 0,
  solar: 1,
  hydro: 2,
  geo: 3,
  mixed: 4,
  flare: 5,
};

export interface PillarRegion {
  id: string;
  lat: number;
  lon: number;
  kind: string;
}

export interface PillarUnit<R extends PillarRegion = PillarRegion> {
  regions: R[];
  offsetPx: number;
}

function compareRegion(a: PillarRegion, b: PillarRegion): number {
  const ka = KIND_ORDER[a.kind] ?? 99;
  const kb = KIND_ORDER[b.kind] ?? 99;
  if (ka !== kb) return ka - kb;
  return a.id.localeCompare(b.id);
}

export function buildPillarUnits<R extends PillarRegion>(regions: R[]): PillarUnit<R>[] {
  const buckets = new Map<string, R[]>();
  for (const region of regions) {
    const key = `${region.lat.toFixed(4)},${region.lon.toFixed(4)}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = [];
      buckets.set(key, bucket);
    }
    bucket.push(region);
  }

  const units: PillarUnit<R>[] = [];
  for (const bucket of buckets.values()) {
    units.push({ regions: [...bucket].sort(compareRegion), offsetPx: 0 });
  }
  return units;
}
