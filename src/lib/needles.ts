/**
 * Pure geometry for the light globe's needles and its selected-region label
 * (src/globe-engraved.js draws them). Kept free of d3 and the DOM so it is
 * unit-tested: tests/needles.test.ts.
 *
 * Constants are the redesign handoff's renderer_constants.engraved_globe.
 */
import type { QualityBucket } from "./region-quality.js";

/** Needles under this many GW are not drawn. */
export const MIN_GW_DRAWN = 0.05;

/**
 * Needle length in CSS px. It scales with sqrt(GW), as the pillars always
 * have (redesign plan 0, decided 5); `k` is R / 345 and `outward` (0..1)
 * shortens needles near the disc centre, where they point at the viewer.
 */
export function needleLength(gw: number, k: number, outward: number): number {
  return (5 + Math.sqrt(Math.max(0, gw)) * 59) * k * (0.45 + 0.55 * Math.min(1, outward * 1.6 + 0.2));
}

export function headRadius(gw: number, sk: number): number {
  return (1.6 + Math.sqrt(Math.max(0, gw)) * 1.7) * sk;
}

export interface NeedleStyle {
  /** Estimated: a dashed line. */
  dashed: boolean;
  /** Anchored: a hollow head. */
  hollowHead: boolean;
  /** Stale feed: a dashed --quality-warning ring round the head. */
  staleRing: boolean;
}

/**
 * The quality encoding (redesign plan 6.1, D5): the buckets and opacities in
 * region-quality.ts are unchanged; only the drawing is. Measured is a solid
 * line with a solid head.
 */
export function needleStyle(bucket: QualityBucket, stale: boolean): NeedleStyle {
  return {
    dashed: bucket === "estimated",
    hollowHead: bucket === "anchored",
    staleRing: Boolean(stale),
  };
}

/** Selected-label card metrics, CSS px (redesign plan 6.2 and the light mock). */
export const LABEL = { width: 196, height: 88, rise: 60, lead: 34, gap: 12, cardAbove: 104 } as const;

export interface LabelPlacement {
  left: number;
  top: number;
  side: "left" | "right";
  /** The leader's points: from beside the head, up and out, then across. */
  leader: [number, number][];
}

/**
 * Where the selected region's label card goes, and the leader that joins it
 * to the needle head: up and out from the head, then across to the card, as
 * the mock draws it. The card sits on the side the needle points to, and
 * flips side (and below the head) where it would leave the canvas. It tracks
 * the head in both axes: STATUS records why a label pinned to a gutter read
 * as stuck when the globe turned.
 */
export function placeSelectionLabel(
  head: { x: number; y: number },
  { w, h, cx }: { w: number; h: number; cx: number },
): LabelPlacement {
  const { width, height, rise, lead, gap, cardAbove } = LABEL;
  let sx = head.x >= cx ? 1 : -1;
  if (sx > 0 && head.x + lead + gap + width > w) sx = -1;
  else if (sx < 0 && head.x - lead - gap - width < 0) sx = 1;
  const sy = head.y - cardAbove < 0 ? 1 : -1;
  const elbow: [number, number] = [head.x + sx * lead, head.y + sy * rise];
  const end: [number, number] = [elbow[0] + sx * gap, elbow[1]];
  const left = sx > 0 ? end[0] : end[0] - width;
  // The leader meets the card 44px from its top (104 - 60), above or below.
  const top = sy < 0 ? head.y - cardAbove : end[1] - (cardAbove - rise);
  return {
    left: Math.max(0, Math.min(left, w - width)),
    top: Math.max(0, Math.min(top, h - height)),
    side: sx > 0 ? "right" : "left",
    leader: [[head.x + sx * 5, head.y + sy * 6], elbow, end],
  };
}
