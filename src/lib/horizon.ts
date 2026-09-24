/**
 * Pure geometry for the dark-mode globe, "Horizon" (src/globe-horizon.js
 * draws it). A large orthographic globe whose centre sits below the
 * viewport, so only a band near its top limb shows; each curtailing region
 * is a beam of light standing up from that horizon. Kept free of canvas and
 * the DOM so it is unit-tested: tests/horizon.test.ts.
 *
 * Constants are the redesign handoff's renderer_constants.horizon_globe
 * (redesign plan 6.3).
 */
import type { QualityBucket } from "./region-quality.js";
import { qualityOpacity } from "./region-quality.js";

/** Beams under this many GW are not drawn. */
export const MIN_GW_BEAM = 0.03;

/** Land dot pitch, degrees. */
export const HORIZON_DOT_PITCH = 0.42;

export interface HorizonGeometry {
  /** Globe radius, CSS px. */
  R: number;
  /** y of the limb's highest point. */
  top: number;
  /** x of the globe centre. */
  cx: number;
  /** y of the globe centre (top + R): below the viewport. */
  cy: number;
}

/**
 * Desktop geometry for a W x H stage: R = 0.94 x max(W, 900), the limb's top
 * point at half the height, the centre at 57% of the width.
 */
export function horizonGeometry(W: number, H: number): HorizonGeometry {
  const R = 0.94 * Math.max(W, 900);
  const top = 0.5 * H;
  return { R, top, cx: 0.57 * W, cy: top + R };
}

/**
 * Phone geometry (redesign plan 3.4): the horizon drawn into a band under the
 * hero, 390 x 530 on a 390 x 844 screen, with R = 650, the limb's top 235px
 * into the band and the centre mid-width. Scales with the band's size.
 */
export function horizonPhoneGeometry(W: number, H: number): HorizonGeometry {
  const R = 650 * (W / 390);
  const top = 235 * (H / 530);
  return { R, top, cx: W / 2, cy: top + R };
}

/**
 * The visitor's view of the horizon: a magnification of the stage picture,
 * screen = base x zoom + (tx, ty), and the camera latitude a vertical drag
 * tilts. Home is zoom 1, no offset, FOLLOW_SUN.dark.lat0.
 */
export interface HorizonView {
  zoom: number;
  tx: number;
  ty: number;
}

export const HORIZON_ZOOM_MAX = 8;

/** Camera latitudes a vertical drag can tilt to. The horizon's crest is at
 *  lat0 + 90 on the camera's meridian, so this range brings every latitude
 *  from the Southern Ocean to the Arctic to the horizon or just below it. */
export const HORIZON_LAT_RANGE: readonly [number, number] = [-85, 25];

/** The geometry a view draws at: the base geometry magnified about the stage's origin, then offset. */
export function viewGeometry(base: HorizonGeometry, view: HorizonView): HorizonGeometry {
  const R = base.R * view.zoom;
  const top = base.top * view.zoom + view.ty;
  return { R, top, cx: base.cx * view.zoom + view.tx, cy: top + R };
}

/**
 * Keep a view inside a W x H stage: zoom in [1, HORIZON_ZOOM_MAX], and the
 * magnified stage picture still covering the stage, so a view at zoom 1 is
 * always home.
 */
export function clampView(view: HorizonView, W: number, H: number): HorizonView {
  const zoom = Math.max(1, Math.min(HORIZON_ZOOM_MAX, view.zoom));
  const clamp = (t: number, size: number) => Math.max(size - size * zoom, Math.min(0, t));
  return { zoom, tx: clamp(view.tx, W), ty: clamp(view.ty, H) };
}

/** Zoom by `factor` about the stage point (mx, my), which stays where it is (within the clamp). */
export function zoomViewAt(view: HorizonView, factor: number, mx: number, my: number, W: number, H: number): HorizonView {
  const zoom = Math.max(1, Math.min(HORIZON_ZOOM_MAX, view.zoom * factor));
  const k = zoom / view.zoom;
  return clampView({ zoom, tx: mx - (mx - view.tx) * k, ty: my - (my - view.ty) * k }, W, H);
}

/**
 * Country borders fade in as the view zooms: none at home (the stage keeps
 * its designed look), full strength from zoom 2.5.
 */
export function borderAlpha(zoom: number): number {
  return Math.round(0.3 * Math.max(0, Math.min(1, (zoom - 1) / 1.5)) * 100) / 100;
}

/** The phone band's camera and scales (redesign plan 3.4). */
export const HORIZON_PHONE = { lat0: -38, beam: 0.12, widthScale: 0.75, dotScale: 0.8 } as const;

/** Beam height in units of R: 0.004 + K x sqrt(GW), K = 0.1 on desktop. */
export function beamHeight(gw: number, K = 0.1): number {
  return 0.004 + K * Math.sqrt(Math.max(0, gw));
}

/** Beam width in CSS px: 1.1 + 1.2 x sqrt(GW). */
export function beamWidth(gw: number, scale = 1): number {
  return (1.1 + 1.2 * Math.sqrt(Math.max(0, gw))) * scale;
}

/**
 * Where a beam starts, as a multiple of its ground point's projected
 * position. A beam whose base faces the viewer (z > 0) shows whole, from
 * k0 = 1. One whose base is just beyond the horizon shows only the part that
 * has risen past the limb: the point at k x (x, y) is on screen once its
 * screen radius k x |xy| reaches 1, so k0 = 1 / |xy|. `visible` is false when
 * even the tip, at k = 1 + h, is still behind the planet.
 */
export function beamSpan(x: number, y: number, z: number, h: number): { k0: number; visible: boolean } {
  const k0 = z > 0 ? 1 : 1 / Math.max(Math.hypot(x, y), 1e-6);
  return { k0, visible: k0 < 1 + h };
}

/**
 * The lit territory's reach at this camera, degrees: 0.5 + 1.6 x sqrt(GW).
 * The light globe's G1 ancestor used 1.5 + 3.4 x sqrt(GW); seen edge-on at
 * the horizon that floods whole provinces, so the dark mock used this.
 */
export function horizonTerritoryRadiusDeg(gw: number): number {
  return 0.5 + 1.6 * Math.sqrt(Math.max(0, gw));
}

/**
 * Beam opacity: the quality bucket's (region-quality.ts: measured 1,
 * anchored 0.8, estimated 0.62), except the selected beam, which draws at
 * full brightness whatever its bucket (redesign plan 6.3).
 */
export function beamOpacity(bucket: QualityBucket, selected: boolean): number {
  return selected ? 1 : qualityOpacity(bucket);
}

/** Estimated beams get a dashed core, so the tier reads by shape as well as brightness. */
export const ESTIMATED_CORE_DASH: readonly [number, number] = [4, 3];

/**
 * Alpha of an untinted land dot: brighter on the day side and away from the
 * limb, quantised to 0.05 so a frame fills a handful of buckets.
 * `day` and `limb` are the 0..1 smoothsteps the renderer computes.
 */
export function landDotAlpha(day: number, limb: number): number {
  return Math.round((0.1 + 0.34 * day) * (0.35 + 0.65 * limb) * 20) / 20;
}

/**
 * Alpha of a land dot lit by a curtailing region: stronger near the region
 * (`strength` 1 at its centre, 0 at the territory's edge) and away from the
 * limb, quantised to 0.1.
 */
export function tintDotAlpha(strength: number, limb: number): number {
  const tintA = 0.25 + 0.6 * Math.max(0, Math.min(1, strength));
  return Math.round(tintA * (0.4 + 0.6 * limb) * 10) / 10;
}
