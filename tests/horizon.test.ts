import { describe, expect, it } from "vitest";
import {
  HORIZON_DOT_PITCH, HORIZON_ZOOM_MAX, MIN_GW_BEAM, beamHeight, beamOpacity, beamSpan, beamWidth, borderAlpha,
  clampView, horizonFullGeometry, horizonGeometry, minZoom, zoomOutBlend, horizonTerritoryRadiusDeg, landDotAlpha, tintDotAlpha, viewGeometry, zoomViewAt,
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

describe("the visitor's view (zoom)", () => {
  const W = 1440, H = 900;
  const home = { zoom: 1, tx: 0, ty: 0 };
  const base = horizonGeometry(W, H);

  it("draws the stage's own geometry at home", () => {
    expect(viewGeometry(base, home)).toEqual(base);
  });

  it("keeps the point under the pointer where it is", () => {
    const v = zoomViewAt(home, 2, 700, 600, W, H);
    expect(v.zoom).toBe(2);
    // The base point (700, 600) maps to itself.
    expect(700 * v.zoom + v.tx).toBeCloseTo(700, 9);
    expect(600 * v.zoom + v.ty).toBeCloseTo(600, 9);
    const g = viewGeometry(base, v);
    expect(g.R).toBeCloseTo(2 * base.R, 9);
    expect(g.cy - g.top).toBeCloseTo(g.R, 9);
  });

  it("comes back home when zoomed out, whatever path it took", () => {
    let v = zoomViewAt(home, 3, 100, 800, W, H);
    v = zoomViewAt(v, 1.7, 1300, 120, W, H);
    v = zoomViewAt(v, 1 / 100, 20, 20, W, H);
    expect(v).toEqual({ zoom: 1, tx: 0, ty: 0 });
  });

  it("stops at the zoom limits and never uncovers the stage", () => {
    expect(zoomViewAt(home, 1000, 0, 0, W, H).zoom).toBe(HORIZON_ZOOM_MAX);
    expect(zoomViewAt(home, 0.5, 0, 0, W, H)).toEqual(home);
    const v = clampView({ zoom: 2, tx: 500, ty: -5000 }, W, H);
    expect(v).toEqual({ zoom: 2, tx: 0, ty: -H });
  });

  it("fades the borders in: none at home, full from zoom 2.5", () => {
    expect(borderAlpha(1)).toBe(0);
    expect(borderAlpha(1.75)).toBeCloseTo(0.15, 9);
    expect(borderAlpha(2.5)).toBe(0.3);
    expect(borderAlpha(HORIZON_ZOOM_MAX)).toBe(0.3);
  });
});

describe("zooming out to the whole globe", () => {
  const W = 1440, H = 900;
  const base = horizonGeometry(W, H);
  const full = horizonFullGeometry(W, H, 76, 232);
  const zMin = minZoom(base, full);

  it("fits the whole globe between the header and the dock, right of the hero", () => {
    expect(full.cy - full.R).toBeGreaterThanOrEqual(76);
    expect(full.cy + full.R).toBeLessThanOrEqual(H - 232);
    expect(full.cx + full.R).toBeLessThanOrEqual(W - 32);
    expect(full.cx - full.R).toBeGreaterThan(0.4 * W);
  });

  it("centres it on a narrow stage", () => {
    const g = horizonFullGeometry(390, 844);
    expect(g.cx).toBe(195);
    expect(g.R).toBeLessThanOrEqual(0.47 * 0.92 * 390 + 1e-9);
  });

  it("reaches the whole globe at the minimum zoom, and the horizon at 1", () => {
    expect(zMin).toBeCloseTo(full.R / base.R, 12);
    expect(viewGeometry(base, { zoom: zMin, tx: 0, ty: 0 }, full)).toEqual({ ...full, top: full.cy - full.R });
    expect(viewGeometry(base, { zoom: 1, tx: 0, ty: 0 }, full)).toEqual(base);
  });

  it("lifts the globe steadily as it shrinks", () => {
    let lastCy = Infinity, lastR = Infinity;
    for (let z = 1; z >= zMin; z -= 0.05) {
      const g = viewGeometry(base, { zoom: z, tx: 0, ty: 0 }, full);
      expect(g.cy).toBeLessThanOrEqual(lastCy);
      expect(g.R).toBeLessThanOrEqual(lastR);
      lastCy = g.cy; lastR = g.R;
    }
    expect(zoomOutBlend(1, zMin)).toBe(0);
    expect(zoomOutBlend(zMin, zMin)).toBe(1);
  });

  it("stops at the whole globe and drops any magnified offset below 1", () => {
    const zoomedIn = zoomViewAt({ zoom: 1, tx: 0, ty: 0 }, 3, 900, 600, W, H, zMin);
    const out = zoomViewAt(zoomedIn, 1 / 1000, 900, 600, W, H, zMin);
    expect(out).toEqual({ zoom: zMin, tx: 0, ty: 0 });
    // Back up through 1 magnifies from the plain stage.
    const up = zoomViewAt(out, 2 / zMin, 900, 600, W, H, zMin);
    expect(up.zoom).toBeCloseTo(2, 9);
    expect(900 * up.zoom + up.tx).toBeCloseTo(900, 9);
  });

  it("draws borders on the whole globe too", () => {
    expect(borderAlpha(1, zMin)).toBe(0);
    expect(borderAlpha(zMin, zMin)).toBe(0.22);
  });
});
