import { describe, expect, it } from "vitest";
import {
  HORIZON_DOT_PITCH, MIN_GW_BEAM, beamHeight, beamOpacity, beamSpan, beamWidth, horizonGeometry,
  horizonTerritoryRadiusDeg, landDotAlpha, tintDotAlpha,
} from "../src/lib/horizon";
import { camera, ortho, vec } from "../src/lib/globe-camera";
import { territoryRadiusDeg } from "../src/lib/globe-surface";

describe("horizon geometry (redesign plan 6.3)", () => {
  it("puts the limb's top at half the height and the centre at 57% of the width, at 1440 x 900", () => {
    const g = horizonGeometry(1440, 900);
    expect(g.R).toBeCloseTo(0.94 * 1440, 9);
    expect(g.top).toBe(450);
    expect(g.cx).toBeCloseTo(0.57 * 1440, 9);
    expect(g.cy).toBeCloseTo(450 + 0.94 * 1440, 9);
  });

  it("never lets the globe shrink below R = 0.94 x 900, so a narrow stage still shows a horizon", () => {
    expect(horizonGeometry(600, 700).R).toBeCloseTo(0.94 * 900, 9);
  });

  it("draws land dots 0.42 deg apart and nothing under 0.03 GW", () => {
    expect(HORIZON_DOT_PITCH).toBe(0.42);
    expect(MIN_GW_BEAM).toBe(0.03);
  });
});

describe("beams", () => {
  it("scale their height with the square root of GW, as the pillars always have", () => {
    expect(beamHeight(0)).toBeCloseTo(0.004, 12);
    expect((beamHeight(4) - 0.004) / (beamHeight(1) - 0.004)).toBeCloseTo(2, 12);
    expect(beamHeight(1, 0.12)).toBeCloseTo(0.124, 12);
  });

  it("widen with the square root of GW", () => {
    expect(beamWidth(0)).toBeCloseTo(1.1, 12);
    expect(beamWidth(4)).toBeCloseTo(3.5, 12);
    expect(beamWidth(4, 0.75)).toBeCloseTo(3.5 * 0.75, 12);
  });

  it("never take a root of a negative", () => {
    expect(Number.isFinite(beamHeight(-1))).toBe(true);
    expect(Number.isFinite(beamWidth(-1))).toBe(true);
  });

  it("show whole when the base faces the viewer", () => {
    expect(beamSpan(0.2, -0.9, 0.3, 0.1)).toEqual({ k0: 1, visible: true });
  });

  it("rise from the limb when the base is just beyond the horizon", () => {
    // A region 6 deg past the limb's top: the camera looks at lat -36, so the
    // limb's top is lat 54 on the camera's meridian.
    const cam = camera(-36, 100);
    const [x, y, z] = ortho(cam, vec(60, 100));
    expect(z).toBeLessThan(0);
    const tall = beamSpan(x, y, z, beamHeight(1));
    expect(tall.k0).toBeCloseTo(1 / Math.hypot(x, y), 12);
    expect(tall.visible).toBe(true);
    // A beam too short to clear the planet is not drawn.
    expect(beamSpan(x, y, z, 0.001).visible).toBe(false);
  });

  it("hide when the whole beam stays behind the planet", () => {
    // The point opposite the camera, and one 30 deg past the limb's top.
    const cam = camera(-36, 100);
    const [x, y, z] = ortho(cam, vec(36, -80));
    expect(z).toBeCloseTo(-1, 9);
    expect(beamSpan(x, y, z, beamHeight(10)).visible).toBe(false);
    // 30 deg past the limb (k0 = 1 / sin 120 deg = 1.155): a 1 GW beam
    // (h = 0.104) stays hidden, a 10 GW one (h = 0.32) rises into view.
    const [x2, y2, z2] = ortho(cam, vec(84, 100));
    expect(beamSpan(x2, y2, z2, beamHeight(1)).visible).toBe(false);
    expect(beamSpan(x2, y2, z2, beamHeight(10)).visible).toBe(true);
  });

  it("carry the quality bucket in brightness, and the selected beam draws at full brightness", () => {
    expect(beamOpacity("measured", false)).toBe(1);
    expect(beamOpacity("anchored", false)).toBe(0.8);
    expect(beamOpacity("estimated", false)).toBe(0.62);
    expect(beamOpacity("estimated", true)).toBe(1);
  });
});

describe("lit territory and land dots", () => {
  it("reach 0.5 + 1.6 x sqrt(GW) deg, inside the G1 globe's reach at every GW", () => {
    expect(horizonTerritoryRadiusDeg(1)).toBeCloseTo(2.1, 12);
    for (const gw of [0, 0.1, 1, 6.8, 20]) {
      expect(horizonTerritoryRadiusDeg(gw)).toBeLessThan(territoryRadiusDeg(gw));
    }
  });

  it("quantise dot alphas so a frame fills a handful of buckets", () => {
    for (const day of [0, 0.3, 1]) {
      for (const limb of [0, 0.5, 1]) {
        const a = landDotAlpha(day, limb);
        expect(Math.round(a * 20)).toBeCloseTo(a * 20, 9);
        expect(a).toBeGreaterThan(0);
        expect(a).toBeLessThanOrEqual(0.45);
      }
    }
    for (const strength of [0, 0.5, 1]) {
      const a = tintDotAlpha(strength, 1);
      expect(Math.round(a * 10)).toBeCloseTo(a * 10, 9);
      expect(a).toBeGreaterThanOrEqual(0.1);
    }
  });

  it("brighten land on the day side and lit dots near their region", () => {
    expect(landDotAlpha(1, 1)).toBeGreaterThan(landDotAlpha(0, 1));
    expect(tintDotAlpha(1, 1)).toBeGreaterThan(tintDotAlpha(0, 1));
  });
});
