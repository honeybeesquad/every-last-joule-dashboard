/**
 * Camera and sun geometry for the redesign's globe renderers (the light
 * "Almanac" engraved globe now, the dark "Horizon" globe next). Pure maths,
 * no DOM, so it is unit-tested (tests/globe-camera.test.ts).
 *
 * Ported from the handoff's reference renderer (reference/geo.js).
 *
 * Conventions
 * - A point on the globe is a unit vector [x, y, z]; z is the north pole.
 * - A camera is { f, e, n }: f points from the Earth's centre toward the
 *   viewer, e is screen-right and n is screen-up. `ortho` returns
 *   [x, y, depth] in units of the globe radius, with y pointing DOWN the
 *   screen; depth > 0 is the visible hemisphere.
 */

export type Vec3 = [number, number, number];

export interface Camera {
  f: Vec3;
  e: Vec3;
  n: Vec3;
}

export const D2R = Math.PI / 180;

export function vec(lat: number, lon: number): Vec3 {
  const a = lat * D2R;
  const b = lon * D2R;
  return [Math.cos(a) * Math.cos(b), Math.cos(a) * Math.sin(b), Math.sin(a)];
}

export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** Smoothstep from e0 to e1 (e0 may be greater than e1, which inverts it). */
export function smooth(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** Camera looking at (lat0, lon0), north up. */
export function camera(lat0: number, lon0: number): Camera {
  const l = lon0 * D2R;
  const p = lat0 * D2R;
  return {
    f: vec(lat0, lon0),
    e: [-Math.sin(l), Math.cos(l), 0],
    n: [-Math.sin(p) * Math.cos(l), -Math.sin(p) * Math.sin(l), Math.cos(p)],
  };
}

export function ortho(cam: Camera, v: Vec3): Vec3 {
  return [dot(v, cam.e), -dot(v, cam.n), dot(v, cam.f)];
}

/**
 * Longitude of the subsolar point at a (fractional) UTC hour: the repo's one
 * rule, (12 - hour) x 15, which is what src/lib/solar-mask.ts isSolarNight()
 * assumes. The drawn terminator and the data mask must agree, or a solar
 * needle could stand on the night side of the picture at dawn and dusk; so no
 * equation of time here unless solar-mask.ts moves to it in the same change.
 */
export function subsolarLongitude(utcHour: number): number {
  const lon = -15 * (utcHour - 12);
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

/** Solar declination in degrees for a date (from the ecliptic longitude, ~0.1 deg). */
export function solarDeclination(date: Date): number {
  const n = (date.getTime() - Date.UTC(2000, 0, 1, 12)) / 86400000;
  const L = (((280.46 + 0.9856474 * n) % 360) + 360) % 360;
  const g = ((((357.528 + 0.9856003 * n) % 360) + 360) % 360) * D2R;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * D2R;
  const eps = (23.439 - 0.0000004 * n) * D2R;
  return Math.asin(Math.sin(eps) * Math.sin(lambda)) / D2R;
}

/**
 * The subsolar point for the dashboard's clock: the declination of the
 * calendar date, the longitude of the clock's (possibly scrubbed) UTC hour.
 */
export function subsolar(date: Date, utcHour: number): { lat: number; lon: number; v: Vec3 } {
  const lat = solarDeclination(date);
  const lon = subsolarLongitude(utcHour);
  return { lat, lon, v: vec(lat, lon) };
}

/** Follow-the-sun cameras (redesign plan section 6.1). */
export const FOLLOW_SUN = {
  light: { lat0: 24, lonOffset: 22 },
  dark: { lat0: -36, lonOffset: 20 },
} as const;

/** Normalise a longitude into [-180, 180). */
export function wrapLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

/** Angular distance in degrees between two (lat, lon) points. */
export function angleBetween(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const c = Math.max(-1, Math.min(1, dot(vec(lat1, lon1), vec(lat2, lon2))));
  return Math.acos(c) / D2R;
}
