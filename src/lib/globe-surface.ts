/**
 * Pure helpers for the G1 "Lantern" globe surface: the land dot field, its
 * day/night brightness bands, the lit territory under each curtailing region,
 * and the per-fuel bar list for a pillar unit. Everything here is free of
 * canvas and DOM so it can be unit-tested; `src/globe.js` does the drawing.
 */
import type { Fuel } from "./fuel.js";

export const FUELS: Fuel[] = ["solar", "wind", "hydro"];

/**
 * Deterministic per-dot hash in [0, 1). The same formula as the Spectrum
 * mark's spoke lengths (`frac(sin(x) * 43758.5453)`), keyed on lon/lat so a
 * dot keeps its value across frames, rotations and data refreshes. Territory
 * dithering thresholds against it, so a dot only changes fuel when the fuel
 * shares themselves move - it never flickers.
 */
export function dotHash(lon: number, lat: number): number {
  const v = Math.sin(lon * 127.1 + lat * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

/**
 * Brightness band 0..BANDS-1 for a land dot from the cosine of its angle to
 * the subsolar point. A smoothstep across roughly -0.12..0.28 gives a soft
 * terminator about 23 degrees wide instead of a hard lit/unlit edge.
 */
export const BANDS = 7;
export function dayBand(cosSun: number): number {
  let t = (cosSun + 0.12) / 0.4;
  t = Math.max(0, Math.min(1, t));
  t = t * t * (3 - 2 * t);
  return Math.round(t * (BANDS - 1));
}

/** Alpha per brightness band for unlit (no-territory) land dots. Already
 *  includes the 0.62 dimming that keeps day-side land from reading as solar
 *  gold. */
export const BAND_ALPHA: readonly number[] = [0.16, 0.22, 0.3, 0.4, 0.52, 0.64, 0.78].map((a) => +(a * 0.62).toFixed(3));

/** Angular radius, in degrees, of the lit territory under a region curtailing
 *  `gw` gigawatts. sqrt so area tracks magnitude. */
export function territoryRadiusDeg(gw: number): number {
  return 1.5 + 3.4 * Math.sqrt(Math.max(0, gw));
}

/** Approximate great-circle-free distance in degrees, good enough inside a
 *  ~12 degree territory radius. */
export function approxDistDeg(lon1: number, lat1: number, lon2: number, lat2: number): number {
  let dLon = lon1 - lon2;
  if (dLon > 180) dLon -= 360;
  if (dLon < -180) dLon += 360;
  const x = dLon * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180));
  const y = lat1 - lat2;
  return Math.hypot(x, y);
}

export interface TerritorySource {
  lon: number;
  lat: number;
  /** Curtailed GW for this fuel at this region, already hour-resolved. */
  gw: number;
  fuel: Fuel;
  /** GW that sets the territory's reach - the whole region's total, so every
   *  fuel of a mixed region covers the same footprint and only the dither
   *  split differs. Defaults to `gw`. */
  radiusGW?: number;
}

export interface TerritoryResult {
  /** Per dot: index into FUELS, or -1 when the dot is not in any territory. */
  fuel: Int8Array;
  /** Per dot: 1 when it sits in the inner half of the territory claiming it. */
  inner: Uint8Array;
  /** Per dot: 1 - d/r for the nearest territory reaching it (1 at a region's
   *  centre, 0 at the edge, 0 when unlit). The horizon globe fades its lit
   *  dots with it. */
  strength: Float32Array;
}

/**
 * Assign each land dot to at most one fuel. Every source (region x fuel)
 * within reach adds weight (1 - d/r) * gw to its fuel; the dot then picks a
 * fuel by thresholding its fixed hash against those weights. A region that is
 * 70% wind and 30% solar therefore lights ~70% of its dots cyan and ~30% gold,
 * scattered; two single-fuel regions with overlapping reach blend the same
 * way. `lons`/`lats`/`hash` are parallel arrays over the land dots.
 *
 * `radiusDeg` sets each territory's reach from its GW. The default is the G1
 * globe's; the dark horizon passes its own, smaller one (redesign plan 6.3).
 */
export function assignTerritory(
  lons: Float32Array,
  lats: Float32Array,
  hash: Float32Array,
  sources: TerritorySource[],
  cellIndex: DotCellIndex,
  radiusDeg: (gw: number) => number = territoryRadiusDeg,
): TerritoryResult {
  const n = lons.length;
  const w = new Float32Array(n * 3);
  const maxSc = new Float32Array(n);
  for (const s of sources) {
    if (!(s.gw > 0)) continue;
    const r = radiusDeg(s.radiusGW ?? s.gw);
    const fi = FUELS.indexOf(s.fuel);
    if (fi < 0) continue;
    for (const i of cellIndex.near(s.lon, s.lat, r)) {
      const d = approxDistDeg(lons[i], lats[i], s.lon, s.lat);
      if (d >= r) continue;
      const sc = 1 - d / r;
      w[i * 3 + fi] += sc * s.gw;
      if (sc > maxSc[i]) maxSc[i] = sc;
    }
  }
  const fuel = new Int8Array(n).fill(-1);
  const inner = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const a = w[i * 3], b = w[i * 3 + 1], c = w[i * 3 + 2];
    const tot = a + b + c;
    if (tot <= 0) continue;
    const t = hash[i] * tot;
    fuel[i] = t < a ? 0 : t < a + b ? 1 : 2;
    inner[i] = maxSc[i] > 0.5 ? 1 : 0;
  }
  return { fuel, inner, strength: maxSc };
}

/** Coarse lon/lat bucket index over the land dots so territory assignment
 *  only visits dots near each region. */
export class DotCellIndex {
  private cells = new Map<number, number[]>();
  constructor(lons: Float32Array, lats: Float32Array, private cellDeg = 3) {
    for (let i = 0; i < lons.length; i++) {
      const k = this.key(Math.floor((lons[i] + 180) / cellDeg), Math.floor((lats[i] + 90) / cellDeg));
      let a = this.cells.get(k);
      if (!a) this.cells.set(k, (a = []));
      a.push(i);
    }
  }
  private key(cx: number, cy: number): number {
    const nx = Math.ceil(360 / this.cellDeg);
    return cy * nx + ((cx % nx) + nx) % nx;
  }
  *near(lon: number, lat: number, rDeg: number): Generator<number> {
    const d = this.cellDeg;
    const latR = rDeg;
    const lonR = rDeg / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
    const y0 = Math.floor((lat - latR + 90) / d), y1 = Math.floor((lat + latR + 90) / d);
    const x0 = Math.floor((lon - lonR + 180) / d), x1 = Math.floor((lon + lonR + 180) / d);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const a = this.cells.get(this.key(cx, cy));
        if (a) yield* a;
      }
    }
  }
}

export interface Bar {
  /** Index of the member region in its pillar unit. */
  member: number;
  fuel: Fuel;
  gw: number;
}

/**
 * One bar per fuel per region - never stacked. Each member region of a pillar
 * unit contributes a bar for every fuel it curtails at this hour. Order is
 * stable (member, then solar/wind/hydro) so bars do not swap sides between
 * frames.
 */
export function barsForUnit(members: { gw: number; share: Record<Fuel, number> }[], minGW = 0.01): Bar[] {
  const bars: Bar[] = [];
  members.forEach((m, member) => {
    for (const fuel of FUELS) {
      const gw = m.gw * (m.share[fuel] ?? 0);
      if (gw > minGW) bars.push({ member, fuel, gw });
    }
  });
  return bars;
}

/** Mix a #rrggbb colour toward white by `t` (0..1). Used for pillar tips. */
export function tintHex(hex: string, t: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = (s: number) => {
    const v = (n >> s) & 255;
    return Math.round(v + (255 - v) * t).toString(16).padStart(2, "0");
  };
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}
