// Co-located wind/solar regions get split into adjacent screen-x pillars
// 44px centre-to-centre apart so each is individually tappable per WCAG 2.5.5
// (minimum 44x44 touch target). Single-kind buckets are unchanged.

export const PILLAR_SEPARATION_PX = 44;

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
    const distinctKinds = new Set(bucket.map((r) => r.kind));
    if (distinctKinds.size <= 1) {
      units.push({ regions: [...bucket].sort(compareRegion), offsetPx: 0 });
      continue;
    }
    const sorted = [...bucket].sort(compareRegion);
    const n = sorted.length;
    sorted.forEach((region, i) => {
      const offsetPx = (i - (n - 1) / 2) * PILLAR_SEPARATION_PX;
      units.push({ regions: [region], offsetPx });
    });
  }
  return units;
}
